// ──────────────────────────────────────────────────────────────────────────
// Steps that ask a model.
//
// Three shapes, because three things are actually wanted: write me a sentence,
// decide which of these this is, and pull these fields out of that text. The
// last two are the useful ones — a classification that routes the flow, and an
// extraction that becomes ordinary values the next steps can read.
// ──────────────────────────────────────────────────────────────────────────

import { registry } from '../registry/Registry.js'
import { complete, hasAI, parseJSON } from '../ai/provider.js'
import type { NodeDefinition, OutputField } from '../types.js'

export const generateNode: NodeDefinition = {
    id: 'ai.generate',
    label: 'Write with AI',
    description: 'Produces text from a prompt — a summary, a reply, a subject line.',
    icon: 'Sparkles',
    category: 'ai',
    available: hasAI,
    config: [
        {
            name: 'system',
            type: 'text',
            label: 'Instructions',
            helpText: 'Who the model is being, and the rules it works under.',
        },
        { name: 'prompt', type: 'text', label: 'Prompt', required: true },
        { name: 'max_tokens', type: 'number', label: 'Length limit', defaultValue: 800, min: 32 },
    ],
    output: [{ key: 'text', label: 'Text', type: 'string' }],
    execute: async ({ config, log }) => {
        const text = await complete({
            system: config.system || undefined,
            prompt: String(config.prompt ?? ''),
            maxTokens: Number(config.max_tokens) || 800,
        })
        log(`${text.length} characters`)
        return { output: { text } }
    },
}

export const classifyNode: NodeDefinition = {
    id: 'ai.classify',
    label: 'Classify with AI',
    description: 'Sorts something into one of your categories and routes the automation accordingly.',
    icon: 'Tags',
    category: 'ai',
    available: hasAI,
    config: [
        { name: 'input', type: 'text', label: 'Text', required: true },
        {
            name: 'categories',
            type: 'json',
            widget: 'flow-cases',
            label: 'Categories',
            defaultValue: [],
            helpText: 'A description for each one makes the choice far more reliable.',
        },
        {
            name: 'instructions',
            type: 'text',
            label: 'Extra guidance',
        },
    ],
    branchesFromConfig: 'categories',
    branches: [{ id: 'default', label: 'Unsure' }],
    output: [
        { key: 'category', label: 'Category', type: 'string' },
        { key: 'reason', label: 'Reason', type: 'string' },
    ],
    execute: async ({ config, log }) => {
        const categories: { value: string; label?: string; description?: string }[] = Array.isArray(
            config.categories
        )
            ? config.categories
            : []

        if (categories.length === 0) {
            log('No categories to choose from')
            return { branch: 'default', output: { category: null } }
        }

        const list = categories
            .map((entry, index) => `${index + 1}. ${entry.value}${entry.description ? ` — ${entry.description}` : ''}`)
            .join('\n')

        const answer = await complete({
            system:
                'You classify text into exactly one of the categories you are given. ' +
                'Answer with JSON only: {"category": "<one of the categories, copied exactly>", "reason": "<one short sentence>"}. ' +
                'If none of them fits, use the category "unknown".',
            prompt: `Categories:\n${list}\n\n${config.instructions ? `${config.instructions}\n\n` : ''}Text:\n${config.input}`,
            json: true,
            maxTokens: 300,
        })

        const parsed = parseJSON<{ category?: string; reason?: string }>(answer)
        const chosen = String(parsed?.category ?? '').trim()
        const index = categories.findIndex(
            (entry) => String(entry.value).toLowerCase() === chosen.toLowerCase()
        )

        log(chosen ? `${chosen}${parsed?.reason ? ` — ${parsed.reason}` : ''}` : 'No category chosen')

        return {
            branch: index === -1 ? 'default' : `case_${index}`,
            output: { category: index === -1 ? null : categories[index].value, reason: parsed?.reason ?? null },
        }
    },
}

export const extractNode: NodeDefinition = {
    id: 'ai.extract',
    label: 'Extract with AI',
    description: 'Pulls named values out of free text, ready to use as ordinary fields below.',
    icon: 'ScanText',
    category: 'ai',
    available: hasAI,
    config: [
        { name: 'input', type: 'text', label: 'Text', required: true },
        {
            name: 'fields',
            type: 'json',
            widget: 'flow-extract-fields',
            label: 'Fields to find',
            defaultValue: [],
            helpText: 'A name, a type and a description for each. The description is what does the work.',
        },
    ],
    output: (config): OutputField[] => {
        const fields = Array.isArray(config?.fields) ? config.fields : []
        return [
            {
                key: 'data',
                label: 'Extracted',
                type: 'object',
                fields: fields
                    .filter((field: any) => field?.name)
                    .map((field: any) => ({
                        key: field.name,
                        label: field.label || field.name,
                        type: field.type === 'number' || field.type === 'boolean' ? field.type : 'string',
                    })),
            },
            { key: 'complete', label: 'Everything found', type: 'boolean' },
        ]
    },
    execute: async ({ config, log }) => {
        const fields: { name: string; type?: string; description?: string }[] = Array.isArray(config.fields)
            ? config.fields.filter((field: any) => field?.name)
            : []

        if (fields.length === 0) {
            log('No fields requested')
            return { output: { data: {}, complete: false } }
        }

        const shape = fields
            .map((field) => `  "${field.name}": ${field.type || 'string'}${field.description ? `  // ${field.description}` : ''}`)
            .join('\n')

        const answer = await complete({
            system:
                'You extract structured data from text. Answer with JSON only, matching the shape given. ' +
                'Use null for anything the text does not say — never guess.',
            prompt: `Shape:\n{\n${shape}\n}\n\nText:\n${config.input}`,
            json: true,
            maxTokens: 800,
        })

        const data = parseJSON<Record<string, any>>(answer) ?? {}
        const missing = fields.filter((field) => data[field.name] === undefined || data[field.name] === null)

        if (missing.length > 0) log(`Not found: ${missing.map((field) => field.name).join(', ')}`)

        return { output: { data, complete: missing.length === 0 } }
    },
}

export function registerAINodes(): void {
    registry.registerNode(generateNode)
    registry.registerNode(classifyNode)
    registry.registerNode(extractNode)
}
