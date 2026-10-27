import { AGENT_NAME, PageError } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// The Anthropic Messages API, streamed, called with fetch like the assistant
// leaf does (no SDK to add to every project): the page is written block by
// block, so the back-office shows each one as soon as its line is finished
// instead of waiting a minute for the whole page.
// ──────────────────────────────────────────────────────────────────────────

export interface StreamRequest {
    apiKey: string
    baseUrl?: string
    model: string
    /** Cached: the rules and the blocks are the same from one page to the next. */
    system: string
    prompt: string
    /** PDFs sent with the prompt (a brochure, a flyer), first: base64. */
    documents?: { name: string; data: string }[]
    /** Pictures sent with the prompt (screenshots, a flyer), before it: base64, as the API takes them. */
    images?: { mediaType: string; data: string }[]
    maxTokens: number
    effort?: 'low' | 'medium' | 'high' | 'max'
    /** Ask again on another model when the first one declines (`fallbacks: "default"`). */
    fallbacks: boolean
    signal?: AbortSignal
    /** Each piece of the answer, as it comes. */
    onText: (text: string) => void
    /** Claude is thinking before it writes: nothing to show yet, but something is happening. */
    onThinking?: () => void
}

export interface StreamResult {
    /** `end_turn`, or `max_tokens` when the page was cut short. */
    stopReason: string
    /** The model that wrote it: another one when the first declined. */
    model: string
    usage: { input_tokens: number; output_tokens: number }
}

const API_VERSION = '2026-10-21'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The answer, streamed into `onText`. Retried only while nothing has been written yet. */
export async function streamMessage(request: StreamRequest): Promise<StreamResult> {
    const base = (request.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '')
    const body = JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        stream: true,
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: [
            {
                role: 'user',
                content:
                    request.documents?.length || request.images?.length
                        ? [
                              ...(request.documents ?? []).map((doc) => ({
                                  type: 'document',
                                  source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
                                  title: doc.name,
                              })),
                              ...(request.images ?? []).map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } })),
                              { type: 'text', text: request.prompt },
                          ]
                        : request.prompt,
            },
        ],
        ...(request.effort ? { output_config: { effort: request.effort } } : {}),
        ...(request.fallbacks ? { fallbacks: 'default' } : {}),
    })
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': API_VERSION,
        ...(request.fallbacks ? { 'anthropic-beta': FALLBACK_BETA } : {}),
    }

    let lastError: PageError | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await sleep(1000 * attempt)
        if (request.signal?.aborted) throw new PageError('Stopped.', 499)
        let response: globalThis.Response
        try {
            response = await fetch(`${base}/v1/messages`, { method: 'POST', headers, body, signal: request.signal })
        } catch (err: any) {
            if (err?.name === 'AbortError') throw new PageError('Stopped.', 499)
            lastError = new PageError(`Could not reach ${AGENT_NAME}. Try again in a moment.`, 502)
            continue
        }
        if (response.ok && response.body) return read(response.body, request)

        const text = await response.text().catch(() => '')
        let detail = `HTTP ${response.status}`
        try {
            const message = JSON.parse(text)?.error?.message
            if (message) detail = String(message).slice(0, 200)
        } catch {
            // Not JSON: a proxy's error page.
        }
        if (response.status === 401 || response.status === 403) throw new PageError(`The Anthropic key was refused: ${detail}`, 502)
        if (!RETRYABLE.has(response.status)) throw new PageError(`${AGENT_NAME} declined the request: ${detail}`, 502)
        lastError = new PageError(`${AGENT_NAME} is busy. Try again in a moment.`, 503)
    }
    throw lastError ?? new PageError(`Could not reach ${AGENT_NAME}.`, 502)
}

/** The server-sent events of a streamed message, as they come. */
async function read(stream: ReadableStream<Uint8Array>, request: StreamRequest): Promise<StreamResult> {
    const decoder = new TextDecoder()
    const result: StreamResult = { stopReason: '', model: request.model, usage: { input_tokens: 0, output_tokens: 0 } }
    let buffer = ''

    const handle = (event: any) => {
        switch (event?.type) {
            case 'message_start': {
                const usage = event.message?.usage ?? {}
                result.model = event.message?.model ?? result.model
                result.usage.input_tokens = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)
                break
            }
            case 'content_block_start':
                if (event.content_block?.type === 'thinking') request.onThinking?.()
                break
            case 'content_block_delta':
                if (event.delta?.type === 'text_delta' && event.delta.text) request.onText(event.delta.text)
                else if (event.delta?.type === 'thinking_delta') request.onThinking?.()
                break
            case 'message_delta':
                if (event.delta?.stop_reason) result.stopReason = event.delta.stop_reason
                if (event.usage?.output_tokens) result.usage.output_tokens = event.usage.output_tokens
                break
            case 'error': {
                const kind = event.error?.type
                throw new PageError(
                    kind === 'overloaded_error' ? `${AGENT_NAME} is busy. Try again in a moment.` : `${AGENT_NAME} stopped: ${event.error?.message ?? kind ?? 'error'}`,
                    503
                )
            }
        }
    }

    try {
        for await (const chunk of stream as any as AsyncIterable<Uint8Array>) {
            buffer += decoder.decode(chunk, { stream: true })
            let end: number
            while ((end = buffer.search(/\r?\n\r?\n/)) >= 0) {
                const frame = buffer.slice(0, end)
                buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '')
                const data = frame
                    .split(/\r?\n/)
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).trimStart())
                    .join('\n')
                if (!data) continue
                let event: any
                try {
                    event = JSON.parse(data)
                } catch {
                    continue
                }
                handle(event)
            }
        }
    } catch (err: any) {
        if (err instanceof PageError) throw err
        if (err?.name === 'AbortError' || request.signal?.aborted) throw new PageError('Stopped.', 499)
        throw new PageError(`The connection to ${AGENT_NAME} was cut. Try again.`, 502)
    }

    if (result.stopReason === 'refusal') throw new PageError(`${AGENT_NAME} declined to write this page. Describe it differently.`, 422)
    if (!result.stopReason) throw new PageError(`The connection to ${AGENT_NAME} was cut. Try again.`, 502)
    return result
}
