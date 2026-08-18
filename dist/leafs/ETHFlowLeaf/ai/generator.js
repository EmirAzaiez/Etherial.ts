// ──────────────────────────────────────────────────────────────────────────
// "Every morning at 8, remind tomorrow's appointments" → a graph on the canvas.
//
// This does not run anything. It produces a draft the user then sees, edits and
// enables, which is what makes an unreliable generator acceptable: the worst
// case is a canvas that needs rearranging, not a notification nobody asked for.
//
// The catalogue handed to the model is the real registry, so a step it invents
// is caught here and dropped rather than saved as a flow that fails at 8am.
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
import { validateFlow } from '../engine/validate.js';
import { listCollections, collectionLabel } from '../registry/admin.js';
import { complete, parseJSON } from './provider.js';
/** One field, in as few characters as still describe it. */
function describeField(field) {
    var _a, _b;
    const bits = [`${field.name}: ${field.type}`];
    if (field.required)
        bits.push('required');
    if ((_a = field.options) === null || _a === void 0 ? void 0 : _a.length) {
        const values = field.options.slice(0, 12).map((o) => o.value).join('|');
        bits.push(`one of ${values}${field.options.length > 12 ? '|…' : ''}`);
    }
    if ((_b = field.relation) === null || _b === void 0 ? void 0 : _b.collection)
        bits.push(`→ ${field.relation.collection}`);
    return bits.join(', ');
}
/**
 * The palette, as text.
 *
 * Trimmed hard on purpose: a project with forty collections has a schema far
 * larger than the instruction, and a model given ten thousand lines of field
 * definitions writes worse graphs than one given the shape of the problem.
 */
function catalogue() {
    var _a, _b, _c;
    const lines = [];
    lines.push('## Triggers');
    for (const trigger of registry.listTriggers()) {
        const config = (_a = registry.serializeTrigger(trigger).config) !== null && _a !== void 0 ? _a : [];
        const configText = config.length ? ` — config: ${config.map(describeField).join('; ')}` : '';
        lines.push(`- ${trigger.id}: ${trigger.label}${configText}`);
    }
    lines.push('');
    lines.push('## Steps');
    for (const node of registry.listNodes()) {
        const serialized = registry.serializeNode(node);
        const configText = serialized.config.length
            ? ` — config: ${serialized.config.map(describeField).join('; ')}`
            : '';
        const branches = ((_b = serialized.branches) === null || _b === void 0 ? void 0 : _b.length)
            ? ` — branches: ${serialized.branches.map((b) => b.id).join(', ')}`
            : serialized.branchesFromConfig
                ? ` — branches: one per row of "${serialized.branchesFromConfig}", named case_0, case_1, …, plus "default"`
                : '';
        lines.push(`- ${node.id}: ${node.label}${branches}${configText}`);
    }
    const collections = listCollections();
    if (collections.length > 0) {
        lines.push('');
        lines.push('## Collections');
        for (const collection of collections) {
            const fields = ((_c = collection.fields) !== null && _c !== void 0 ? _c : [])
                .slice(0, 25)
                .map((f) => f.name)
                .join(', ');
            lines.push(`- ${collection.name} (${collectionLabel(collection)}): ${fields}`);
        }
    }
    return lines.join('\n');
}
const SYSTEM = `You design automations for a back-office. You answer with JSON and nothing else.

Answer shape:
{
  "name": "short name",
  "description": "one sentence",
  "trigger_id": "<an id from ## Triggers>",
  "trigger_config": { ... },
  "nodes": [ { "id": "n1", "type": "<an id from ## Steps>", "config": { ... } } ],
  "edges": [ { "source": "trigger", "target": "n1" },
             { "source": "n1", "target": "n2", "branch": "true" } ],
  "notes": "anything the user still has to fill in"
}

Rules:
- The entry node is always called "trigger". Every other node needs its own id.
- Use only trigger ids and step ids that appear in the catalogue. Never invent one.
- An edge leaving a branching step must name the branch it leaves from.
- Values may contain {{record.field}}, {{steps.<node id>.<key>}}, {{now.date}},
  {{item.field}} inside a loop. Dates read better through a filter:
  {{record.starts_at | date:"DD/MM HH:mm"}}.
- A repeating trigger that acts on the same record over and over must set
  dedup_mode, or it will act every tick. once_per_record for a reminder that
  goes out once; once_per_day for a daily digest.
- Leave a config value out rather than guessing an id, an email address or a
  collection that is not in the catalogue. Say so in "notes" instead.
- Prefer few steps. A condition the trigger can already express is a step the
  user has to understand for nothing.`;
/**
 * Positions the graph.
 *
 * Depth-first from the trigger, one column per branch: the point is a canvas a
 * human can read on arrival, not an optimal layout. Anything the walk never
 * reaches is parked below, where it is visible rather than stacked at the
 * origin under another node.
 */
function layout(nodes, edges) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const placed = new Set();
    let nextColumn = 0;
    const walk = (id, depth, column) => {
        const node = byId.get(id);
        if (!node || placed.has(id))
            return;
        placed.add(id);
        node.position = { x: column * 340, y: depth * 170 };
        const children = edges.filter((edge) => edge.source === id);
        children.forEach((edge, index) => {
            // The first child stays in the column; each extra branch opens a new
            // one to the right, so a two-way condition reads as two columns.
            const childColumn = index === 0 ? column : ++nextColumn;
            walk(edge.target, depth + 1, childColumn);
        });
    };
    walk('trigger', 0, 0);
    let orphanRow = 0;
    for (const node of nodes) {
        if (placed.has(node.id))
            continue;
        node.position = { x: -360, y: orphanRow++ * 170 };
    }
}
export function generateFlow(prompt, existing) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const context = ((_a = existing === null || existing === void 0 ? void 0 : existing.nodes) === null || _a === void 0 ? void 0 : _a.length)
            ? `\n\nThe user is editing this automation. Return the whole thing, changed:\n${JSON.stringify(existing)}`
            : '';
        const answer = yield complete({
            system: SYSTEM,
            prompt: `${catalogue()}\n\n## Request\n${prompt}${context}`,
            json: true,
            maxTokens: 4000,
            temperature: 0.2,
        });
        const parsed = parseJSON(answer);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error('The generator did not return a usable automation. Try rephrasing the request.');
        }
        const warnings = [];
        const triggerId = String((_b = parsed.trigger_id) !== null && _b !== void 0 ? _b : '');
        const trigger = registry.getTrigger(triggerId);
        if (!trigger) {
            throw new Error(`The generator picked a trigger that does not exist ("${triggerId || 'none'}").`);
        }
        const nodes = [
            {
                id: 'trigger',
                kind: 'trigger',
                type: triggerId,
                config: typeof parsed.trigger_config === 'object' && parsed.trigger_config ? parsed.trigger_config : {},
                position: { x: 0, y: 0 },
            },
        ];
        const kept = new Set(['trigger']);
        for (const raw of Array.isArray(parsed.nodes) ? parsed.nodes : []) {
            const id = String((_c = raw === null || raw === void 0 ? void 0 : raw.id) !== null && _c !== void 0 ? _c : '').trim();
            const type = String((_d = raw === null || raw === void 0 ? void 0 : raw.type) !== null && _d !== void 0 ? _d : '').trim();
            if (!id || id === 'trigger' || kept.has(id))
                continue;
            if (!registry.getNode(type)) {
                warnings.push(`Dropped step "${id}": there is no "${type}" step.`);
                continue;
            }
            nodes.push({
                id,
                kind: 'node',
                type,
                config: typeof raw.config === 'object' && raw.config ? raw.config : {},
                position: { x: 0, y: 0 },
                label: raw.label ? String(raw.label) : undefined,
            });
            kept.add(id);
        }
        const edges = [];
        const seen = new Set();
        for (const raw of Array.isArray(parsed.edges) ? parsed.edges : []) {
            const source = String((_e = raw === null || raw === void 0 ? void 0 : raw.source) !== null && _e !== void 0 ? _e : '');
            const target = String((_f = raw === null || raw === void 0 ? void 0 : raw.target) !== null && _f !== void 0 ? _f : '');
            if (!kept.has(source) || !kept.has(target) || source === target)
                continue;
            const branch = (raw === null || raw === void 0 ? void 0 : raw.branch) ? String(raw.branch) : undefined;
            const signature = `${source}:${branch !== null && branch !== void 0 ? branch : ''}→${target}`;
            if (seen.has(signature))
                continue;
            seen.add(signature);
            edges.push({ id: `e_${edges.length + 1}`, source, target, branch });
        }
        layout(nodes, edges);
        const graph = { nodes, edges };
        return {
            name: String((_g = parsed.name) !== null && _g !== void 0 ? _g : 'Untitled automation').slice(0, 120),
            description: String((_h = parsed.description) !== null && _h !== void 0 ? _h : ''),
            trigger_id: triggerId,
            trigger_config: nodes[0].config,
            graph,
            notes: parsed.notes ? String(parsed.notes) : undefined,
            warnings,
            issues: validateFlow(triggerId, graph),
        };
    });
}
