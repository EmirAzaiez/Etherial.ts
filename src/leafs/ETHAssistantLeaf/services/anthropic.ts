// ──────────────────────────────────────────────────────────────────────────
// The Anthropic Messages API, called with fetch: no SDK to add to every
// project. Only what the assistant uses — text, tools, prompt caching.
// ──────────────────────────────────────────────────────────────────────────

export type ContentBlock =
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: any }
    | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
}

export interface ToolDefinition {
    name: string
    description: string
    input_schema: Record<string, unknown>
}

export interface Usage {
    input_tokens: number
    output_tokens: number
    cached_tokens: number
}

export interface MessageResult {
    content: ContentBlock[]
    stop_reason: string
    usage: Usage
}

/** A failure the back-office can explain: `status` is what the route answers. */
export class AssistantError extends Error {
    constructor(
        public status: number,
        public code: string,
        message?: string
    ) {
        super(message || code)
    }
}

export interface MessageRequest {
    apiKey: string
    baseUrl?: string
    model: string
    /**
     * The first part is cached: keep in it what is the same from one question
     * to the next (rules, the collections), the rest (today, the page) after.
     */
    system: string[]
    messages: ChatMessage[]
    tools?: ToolDefinition[]
    /** `none` on the last step: answer with what was read. */
    toolChoice?: 'auto' | 'none'
    maxTokens: number
    timeoutMs?: number
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function createMessage(request: MessageRequest): Promise<MessageResult> {
    const base = (request.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '')
    // The system prompt and the tools are the same from one question to the
    // next: cached, they are billed at a tenth after the first call.
    const tools = request.tools?.map((tool, i, all) => (i === all.length - 1 ? { ...tool, cache_control: { type: 'ephemeral' } } : tool))
    const body = JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system
            .filter(Boolean)
            .map((text, i) => (i === 0 ? { type: 'text', text, cache_control: { type: 'ephemeral' } } : { type: 'text', text })),
        messages: request.messages,
        ...(tools?.length ? { tools, tool_choice: { type: request.toolChoice || 'auto' } } : {}),
    })

    let lastError: AssistantError | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await sleep(lastError?.status === 503 ? 2000 * attempt : 800 * attempt)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? 60_000)
        let response: globalThis.Response
        try {
            response = await fetch(`${base}/v1/messages`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': request.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body,
                signal: controller.signal,
            })
        } catch (err: any) {
            lastError =
                err?.name === 'AbortError'
                    ? new AssistantError(504, 'provider_timeout', 'Claude took too long to answer')
                    : new AssistantError(502, 'provider_unreachable', 'Could not reach Claude')
            continue
        } finally {
            clearTimeout(timer)
        }

        const text = await response.text()
        let json: any = null
        try {
            json = text ? JSON.parse(text) : null
        } catch {
            // Not JSON: a proxy's error page.
        }

        if (response.ok && json?.content) {
            const usage = json.usage || {}
            return {
                content: json.content,
                stop_reason: json.stop_reason,
                usage: {
                    input_tokens: (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
                    output_tokens: usage.output_tokens || 0,
                    cached_tokens: usage.cache_read_input_tokens || 0,
                },
            }
        }

        const detail = json?.error?.message ? String(json.error.message).slice(0, 200) : `HTTP ${response.status}`
        if (response.status === 401 || response.status === 403) throw new AssistantError(502, 'provider_auth', `The Anthropic key was refused: ${detail}`)
        if (!RETRYABLE.has(response.status)) throw new AssistantError(502, 'provider_rejected', detail)
        lastError = new AssistantError(503, 'provider_busy', `Claude is busy: ${detail}`)
    }
    throw lastError ?? new AssistantError(502, 'provider_unreachable')
}

/** The text of an answer, its blocks joined. */
export function textOf(content: ContentBlock[]): string {
    return content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('\n\n')
        .trim()
}
