// ──────────────────────────────────────────────────────────────────────────
// Running an admin action from a flow.
//
// Every button the back-office shows on a record — approve, resend, cancel,
// sync — is an entry in the admin's ActionRegistry, with a label, a form and a
// handler that has already been reviewed and shipped. This step makes all of
// them available to automations without registering a single thing: the
// customer picks the action, and its own form appears underneath.
//
// It is the answer to "toutes les actions sont créables via ce qu'on a" — adding
// an action to the admin adds it to the automation builder in the same commit.
// ──────────────────────────────────────────────────────────────────────────

import { registry } from '../registry/Registry.js'
import { adminLeaf, getCollection, getModel, listCollections, collectionLabelPlural } from '../registry/admin.js'
import type { FieldDefinition, NodeDefinition } from '../types.js'

function actionsOf(collectionName: string | undefined): { value: string; label: string }[] {
    const collection = collectionName ? getCollection(collectionName) : null
    const leaf = adminLeaf()
    if (!collection || !leaf) return []

    return (collection.actions ?? []).map((name: string) => {
        const action = leaf.actions?.get?.(name)
        return { value: name, label: action?.meta?.label || name }
    })
}

/**
 * The chosen action's own form, prefixed so it cannot collide with this step's
 * own configuration — an action with a field called `collection` would otherwise
 * quietly overwrite the collection picker.
 */
function actionForm(collectionName: string | undefined, actionName: string | undefined): FieldDefinition[] {
    const leaf = adminLeaf()
    if (!leaf || !collectionName || !actionName) return []

    const serialized = leaf.actions?.serialize?.(actionName)
    if (!serialized?.form) return []

    return serialized.form.map((field: FieldDefinition) => ({
        ...field,
        name: `input_${field.name}`,
        // Every value here may be a template, and the run supplies it, so the
        // admin's own "required" would only block saving a valid flow.
        required: false,
    }))
}

export const runActionNode: NodeDefinition = {
    id: 'action.run',
    label: 'Run an action',
    description: 'Runs one of the buttons the back-office already offers on a record.',
    icon: 'Zap',
    category: 'action',
    available: () => adminLeaf() !== null,
    config: (config) => [
        {
            name: 'collection',
            type: 'select',
            label: 'On',
            required: true,
            options: listCollections()
                .filter((collection) => (collection.actions ?? []).length > 0)
                .map((collection) => ({
                    value: collection.name,
                    label: collectionLabelPlural(collection),
                })),
        },
        {
            name: 'action',
            type: 'select',
            label: 'Action',
            required: true,
            options: actionsOf(config?.collection),
            showIf: { field: 'collection', operator: 'truthy' },
        },
        {
            name: 'record_id',
            type: 'string',
            label: 'Record',
            defaultValue: '{{record.id}}',
            showIf: { field: 'action', operator: 'truthy' },
        },
        ...actionForm(config?.collection, config?.action),
    ],
    branches: [
        { id: 'ok', label: 'Succeeded' },
        { id: 'error', label: 'Failed' },
    ],
    output: [
        { key: 'success', label: 'Succeeded', type: 'boolean' },
        { key: 'data', label: 'Result', type: 'object' },
        { key: 'error', label: 'Error', type: 'string' },
    ],
    execute: async ({ config, context, log }) => {
        const leaf = adminLeaf()
        if (!leaf) throw new Error('The admin panel is not installed in this project.')

        const collectionName = String(config.collection ?? '')
        const actionName = String(config.action ?? '')
        const collection = getCollection(collectionName)
        const model = getModel(collectionName)

        if (!collection || !model) throw new Error(`Unknown collection "${collectionName}"`)
        if (!leaf.actions?.has?.(actionName)) throw new Error(`Unknown action "${actionName}"`)

        const record = config.record_id ? await model.findByPk(config.record_id) : null
        if (config.record_id && !record) {
            log(`No record #${config.record_id}`)
            return { branch: 'error', output: { success: false, error: 'Record not found' } }
        }

        const input: Record<string, any> = {}
        for (const [key, value] of Object.entries(config)) {
            if (key.startsWith('input_')) input[key.slice(6)] = value
        }

        // Actions are written against an Express request. There is none here, so
        // they get one that carries the truth: the automation ran it, on behalf
        // of whoever the run belongs to.
        const request: any = {
            user: null,
            body: input,
            params: {},
            query: {},
            headers: {},
            flow: { id: context.flowId, name: context.flowName, runId: context.runId },
        }

        const result = await leaf.actions.execute(actionName, record, input, request, {
            collection,
            model,
        })

        if (result?.success) {
            log(`${actionName} ran`)
            return { branch: 'ok', output: { success: true, data: result.data ?? null } }
        }

        log(`${actionName} failed: ${result?.error ?? 'unknown error'}`)
        return { branch: 'error', output: { success: false, error: result?.error ?? 'Unknown error' } }
    },
}

export function registerActionNodes(): void {
    registry.registerNode(runActionNode)
}
