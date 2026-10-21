import etherial from 'etherial'
import { Op, UniqueConstraintError } from 'sequelize'

import { SurveyResponse } from '../models/SurveyResponse.js'
import { state } from './state.js'
import { SurveyEvent } from './options.js'
import { infoOf, surveyByKey, surveyFor } from './forms.js'

const DAY_MS = 24 * 3600 * 1000

export interface InviteInput {
    /** The survey's key (`survey_forms.key`). */
    survey: string
    user_id: number
    /** What prompted it. Asking twice about the same thing is a no-op. */
    subject?: { type?: string; id?: string | number; label?: string | null }
    /** When it happened. Default now. */
    at?: Date
}

export type InviteResult =
    | { invited: true; id: number }
    | { invited: false; reason: 'unknown_survey' | 'inactive' | 'excluded' | 'cooldown' | 'already_asked' | 'no_user' }

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
    const survey = await surveyByKey(input.survey)
    if (!survey) return { invited: false, reason: 'unknown_survey' }
    if (!survey.active) return { invited: false, reason: 'inactive' }
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
    const opens = new Date(at.getTime() + Math.max(0, survey.delay_minutes ?? 0) * 60 * 1000)
    const closes = new Date(opens.getTime() + Math.max(1, survey.expires_after_days ?? 7) * DAY_MS)
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
        const survey = await surveyByKey(row.survey)
        // Turned off meanwhile: the app no longer shows it, so say nothing.
        if (!survey?.active) continue
        try {
            await notify({ id: row.id, survey: row.survey, user_id: row.user_id, subject_label: row.subject_label }, infoOf(survey))
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

/** Hooks each event on its model. Unknown models are reported, not fatal. */
export function attachEvents(events: SurveyEvent[]) {
    const models = sequelize()?.models ?? {}
    for (const event of events) {
        const Model = models[event.model]
        if (!Model) {
            console.warn(`[ETHSurveyLeaf] Event "${event.key}": no model named ${event.model}`)
            continue
        }
        const on = event.on ?? 'update'
        // Decided before the save: an earlier after-hook of the model may
        // reload the row (Retal's tickets do), and `previous()` then reads
        // the new values.
        const happened = new WeakMap<object, true>()
        Model.addHook('beforeSave', `eth-survey-${event.key}`, (row: any) => {
            happened.delete(row)
            const created = !!row.isNewRecord
            if (created ? on === 'update' : on === 'create') return
            try {
                if (event.when(row, (field: string) => (created ? undefined : row.previous?.(field)))) happened.set(row, true)
            } catch (err: any) {
                console.error(`[ETHSurveyLeaf] Event "${event.key}" on ${event.model} failed:`, err?.message || err)
            }
        })
        Model.addHook('afterSave', `eth-survey-${event.key}`, (row: any, options: any) => {
            if (!happened.delete(row)) return
            // Asked once the change is committed, so a rollback asks nothing.
            const go = () => void fire(event, row)
            if (options?.transaction?.afterCommit) options.transaction.afterCommit(go)
            else go()
        })
    }
}

async function fire(event: SurveyEvent, row: any) {
    try {
        const userId = await event.user(row)
        if (!userId) return
        const value = event.target ? await event.target.value(row) : null
        const survey = await surveyFor(event.key, value === null || value === undefined || value === '' ? null : String(value))
        if (!survey) return
        const label = event.subject ? await event.subject(row) : null
        await invite({
            survey: survey.key,
            user_id: Number(userId),
            subject: { type: event.model, id: row.get?.('id') ?? row.id, label },
        })
    } catch (err: any) {
        console.error(`[ETHSurveyLeaf] Event "${event.key}" on ${event.model} failed:`, err?.message || err)
    }
}
