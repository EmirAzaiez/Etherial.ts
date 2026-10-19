// ──────────────────────────────────────────────────────────────────────────
// The heartbeat.
//
// One timer, aligned to the top of the minute, doing four things: firing the
// schedules that are due, waking the runs that finished waiting, refreshing the
// cache the model hooks consult, and taking out the rubbish.
//
// Aligned rather than "every 60 seconds from whenever the process started",
// because a flow set to run at 09:00 should run at 09:00 and not at 09:00:43 on
// this deploy and 09:00:12 on the next.
//
// With several servers up, every one of them ticks. The listener cache is per
// process, so each refreshes its own; the rest — schedules, waiting runs,
// housekeeping — is done by one server per tick, under a lease in the database.
// The alignment is what makes that lease work: every server fires within a
// second or so of the boundary, the first takes the lease for most of the
// interval, and the others find it held.
// ──────────────────────────────────────────────────────────────────────────

import { Op } from 'sequelize'

import { runExclusive } from '../../../components/database/lock.js'
import { leafConfig } from '../config.js'
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js'
import { runScheduleTick } from '../triggers/schedule.js'
import { resumeDueRuns } from '../engine/fire.js'
import { refreshListeners } from '../engine/listeners.js'
import { sweepExpired } from '../engine/dedup.js'

let timer: NodeJS.Timeout | null = null
let running = false
let ticks = 0

const HOUR = 3600 * 1000

export interface TickOptions {
    /**
     * Do the shared work only if this server takes the tick's lease, held this
     * many ms. The ticker passes it. Without it the pass runs regardless — a
     * test, or a project driving the schedule with its own cron on one machine;
     * one with several should pass it too.
     */
    leaseMs?: number
}

/**
 * One pass. Exported so it can be triggered by hand — from a test, or from a
 * project that would rather drive the schedule with its own cron.
 */
export async function tick(now = new Date(), options: TickOptions = {}): Promise<void> {
    if (running) {
        // The previous pass has not finished. Skipping is the right answer: the
        // work is idempotent and will be picked up next minute, whereas two
        // overlapping passes make every "is this due" check race.
        console.warn('[ETHFlowLeaf] Previous tick still running, skipping this one')
        return
    }

    running = true
    ticks += 1

    try {
        // Every server: this process's model hooks read this cache.
        await refreshListeners()

        const leaseMs = options.leaseMs
        if (!leaseMs) {
            await runScheduleTick(now)
            await resumeDueRuns()
            // Housekeeping is hourly — it is not urgent, and it takes locks.
            if (ticks % 60 === 1) await housekeeping()
            return
        }

        // One server per tick. The schedules claim their minute and the runs
        // their row, so a second pass would do no harm, only the work twice.
        await runExclusive('eth_flow.tick', { ttlMs: leaseMs, release: false }, async () => {
            await runScheduleTick(now)
            await resumeDueRuns()
        })
        // Its own lease rather than this process's tick count: the server that
        // wins a given tick changes from one minute to the next.
        await runExclusive('eth_flow.housekeeping', { ttlMs: HOUR - 2 * 60 * 1000, release: false }, housekeeping)
    } catch (error) {
        console.error('[ETHFlowLeaf] Tick failed:', error)
    } finally {
        running = false
    }
}

async function housekeeping(): Promise<void> {
    await sweepExpired()
    await pruneRuns()
}

/** Drops old finished runs. Waiting ones are never touched — they are pending work. */
async function pruneRuns(): Promise<void> {
    const days = leafConfig().retentionDays
    if (!days) return

    const before = new Date(Date.now() - days * 24 * 3600 * 1000)

    await FlowRun.destroy({
        where: {
            status: { [Op.in]: [FlowRunStatus.SUCCESS, FlowRunStatus.FAILED] } as any,
            created_at: { [Op.lt]: before } as any,
        },
    })
}

/**
 * Arms the timer for the boundary `slot`, then the next one from there.
 *
 * Re-aimed at each boundary rather than a `setInterval`: an interval slips by
 * the event loop's lag on every turn, and after weeks of uptime two servers
 * would tick tens of seconds apart — one past the other's lease, the minute
 * run twice, or a 09:00 schedule checked at 09:00:50.
 */
function arm(slot: number, interval: number, leaseMs: number): void {
    timer = setTimeout(() => {
        // A timer can fire a hair before its boundary: the pass is the slot's.
        void tick(new Date(Math.max(Date.now(), slot)), { leaseMs })

        let next = slot + interval
        // Asleep for a while (a suspended laptop, a blocked loop): no replaying
        // every missed minute, just the next boundary.
        if (next <= Date.now()) next = Math.floor(Date.now() / interval) * interval + interval
        arm(next, interval, leaseMs)
    }, Math.max(0, slot - Date.now()))
    // Node holds the process open for a timer, which would keep a CLI
    // command alive forever after it has finished its work.
    timer.unref?.()
}

export function startTicker(): void {
    if (timer) return

    const everyMinutes = Math.max(1, leafConfig().tickIntervalMinutes ?? 1)
    const interval = everyMinutes * 60 * 1000
    const first = Math.floor(Date.now() / interval) * interval + interval
    // Most of the interval: long enough that a server whose clock or timer is
    // a few seconds behind finds this tick taken, short enough to have expired
    // by the next boundary.
    const leaseMs = Math.max(interval / 2, interval - 15 * 1000)

    arm(first, interval, leaseMs)

    console.log(
        `[ETHFlowLeaf] Ticker starting in ${Math.round((first - Date.now()) / 1000)}s, then every ${everyMinutes} minute(s)`
    )
}

export function stopTicker(): void {
    if (timer) clearTimeout(timer)
    timer = null
}
