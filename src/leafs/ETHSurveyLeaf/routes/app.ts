import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { SurveyResponse } from '../models/SurveyResponse.js'
import { surveyOf } from '../services/invitations.js'
import { kindOf, languageOf, localize, scaleOf } from '../services/options.js'
import { state } from '../services/state.js'

type AuthedRequest = Request & { user: any }

function userIdOf(req: AuthedRequest): number {
    return Number(typeof req.user?.get === 'function' ? req.user.get('id') : req.user?.id)
}

/** The app's language: `?locale=`, then the app's header, then the phone's. */
function localeOf(req: Request): string {
    return (
        languageOf(req.query?.locale) ??
        languageOf(req.headers['x-app-locale']) ??
        languageOf(req.headers['accept-language']) ??
        state.config.defaultLocale ??
        'en'
    )
}

async function ownRow(req: AuthedRequest) {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return null
    return SurveyResponse.findOne({ where: { id, user_id: userIdOf(req) } })
}

function clip(value: unknown, max: number): string | null {
    if (value === undefined || value === null) return null
    const s = String(value).trim()
    return s ? s.slice(0, max) : null
}

@Controller()
export default class ETHSurveyAppController {
    /**
     * GET /surveys/pending
     *
     * The question waiting for the signed-in person, worded in their language,
     * or `null`. One at a time, the oldest first.
     */
    @Get('/surveys/pending')
    @ShouldBeAuthenticated()
    async pending(req: AuthedRequest, res: Response): Promise<any> {
        const now = new Date()
        const known = (state.config.surveys ?? []).map((s) => s.key)
        const row = known.length
            ? await SurveyResponse.findOne({
                  where: {
                      user_id: userIdOf(req),
                      status: 'pending',
                      survey: known,
                      available_at: { [Op.lte]: now },
                      expires_at: { [Op.gt]: now },
                  } as any,
                  order: [['available_at', 'ASC']],
              })
            : null
        const survey = row && surveyOf(row.survey)
        if (!row || !survey) return (res as any).success({ status: 200, data: null })

        const locale = localeOf(req)
        const fallback = state.config.defaultLocale ?? 'en'
        const kind = kindOf(survey)
        return (res as any).success({
            status: 200,
            data: {
                id: row.id,
                survey: survey.key,
                kind,
                scale: scaleOf(kind),
                question: localize(survey.question, locale, fallback),
                comment_prompt: localize(survey.commentPrompt, locale, fallback),
                low_label: localize(survey.lowLabel, locale, fallback),
                high_label: localize(survey.highLabel, locale, fallback),
                subject_label: row.subject_label,
                locale,
            },
        })
    }

    /** POST /surveys/:id/answer { score, comment? } */
    @Post('/surveys/:id/answer')
    @ShouldBeAuthenticated()
    async answer(req: AuthedRequest, res: Response): Promise<any> {
        const row = await ownRow(req)
        const survey = row && surveyOf(row.survey)
        if (!row || !survey) return (res as any).error({ status: 404, errors: ['not_found'] })
        if (row.status === 'answered') return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
        if (row.status !== 'pending') return (res as any).error({ status: 410, errors: ['closed'] })

        const { min, max } = scaleOf(kindOf(survey))
        const score = Number(req.body?.score)
        if (!Number.isInteger(score) || score < min || score > max) {
            return (res as any).error({ status: 422, errors: [`score must be a whole number from ${min} to ${max}`] })
        }
        // Answered even a little late: the person took the time.
        await row.update({
            status: 'answered',
            score,
            comment: clip(req.body?.comment, 2000),
            locale: localeOf(req),
            platform: clip(req.headers['x-app-platform'], 16),
            app_version: clip(req.headers['x-app-version'], 32),
            answered_at: new Date(),
        } as any)
        return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
    }

    /** POST /surveys/:id/dismiss — "Not now": the question is not asked again. */
    @Post('/surveys/:id/dismiss')
    @ShouldBeAuthenticated()
    async dismiss(req: AuthedRequest, res: Response): Promise<any> {
        const row = await ownRow(req)
        if (!row) return (res as any).error({ status: 404, errors: ['not_found'] })
        if (row.status === 'pending') await row.update({ status: 'dismissed' } as any)
        return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
    }
}
