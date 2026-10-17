import etherial from 'etherial'
import { Op, UniqueConstraintError } from 'sequelize'

import { SurveyResponse } from '../models/SurveyResponse.js'
import { state } from './state.js'
import { SurveyDefinition, SurveyTrigger } from './options.js'

const DAY_MS = 24 * 3600 * 1000

export interface InviteInput {
    survey: string
    user_id: number
    /** What prompted it. Asking twice about the same thing is a no-op. */
    subject?: { type?: string; id?: string | number; label?: string | null }
    /** When it happened. Default now. */
    at?: Date
}

export type InviteResult =
    | { invited: true; id: number }
    | { invited: false; reason: 'unknown_survey' | 'excluded' | 'cooldown' | 'already_asked' | 'no_user' }

export function surveyOf(key: string): SurveyDefinition | undefined {
    return state.config.surveys?.find((s) => s.key === key)
}

function sequelize(): any {
    return (etherial as any).database?.sequelize
}

async function userById(id: number): Promise<any> {
    const model = state.config.users?.model ?? 'User'
    return sequelize()?.models?.[model]?.findByPk(id).catch(() => null)
}

/**
 * Puts a survey to someone. It opens after the survey's delay and closes when
 * it expires. Nobody is asked twice about the same thing, nor more than once
 * per cooldown, whatever the survey.
 */
export async function invite(input: InviteInput): Promise<InviteResult> {
    const survey = surveyOf(input.survey)
    if (!survey) return { invited: false, reason: 'unknown_survey' }
    const userId = Number(input.user_id)
    if (!Number.isInteger(userId) || userId <= 0) return { invited: false, reason: 'no_user' }

    if (state.config.excludeUser) {
        const user = await userById(userId)
        if (user && state.config.excludeUser(user)) return { invited: false, reason: 'excluded' }
    }

    const subjectType = String(input.subject?.type ?? '').slice(0, 64)
    const subjectId = String(input.subject?.id ?? '').slice(0, 64)
    const already = await SurveyResponse.count({
        where: { survey: survey.key, user_id: userId, subject_type: subjectType, subject_id: subjectId },
    })
    if (already) return { invited: false, reason: 'already_asked' }

    const cooldown = state.config.cooldownDays ?? 30
    if (cooldown > 0) {
        const recent = await SurveyResponse.count({
            where: { user_id: userId, created_at: { [Op.gte]: new Date(Date.now() - cooldown * DAY_MS) } } as any,
        })
        if (recent) return { invited: false, reason: 'cooldown' }
    }

    const at = input.at ?? new Date()
    const opens = new Date(at.getTime() + Math.max(0, survey.delayMinutes ?? 0) * 60 * 1000)
    const closes = new Date(opens.getTime() + Math.max(1, survey.expiresAfterDays ?? 7) * DAY_MS)
    try {
        const row = await SurveyResponse.create({
            survey: survey.key,
            user_id: userId,
            subject_type: subjectType,
            subject_id: subjectId,
            subject_label: input.subject?.label ? String(input.subject.label).slice(0, 255) : null,
            status: 'pending',
            available_at: opens,
            expires_at: closes,
        } as any)
        if (opens.getTime() <= Date.now()) void notifyDue()
        return { invited: true, id: row.id }
    } catch (err) {
        // Two hooks raced on the same change: the other one asked.
        if (err instanceof UniqueConstraintError) return { invited: false, reason: 'already_asked' }
        throw err
    }
}

/**
 * Tells people their question is open, once each. A row is claimed before
 * `notify` runs, so two servers never send the same push.
 */
export async function notifyDue(): Promise<void> {
    const notify = state.config.notify
    if (!notify) return
    const now = new Date()
    const due = await SurveyResponse.findAll({
        where: { status: 'pending', notified_at: null, available_at: { [Op.lte]: now }, expires_at: { [Op.gt]: now } } as any,
        order: [['available_at', 'ASC']],
        limit: 100,
    })
    for (const row of due) {
        const [claimed] = await SurveyResponse.update({ notified_at: now } as any, { where: { id: row.id, notified_at: null } as any })
        if (!claimed) continue
        const survey = surveyOf(row.survey)
        if (!survey) continue
        try {
            await notify({ id: row.id, survey: row.survey, user_id: row.user_id, subject_label: row.subject_label }, survey)
        } catch (err: any) {
            console.error(`[ETHSurveyLeaf] Could not tell user ${row.user_id} about survey ${row.survey}:`, err?.message || err)
        }
    }
}

/** Questions left open past their date are closed, so the lists and the response rate stay right. */
export async function expireDue(): Promise<number> {
    const [count] = await SurveyResponse.update({ status: 'expired' } as any, {
        where: { status: 'pending', expires_at: { [Op.lte]: new Date() } } as any,
    })
    return count
}

/** Hooks each trigger on its model. Unknown models are reported, not fatal. */
export function attachTriggers(triggers: SurveyTrigger[]) {
    const models = sequelize()?.models ?? {}
    for (const trigger of triggers) {
        const Model = models[trigger.model]
        if (!Model) {
            console.warn(`[ETHSurveyLeaf] Trigger for "${trigger.survey}": no model named ${trigger.model}`)
            continue
        }
        if (!surveyOf(trigger.survey)) {
            console.warn(`[ETHSurveyLeaf] Trigger on ${trigger.model}: no survey named "${trigger.survey}"`)
            continue
        }
        const on = trigger.on ?? 'update'
        const run = (created: boolean) => (row: any, options: any) => {
            // Decided now: `previous()` forgets the old values once the save is done.
            let asked = false
            try {
                asked = trigger.when(row, (field: string) => (created ? undefined : row.previous?.(field)))
            } catch (err: any) {
                console.error(`[ETHSurveyLeaf] Trigger for "${trigger.survey}" on ${trigger.model} failed:`, err?.message || err)
            }
            if (!asked) return
            // Asked once the change is committed, so a rollback asks nothing.
            const go = () => void fire(trigger, row)
            if (options?.transaction?.afterCommit) options.transaction.afterCommit(go)
            else go()
        }
        if (on === 'create' || on === 'both') Model.addHook('afterCreate', `eth-survey-${trigger.survey}`, run(true))
        if (on === 'update' || on === 'both') Model.addHook('afterUpdate', `eth-survey-${trigger.survey}`, run(false))
    }
}

async function fire(trigger: SurveyTrigger, row: any) {
    try {
        const userId = await trigger.user(row)
        if (!userId) return
        const label = trigger.subject ? await trigger.subject(row) : null
        await invite({
            survey: trigger.survey,
            user_id: Number(userId),
            subject: { type: trigger.model, id: row.get?.('id') ?? row.id, label },
        })
    } catch (err: any) {
        console.error(`[ETHSurveyLeaf] Trigger for "${trigger.survey}" on ${trigger.model} failed:`, err?.message || err)
    }
}
