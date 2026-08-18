// ──────────────────────────────────────────────────────────────────────────
// "Have we already done this?"
//
// The problem this exists for, in the customer's words: *every ten minutes,
// look for appointments starting within 24 hours and send a reminder*. The
// condition is true at 10:00, and still true at 10:10, and at 10:20 — the same
// appointment matches thirty-six times before it stops matching, and the
// customer receives thirty-six notifications.
//
// The fix is an idempotency key claimed in the database before the run starts.
// Claiming is an INSERT against a unique index, so two workers racing on the
// same appointment produce one winner and one duplicate-key error, with no
// coordination between them. The alternative — reading recent runs and checking
// whether one already covered this record — has a window between the read and
// the write, and that window is exactly where the double send lives.
// ──────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import { Op } from 'sequelize'

import { FlowRunKey } from '../models/FlowRunKey.js'
import { formatDate } from './template.js'
import type { FieldDefinition } from '../types.js'

export type DedupMode = 'always' | 'once_per_record' | 'once_per_day' | 'every_n_hours' | 'custom'

/**
 * The repeat policy, offered under every trigger in the builder.
 *
 * Worth stating plainly in the UI because the default is the dangerous one:
 * `always` is right for "a ticket was answered" and catastrophic for "an
 * appointment starts within 24 hours".
 */
export function dedupFields(): FieldDefinition[] {
    return [
        {
            name: 'dedup_mode',
            type: 'select',
            label: 'Repeat',
            defaultValue: 'always',
            helpText:
                'A trigger that keeps matching the same record — "starts within 24 hours" — needs a limit, or it fires on every check.',
            options: [
                { value: 'always', label: 'Every time it matches' },
                { value: 'once_per_record', label: 'Once per record, ever' },
                { value: 'once_per_day', label: 'Once per record per day' },
                { value: 'every_n_hours', label: 'Once per record every N hours' },
                { value: 'custom', label: 'Once per custom key' },
            ],
        },
        {
            name: 'dedup_hours',
            type: 'number',
            label: 'Hours between repeats',
            defaultValue: 24,
            min: 1,
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'every_n_hours' },
        },
        {
            name: 'dedup_key',
            type: 'string',
            label: 'Key',
            helpText: 'Runs once per distinct value, e.g. {{record.id}}-{{record.status}}.',
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'custom' },
        },
        {
            name: 'dedup_expires_hours',
            type: 'number',
            label: 'Forget the key after (hours)',
            helpText: 'Leave empty to remember forever.',
            showIf: { field: 'dedup_mode', operator: 'eq', value: 'custom' },
        },
    ]
}

export interface DedupPlan {
    key: string
    /** Null means the key is never released — "once, ever". */
    expiresAt: Date | null
}

/**
 * Builds the key for one candidate run, or null when the flow accepts repeats.
 *
 * The time window is folded *into* the key rather than compared against a
 * timestamp: with a `2026-08-19` suffix, "once a day" is the same insert as
 * "once ever", and there is no second code path to get wrong.
 */
export function planDedup(
    triggerConfig: Record<string, any>,
    args: {
        triggerId: string
        recordId?: string | number | null
        render: (template: string) => string
        timezone?: string
        now?: Date
    }
): DedupPlan | null {
    const mode: DedupMode = triggerConfig?.dedup_mode || 'always'
    if (mode === 'always') return null

    const now = args.now ?? new Date()
    const recordId = args.recordId === null || args.recordId === undefined ? 'none' : String(args.recordId)

    switch (mode) {
        case 'once_per_record':
            return { key: shorten(`${args.triggerId}:${recordId}`), expiresAt: null }

        case 'once_per_day': {
            const day = formatDate(now, 'YYYY-MM-DD', args.timezone)
            return {
                key: shorten(`${args.triggerId}:${recordId}:${day}`),
                // Kept a while past the window: the row's only remaining job is to
                // be found by a late tick, and the sweeper reclaims it after.
                expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
            }
        }

        case 'every_n_hours': {
            const hours = Math.max(1, Number(triggerConfig.dedup_hours) || 24)
            const bucket = Math.floor(now.getTime() / (hours * 3600 * 1000))
            return {
                key: shorten(`${args.triggerId}:${recordId}:${hours}h:${bucket}`),
                expiresAt: new Date(now.getTime() + 2 * hours * 3600 * 1000),
            }
        }

        case 'custom': {
            const template = String(triggerConfig.dedup_key || '').trim()
            // An empty custom key would collapse every record onto one row and
            // the flow would run exactly once in its life. Better to let it run.
            if (!template) return null
            const rendered = args.render(template).trim()
            if (!rendered) return null
            const expiresHours = Number(triggerConfig.dedup_expires_hours)
            return {
                key: shorten(`${args.triggerId}:${rendered}`),
                expiresAt: Number.isFinite(expiresHours) && expiresHours > 0
                    ? new Date(now.getTime() + expiresHours * 3600 * 1000)
                    : null,
            }
        }

        default:
            return null
    }
}

/** The column holds 191 characters; anything longer becomes its own digest. */
function shorten(key: string): string {
    if (key.length <= 191) return key
    return `${key.slice(0, 150)}#${createHash('sha1').update(key).digest('hex').slice(0, 32)}`
}

/**
 * Takes the key, or reports that someone else already has it.
 *
 * An expired key is reclaimed in place rather than deleted and re-inserted:
 * the update is conditional on the row still being expired, so a racing worker
 * updates zero rows and backs off.
 */
export async function claim(flowId: number, plan: DedupPlan): Promise<boolean> {
    const now = new Date()

    try {
        await FlowRunKey.create({
            flow_id: flowId,
            key: plan.key,
            expires_at: plan.expiresAt,
            created_at: now,
        } as any)
        return true
    } catch (error: any) {
        const name = error?.name || ''
        const isDuplicate =
            name === 'SequelizeUniqueConstraintError' ||
            error?.original?.code === 'ER_DUP_ENTRY' ||
            error?.original?.code === '23505'

        if (!isDuplicate) throw error

        const [reclaimed] = await FlowRunKey.update(
            { expires_at: plan.expiresAt, created_at: now } as any,
            {
                where: {
                    flow_id: flowId,
                    key: plan.key,
                    expires_at: { [Op.ne]: null, [Op.lt]: now } as any,
                },
            }
        )

        return reclaimed > 0
    }
}

/** Attaches the run to its key, so an operator can see what the key stopped. */
export async function attachRun(flowId: number, key: string, runId: number): Promise<void> {
    try {
        await FlowRunKey.update({ run_id: runId } as any, { where: { flow_id: flowId, key } })
    } catch {
        // Bookkeeping only — never worth failing a successful run over.
    }
}

/** Releases a key whose run never started, so a retry is not blocked by it. */
export async function release(flowId: number, key: string): Promise<void> {
    try {
        await FlowRunKey.destroy({ where: { flow_id: flowId, key, run_id: null as any } })
    } catch {
        // Same: the sweeper will get it.
    }
}

export async function sweepExpired(): Promise<number> {
    return FlowRunKey.destroy({
        where: { expires_at: { [Op.ne]: null, [Op.lt]: new Date() } as any },
    })
}

export async function forgetFlow(flowId: number): Promise<void> {
    await FlowRunKey.destroy({ where: { flow_id: flowId } })
}
