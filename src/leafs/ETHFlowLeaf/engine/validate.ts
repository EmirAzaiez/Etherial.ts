// What is wrong with this flow.
//
// Checked when it is saved and shown next to the Enable switch, because the
// alternative is finding out from a run that did nothing at two in the morning.
// Errors block enabling; warnings do not — half-drawn is a legitimate state for
// something still being built.

import { registry } from '../registry/Registry.js'
import { resolveConfigSpec } from '../registry/Registry.js'
import { entryNode, findCycle, outgoing } from './graph.js'
import type { FlowGraph } from '../types.js'

export interface ValidationIssue {
    level: 'error' | 'warning'
    nodeId?: string
    message: string
}

export function validateFlow(triggerId: string, graph: FlowGraph | null | undefined): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    const nodes = graph?.nodes ?? []
    const edges = graph?.edges ?? []

    const trigger = registry.getTrigger(triggerId)
    if (!trigger) {
        issues.push({ level: 'error', message: `Unknown trigger "${triggerId}".` })
    }

    const entry = entryNode({ nodes, edges })
    if (!entry) {
        issues.push({ level: 'error', message: 'The automation has no starting point.' })
    } else if (outgoing({ nodes, edges }, entry.id).length === 0) {
        issues.push({
            level: 'warning',
            nodeId: entry.id,
            message: 'Nothing is connected to the trigger, so the automation will do nothing.',
        })
    }

    const ids = new Set<string>()
    for (const node of nodes) {
        if (ids.has(node.id)) {
            issues.push({ level: 'error', nodeId: node.id, message: 'Two steps share the same id.' })
        }
        ids.add(node.id)

        if (node.kind === 'trigger') continue

        const definition = registry.getNode(node.type)
        if (!definition) {
            issues.push({ level: 'error', nodeId: node.id, message: `Unknown step "${node.type}".` })
            continue
        }

        for (const field of resolveConfigSpec(definition.config, node.config ?? {})) {
            if (!field.required) continue
            const value = node.config?.[field.name]
            if (value === undefined || value === null || value === '') {
                issues.push({
                    level: 'error',
                    nodeId: node.id,
                    message: `${definition.label}: "${field.label || field.name}" is missing.`,
                })
            }
        }

        // A branching step with an unconnected handle is the single most common
        // way a flow silently stops halfway.
        const branches = definition.branches ?? []
        if (branches.length > 0 && !definition.branchesFromConfig) {
            const drawn = new Set(outgoing({ nodes, edges }, node.id).map((edge) => edge.branch))
            const missing = branches.filter((branch) => !drawn.has(branch.id))
            if (missing.length > 0 && missing.length < branches.length) {
                issues.push({
                    level: 'warning',
                    nodeId: node.id,
                    message: `${definition.label}: nothing is connected to ${missing
                        .map((branch) => `"${branch.label}"`)
                        .join(' or ')}.`,
                })
            }
        }
    }

    for (const edge of edges) {
        if (!ids.has(edge.source) || !ids.has(edge.target)) {
            issues.push({ level: 'error', message: 'A connection points at a step that no longer exists.' })
        }
    }

    const cycle = findCycle({ nodes, edges })
    if (cycle) {
        issues.push({
            level: 'error',
            nodeId: cycle[0],
            message: `These steps loop back on themselves: ${cycle.join(' → ')}.`,
        })
    }

    return issues
}

export function hasErrors(issues: ValidationIssue[]): boolean {
    return issues.some((issue) => issue.level === 'error')
}
