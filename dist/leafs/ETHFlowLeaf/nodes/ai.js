// ──────────────────────────────────────────────────────────────────────────
// Steps that ask a model.
//
// Three shapes, because three things are actually wanted: write me a sentence,
// decide which of these this is, and pull these fields out of that text. The
// last two are the useful ones — a classification that routes the flow, and an
// extraction that becomes ordinary values the next steps can read.
// ──────────────────────────────────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { registry } from '../registry/Registry.js';
import { complete, hasAI, parseJSON } from '../ai/provider.js';
export const generateNode = {
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
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b;
        const text = yield complete({
            system: config.system || undefined,
            prompt: String((_b = config.prompt) !== null && _b !== void 0 ? _b : ''),
            maxTokens: Number(config.max_tokens) || 800,
        });
        log(`${text.length} characters`);
        return { output: { text } };
    }),
};
export const classifyNode = {
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
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b, _c;
        const categories = Array.isArray(config.categories)
            ? config.categories
            : [];
        if (categories.length === 0) {
            log('No categories to choose from');
            return { branch: 'default', output: { category: null } };
        }
        const list = categories
            .map((entry, index) => `${index + 1}. ${entry.value}${entry.description ? ` — ${entry.description}` : ''}`)
            .join('\n');
        const answer = yield complete({
            system: 'You classify text into exactly one of the categories you are given. ' +
                'Answer with JSON only: {"category": "<one of the categories, copied exactly>", "reason": "<one short sentence>"}. ' +
                'If none of them fits, use the category "unknown".',
            prompt: `Categories:\n${list}\n\n${config.instructions ? `${config.instructions}\n\n` : ''}Text:\n${config.input}`,
            json: true,
            maxTokens: 300,
        });
        const parsed = parseJSON(answer);
        const chosen = String((_b = parsed === null || parsed === void 0 ? void 0 : parsed.category) !== null && _b !== void 0 ? _b : '').trim();
        const index = categories.findIndex((entry) => String(entry.value).toLowerCase() === chosen.toLowerCase());
        log(chosen ? `${chosen}${(parsed === null || parsed === void 0 ? void 0 : parsed.reason) ? ` — ${parsed.reason}` : ''}` : 'No category chosen');
        return {
            branch: index === -1 ? 'default' : `case_${index}`,
            output: { category: index === -1 ? null : categories[index].value, reason: (_c = parsed === null || parsed === void 0 ? void 0 : parsed.reason) !== null && _c !== void 0 ? _c : null },
        };
    }),
};
export const extractNode = {
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
    output: (config) => {
        const fields = Array.isArray(config === null || config === void 0 ? void 0 : config.fields) ? config.fields : [];
        return [
            {
                key: 'data',
                label: 'Extracted',
                type: 'object',
                fields: fields
                    .filter((field) => field === null || field === void 0 ? void 0 : field.name)
                    .map((field) => ({
                    key: field.name,
                    label: field.label || field.name,
                    type: field.type === 'number' || field.type === 'boolean' ? field.type : 'string',
                })),
            },
            { key: 'complete', label: 'Everything found', type: 'boolean' },
        ];
    },
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        var _b;
        const fields = Array.isArray(config.fields)
            ? config.fields.filter((field) => field === null || field === void 0 ? void 0 : field.name)
            : [];
        if (fields.length === 0) {
            log('No fields requested');
            return { output: { data: {}, complete: false } };
        }
        const shape = fields
            .map((field) => `  "${field.name}": ${field.type || 'string'}${field.description ? `  // ${field.description}` : ''}`)
            .join('\n');
        const answer = yield complete({
            system: 'You extract structured data from text. Answer with JSON only, matching the shape given. ' +
                'Use null for anything the text does not say — never guess.',
            prompt: `Shape:\n{\n${shape}\n}\n\nText:\n${config.input}`,
            json: true,
            maxTokens: 800,
        });
        const data = (_b = parseJSON(answer)) !== null && _b !== void 0 ? _b : {};
        const missing = fields.filter((field) => data[field.name] === undefined || data[field.name] === null);
        if (missing.length > 0)
            log(`Not found: ${missing.map((field) => field.name).join(', ')}`);
        return { output: { data, complete: missing.length === 0 } };
    }),
};
export function registerAINodes() {
    registry.registerNode(generateNode);
    registry.registerNode(classifyNode);
    registry.registerNode(extractNode);
}
