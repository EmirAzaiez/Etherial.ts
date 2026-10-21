import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { SurveyResponse } from '../models/SurveyResponse.js'
import { activeKeys, questionsFor, readAnswers, surveyByKey } from '../services/forms.js'
import { defaultLocaleOf, kindOf, languageOf, scaleOf } from '../services/options.js'
import { state } from '../services/state.js'
import { tellClosed } from '../services/invitations.js'

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
        defaultLocaleOf(state.config)
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
     * The survey waiting for the signed-in person, worded in their language,
     * or `null`. One at a time, the oldest first.
     */
    @Get('/surveys/pending')
    @ShouldBeAuthenticated()
    async pending(req: AuthedRequest, res: Response): Promise<any> {
        const now = new Date()
        // A survey turned off no longer shows the questions still waiting.
        const known = await activeKeys()
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
        const survey = row && (await surveyByKey(row.survey))
        if (!row || !survey?.questions?.length) return (res as any).success({ status: 200, data: null })

        const locale = localeOf(req)
        const kind = kindOf(survey.questions)
        const questions = questionsFor(survey, locale)
        const written = questions.find((q) => q.type === 'text')
        return (res as any).success({
            status: 200,
            data: {
                id: row.id,
                survey: survey.key,
                kind,
                scale: scaleOf(kind),
                questions,
                subject_label: row.subject_label,
                // What it follows, for the app to ask it on that record's page too.
                subject_type: row.subject_type || null,
                subject_id: row.subject_id || null,
                available_at: row.available_at,
                expires_at: row.expires_at,
                locale,
                // Read by the app before several questions: the score, then one comment.
                question: questions[0].label,
                comment_prompt: written?.label ?? null,
                low_label: questions[0].low_label ?? null,
                high_label: questions[0].high_label ?? null,
            },
        })
    }

    /** POST /surveys/:id/answer { answers: { <question id>: value } } — or `{ score, comment? }` from an older app. */
    @Post('/surveys/:id/answer')
    @ShouldBeAuthenticated()
    async answer(req: AuthedRequest, res: Response): Promise<any> {
        const row = await ownRow(req)
        const survey = row && (await surveyByKey(row.survey))
        if (!row || !survey) return (res as any).error({ status: 404, errors: ['not_found'] })
        if (row.status === 'answered') return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
        if (row.status !== 'pending' || !survey.active) return (res as any).error({ status: 410, errors: ['closed'] })

        const read = readAnswers(survey, req.body)
        if ('error' in read) return (res as any).error({ status: 422, errors: [read.error] })
        // Answered even a little late: the person took the time.
        await row.update({
            status: 'answered',
            score: read.score,
            comment: read.comment,
            answers: read.answers,
            locale: localeOf(req),
            platform: clip(req.headers['x-app-platform'], 16),
            app_version: clip(req.headers['x-app-version'], 32),
            answered_at: new Date(),
        } as any)
        void tellClosed(row, 'answered')
        return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
    }

    /** POST /surveys/:id/dismiss — the person does not want to answer: the question is not asked again. */
    @Post('/surveys/:id/dismiss')
    @ShouldBeAuthenticated()
    async dismiss(req: AuthedRequest, res: Response): Promise<any> {
        const row = await ownRow(req)
        if (!row) return (res as any).error({ status: 404, errors: ['not_found'] })
        if (row.status === 'pending') {
            await row.update({ status: 'dismissed' } as any)
            void tellClosed(row, 'dismissed')
        }
        return (res as any).success({ status: 200, data: { id: row.id, status: row.status } })
    }
}
