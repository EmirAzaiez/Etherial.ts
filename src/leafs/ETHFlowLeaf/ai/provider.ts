// The AI the flow steps talk to.
//
// The leaf ships no model of its own: which provider, which key and which model
// is a decision each project has already made somewhere. It asks for a function
// and calls it, so a project on Gemini and a project on Claude both get the same
// steps in the palette.

export interface FlowAICompletion {
    prompt: string
    system?: string
    /** Ask for JSON back. Providers that support a JSON mode should turn it on. */
    json?: boolean
    maxTokens?: number
    temperature?: number
}

export interface FlowAIProvider {
    name: string
    complete: (args: FlowAICompletion) => Promise<string>
}

let provider: FlowAIProvider | null = null

export function setAIProvider(next: FlowAIProvider | null): void {
    provider = next
}

export function aiProvider(): FlowAIProvider | null {
    return provider
}

export function hasAI(): boolean {
    return provider !== null
}

export async function complete(args: FlowAICompletion): Promise<string> {
    if (!provider) throw new Error('No AI provider is configured for this workspace.')
    return provider.complete(args)
}

/**
 * Reads JSON out of a model's answer.
 *
 * Models wrap JSON in prose and fences no matter how firmly they are asked not
 * to, and a step that fails because of a stray ```json is a step the customer
 * cannot fix.
 */
export function parseJSON<T = any>(text: string): T | null {
    const trimmed = String(text ?? '').trim()
    if (!trimmed) return null

    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed)
    const candidate = fenced ? fenced[1].trim() : trimmed

    try {
        return JSON.parse(candidate)
    } catch {
        // Last resort: the outermost braces or brackets in the answer.
        const start = candidate.search(/[[{]/)
        const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'))
        if (start === -1 || end <= start) return null
        try {
            return JSON.parse(candidate.slice(start, end + 1))
        } catch {
            return null
        }
    }
}
