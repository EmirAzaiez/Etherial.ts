// ──────────────────────────────────────────────────────────────────────────
// Branching.
//
// The steps that decide whether the rest of the automation happens at all, and
// which way it goes. Everything here is pure — nothing is sent, nothing is
// written — which is what makes a flow safe to test with the Run button.
// ──────────────────────────────────────────────────────────────────────────

import { registry } from '../registry/Registry.js'
import { OPERATOR_OPTIONS, evaluateExpressions, looseEqual } from '../engine/filters.js'
import { claim, planDedup } from '../engine/dedup.js'
import { renderString } from '../engine/template.js'
import type { NodeDefinition } from '../types.js'

const MATCH_FIELD = {
    name: 'match',
    type: 'select' as const,
    label: 'Match',
    defaultValue: 'all',
    options: [
        { value: 'all', label: 'All of the conditions' },
        { value: 'any', label: 'Any of the conditions' },
    ],
}

export const ifNode: NodeDefinition = {
    id: 'condition.if',
    label: 'If',
    description: 'Splits the automation in two.',
    icon: 'GitBranch',
    category: 'condition',
    config: [
        MATCH_FIELD,
        {
            name: 'conditions',
            type: 'json',
            widget: 'flow-conditions',
            label: 'Conditions',
            defaultValue: [],
            options: OPERATOR_OPTIONS.map((operator) => ({
                value: `operator:${operator.value}`,
                label: operator.label,
            })),
        },
    ],
    branches: [
        { id: 'true', label: 'Yes' },
        { id: 'false', label: 'No' },
    ],
    execute: async ({ config, log }) => {
        const passed = evaluateExpressions(config.conditions, config.match === 'any' ? 'any' : 'all')
        log(passed ? 'Conditions met' : 'Conditions not met', { conditions: config.conditions })
        return { branch: passed ? 'true' : 'false', output: { passed } }
    },
}

export const guardNode: NodeDefinition = {
    id: 'condition.only_if',
    label: 'Only continue if',
    description: 'Stops here unless the conditions hold. The same as an If with nothing on the No side, with less to draw.',
    icon: 'ShieldCheck',
    category: 'condition',
    config: [
        MATCH_FIELD,
        {
            name: 'conditions',
            type: 'json',
            widget: 'flow-conditions',
            label: 'Conditions',
            defaultValue: [],
            options: OPERATOR_OPTIONS.map((operator) => ({
                value: `operator:${operator.value}`,
                label: operator.label,
            })),
        },
    ],
    execute: async ({ config, log }) => {
        const passed = evaluateExpressions(config.conditions, config.match === 'any' ? 'any' : 'all')
        if (!passed) {
            log('Stopped: the conditions were not met')
            return { halt: true, output: { passed } }
        }
        return { output: { passed } }
    },
}

export const switchNode: NodeDefinition = {
    id: 'condition.switch',
    label: 'Switch',
    description: 'Routes on a value — one path per case, plus a fallback.',
    icon: 'Split',
    category: 'condition',
    config: [
        {
            name: 'value',
            type: 'string',
            label: 'Value',
            required: true,
            helpText: 'For instance {{record.status}}.',
        },
        {
            name: 'cases',
            type: 'json',
            widget: 'flow-cases',
            label: 'Cases',
            defaultValue: [],
        },
    ],
    branchesFromConfig: 'cases',
    branches: [{ id: 'default', label: 'Anything else' }],
    execute: async ({ config, log }) => {
        const value = config.value
        const cases: { value: any; label?: string }[] = Array.isArray(config.cases) ? config.cases : []
        const index = cases.findIndex((entry) => looseEqual(value, entry?.value))

        if (index === -1) {
            log(`No case matched "${value}"`)
            return { branch: 'default', output: { value, matched: null } }
        }

        log(`Matched "${cases[index].value}"`)
        // The handle id is positional, so renaming a case in the builder does not
        // silently disconnect the edge that was drawn to it.
        return { branch: `case_${index}`, output: { value, matched: cases[index].value } }
    },
}

export const stopNode: NodeDefinition = {
    id: 'condition.stop',
    label: 'Stop',
    description: 'Ends the automation here, successfully.',
    icon: 'CircleStop',
    category: 'condition',
    config: [
        {
            name: 'reason',
            type: 'string',
            label: 'Reason',
            helpText: 'Shown in the run log — worth filling in, for the day someone asks why nothing happened.',
        },
    ],
    execute: async ({ config, log }) => {
        if (config.reason) log(String(config.reason))
        return { halt: true }
    },
}

export const onceNode: NodeDefinition = {
    id: 'condition.once',
    label: 'Only once per',
    description:
        'Lets the run through the first time it sees a value and diverts it afterwards — a second guard inside the flow, for when the trigger fires legitimately but this branch should not repeat.',
    icon: 'Fingerprint',
    category: 'condition',
    config: [
        {
            name: 'key',
            type: 'string',
            label: 'Key',
            required: true,
            helpText: 'One pass per distinct value, e.g. {{record.customer_id}}.',
        },
        {
            name: 'window',
            type: 'select',
            label: 'Remember for',
            defaultValue: 'forever',
            options: [
                { value: 'forever', label: 'Forever' },
                { value: 'day', label: 'A day' },
                { value: 'hours', label: 'A number of hours' },
            ],
        },
        {
            name: 'hours',
            type: 'number',
            label: 'Hours',
            defaultValue: 24,
            min: 1,
            showIf: { field: 'window', operator: 'eq', value: 'hours' },
        },
    ],
    branches: [
        { id: 'first', label: 'First time' },
        { id: 'again', label: 'Already seen' },
    ],
    execute: async ({ config, context, log }) => {
        const key = String(config.key ?? '').trim()
        if (!key) {
            log('No key given — letting the run through')
            return { branch: 'first' }
        }

        const plan = planDedup(
            {
                dedup_mode: config.window === 'day' ? 'once_per_day' : config.window === 'hours' ? 'every_n_hours' : 'once_per_record',
                dedup_hours: config.hours,
            },
            {
                triggerId: `node:${context.flowId}`,
                recordId: key,
                render: (template) => renderString(template, context),
                timezone: context.timezone,
            }
        )

        if (!plan) return { branch: 'first' }

        const first = await claim(context.flowId, plan)
        log(first ? `First time for "${key}"` : `Already handled "${key}"`)
        return { branch: first ? 'first' : 'again', output: { key, first } }
    },
}

export function registerConditionNodes(): void {
    registry.registerNode(ifNode)
    registry.registerNode(guardNode)
    registry.registerNode(switchNode)
    registry.registerNode(stopNode)
    registry.registerNode(onceNode)
}
