// ──────────────────────────────────────────────────────────────────────────
// Each person's conversations, with the leaf's `history` on: every answered
// turn is added to the conversation it belongs to, and what the person then
// decided on a proposed change is written beside it. Everything here is
// scoped by the owner's id: nobody reads, renames or deletes another's.
// ──────────────────────────────────────────────────────────────────────────

import { Op } from 'sequelize'

import { AssistantConversation } from '../models/AssistantConversation.js'
import { keepDaysOf } from './options.js'
import type { Proposal } from './proposals.js'
import type { AskInput, AskOutput } from './run.js'
import { state } from './state.js'

/** Past this, the oldest turns go: the model reads the last few anyway. */
const MAX_TURNS = 100
const MAX_LISTED = 100
const MAX_TITLE = 200
const PURGE_EVERY = 3600 * 1000

/** `filled`: put into the form on their screen, not saved — what they do there is theirs. */
export type Decision = 'confirmed' | 'cancelled' | 'failed' | 'filled'
export const DECISIONS: Decision[] = ['confirmed', 'cancelled', 'failed', 'filled']

export interface StoredProposal extends Proposal {
    status?: Decision
    error?: string
    /** The record a confirmed create made. */
    createdId?: string | number
    decidedAt?: string
}

export interface StoredTurn {
    id: string
    task: string
    prompt: string
    context?: AskInput['context']
    where?: string
    language?: string
    answer: { answer: string; steps: AskOutput['steps']; model: string }
    proposals?: StoredProposal[]
    at: string
}

const ownedBy = (userId: number, id: unknown) => ({ id: Number(id), user_id: userId })

function titleOf(input: AskInput, where?: string): string {
    const prompt = [...input.messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? ''
    const base =
        input.task === 'summarize' ? `Summary${where ? ` of ${where}` : ''}` : input.task === 'draft' ? `Drafted reply${where ? ` for ${where}` : ''}` : prompt
    const title = (base || 'Conversation').replace(/\s+/g, ' ')
    return title.length > 80 ? `${title.slice(0, 80)}…` : title
}

let lastPurge = 0

/** Conversations left alone past `keepDays`, deleted at most once an hour, by whichever server saves one. */
async function purgeOld(): Promise<void> {
    const days = keepDaysOf(state.config)
    if (!days || Date.now() - lastPurge < PURGE_EVERY) return
    lastPurge = Date.now()
    try {
        await AssistantConversation.destroy({ where: { updated_at: { [Op.lt]: new Date(Date.now() - days * 24 * 3600 * 1000) } } as any })
    } catch (err: any) {
        console.error('[ETHAssistantLeaf] Could not purge old conversations:', err?.message || err)
    }
}

/** Where the question was asked, without what the form or the canvas held then. */
function keptContext({ form, flow, ...context }: NonNullable<AskInput['context']>): NonNullable<AskInput['context']> {
    return { ...context, ...(flow ? { flow: { ...(flow.id ? { id: flow.id } : {}), ...(flow.name ? { name: flow.name } : {}) } } : {}) }
}

/**
 * Adds an answered turn to the person's conversation — a new one when none is
 * named, or when the one named is not theirs (or no longer exists). Returns
 * its id; null when it could not be saved, which never fails the answer.
 */
export async function saveTurn(userId: number, input: AskInput, output: AskOutput, conversationId?: number, where?: string): Promise<number | null> {
    const turn: StoredTurn = {
        id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        task: input.task,
        prompt: [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '',
        ...(input.context ? { context: keptContext(input.context) } : {}),
        ...(where ? { where } : {}),
        ...(input.language ? { language: input.language } : {}),
        answer: { answer: output.answer, steps: output.steps, model: output.model },
        ...(output.proposals?.length ? { proposals: output.proposals } : {}),
        at: new Date().toISOString(),
    }
    try {
        const existing = conversationId ? await AssistantConversation.findOne({ where: ownedBy(userId, conversationId) as any }) : null
        if (existing) {
            const turns = [...(Array.isArray(existing.turns) ? existing.turns : []), turn].slice(-MAX_TURNS)
            await existing.update({ turns } as any)
            return existing.id
        }
        const created = await AssistantConversation.create({ user_id: userId, title: titleOf(input, where), turns: [turn] } as any)
        void purgeOld()
        return created.id
    } catch (err: any) {
        console.error('[ETHAssistantLeaf] Could not save a conversation:', err?.message || err)
        return null
    }
}

export async function listConversations(userId: number, search?: string) {
    const where: any = { user_id: userId }
    if (search) {
        const like = AssistantConversation.sequelize?.getDialect() === 'postgres' ? Op.iLike : Op.like
        where.title = { [like]: `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` }
    }
    const rows = await AssistantConversation.findAll({
        where,
        order: [['updated_at', 'DESC']],
        limit: MAX_LISTED,
    })
    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        turns: Array.isArray(row.turns) ? row.turns.length : 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

export async function getConversation(userId: number, id: unknown) {
    const row = await AssistantConversation.findOne({ where: ownedBy(userId, id) as any })
    if (!row) return null
    return { id: row.id, title: row.title, turns: Array.isArray(row.turns) ? row.turns : [], created_at: row.created_at, updated_at: row.updated_at }
}

export async function renameConversation(userId: number, id: unknown, title: string): Promise<boolean> {
    const [count] = await AssistantConversation.update({ title: title.slice(0, MAX_TITLE) } as any, { where: ownedBy(userId, id) as any })
    return count > 0
}

export async function deleteConversation(userId: number, id: unknown): Promise<boolean> {
    return (await AssistantConversation.destroy({ where: ownedBy(userId, id) as any })) > 0
}

/** What the person decided on one proposal; false when no such proposal is theirs. */
export async function recordDecision(
    userId: number,
    id: unknown,
    proposalId: string,
    decision: { status: Decision; error?: string; createdId?: string | number }
): Promise<boolean> {
    const row = await AssistantConversation.findOne({ where: ownedBy(userId, id) as any })
    if (!row || !Array.isArray(row.turns)) return false
    let found = false
    const turns = row.turns.map((turn: StoredTurn) => {
        if (!turn?.proposals?.some((p) => p.id === proposalId)) return turn
        found = true
        return {
            ...turn,
            proposals: turn.proposals.map((p) =>
                p.id === proposalId
                    ? {
                          ...p,
                          status: decision.status,
                          ...(decision.error ? { error: decision.error.slice(0, 500) } : {}),
                          ...(decision.createdId !== undefined ? { createdId: decision.createdId } : {}),
                          decidedAt: new Date().toISOString(),
                      }
                    : p
            ),
        }
    })
    if (!found) return false
    await row.update({ turns } as any)
    return true
}
