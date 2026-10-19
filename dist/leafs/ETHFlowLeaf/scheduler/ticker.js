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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
import { runExclusive } from '../../../components/database/lock.js';
import { leafConfig } from '../config.js';
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js';
import { runScheduleTick } from '../triggers/schedule.js';
import { resumeDueRuns } from '../engine/fire.js';
import { refreshListeners } from '../engine/listeners.js';
import { sweepExpired } from '../engine/dedup.js';
let timer = null;
let running = false;
let ticks = 0;
const HOUR = 3600 * 1000;
/**
 * One pass. Exported so it can be triggered by hand — from a test, or from a
 * project that would rather drive the schedule with its own cron.
 */
export function tick() {
    return __awaiter(this, arguments, void 0, function* (now = new Date(), options = {}) {
        if (running) {
            // The previous pass has not finished. Skipping is the right answer: the
            // work is idempotent and will be picked up next minute, whereas two
            // overlapping passes make every "is this due" check race.
            console.warn('[ETHFlowLeaf] Previous tick still running, skipping this one');
            return;
        }
        running = true;
        ticks += 1;
        try {
            // Every server: this process's model hooks read this cache.
            yield refreshListeners();
            const leaseMs = options.leaseMs;
            if (!leaseMs) {
                yield runScheduleTick(now);
                yield resumeDueRuns();
                // Housekeeping is hourly — it is not urgent, and it takes locks.
                if (ticks % 60 === 1)
                    yield housekeeping();
                return;
            }
            // One server per tick. The schedules claim their minute and the runs
            // their row, so a second pass would do no harm, only the work twice.
            yield runExclusive('eth_flow.tick', { ttlMs: leaseMs, release: false }, () => __awaiter(this, void 0, void 0, function* () {
                yield runScheduleTick(now);
                yield resumeDueRuns();
            }));
            // Its own lease rather than this process's tick count: the server that
            // wins a given tick changes from one minute to the next.
            yield runExclusive('eth_flow.housekeeping', { ttlMs: HOUR - 2 * 60 * 1000, release: false }, housekeeping);
        }
        catch (error) {
            console.error('[ETHFlowLeaf] Tick failed:', error);
        }
        finally {
            running = false;
        }
    });
}
function housekeeping() {
    return __awaiter(this, void 0, void 0, function* () {
        yield sweepExpired();
        yield pruneRuns();
    });
}
/** Drops old finished runs. Waiting ones are never touched — they are pending work. */
function pruneRuns() {
    return __awaiter(this, void 0, void 0, function* () {
        const days = leafConfig().retentionDays;
        if (!days)
            return;
        const before = new Date(Date.now() - days * 24 * 3600 * 1000);
        yield FlowRun.destroy({
            where: {
                status: { [Op.in]: [FlowRunStatus.SUCCESS, FlowRunStatus.FAILED] },
                created_at: { [Op.lt]: before },
            },
        });
    });
}
/**
 * Arms the timer for the boundary `slot`, then the next one from there.
 *
 * Re-aimed at each boundary rather than a `setInterval`: an interval slips by
 * the event loop's lag on every turn, and after weeks of uptime two servers
 * would tick tens of seconds apart — one past the other's lease, the minute
 * run twice, or a 09:00 schedule checked at 09:00:50.
 */
function arm(slot, interval, leaseMs) {
    var _a;
    timer = setTimeout(() => {
        // A timer can fire a hair before its boundary: the pass is the slot's.
        void tick(new Date(Math.max(Date.now(), slot)), { leaseMs });
        let next = slot + interval;
        // Asleep for a while (a suspended laptop, a blocked loop): no replaying
        // every missed minute, just the next boundary.
        if (next <= Date.now())
            next = Math.floor(Date.now() / interval) * interval + interval;
        arm(next, interval, leaseMs);
    }, Math.max(0, slot - Date.now()));
    // Node holds the process open for a timer, which would keep a CLI
    // command alive forever after it has finished its work.
    (_a = timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
}
export function startTicker() {
    var _a;
    if (timer)
        return;
    const everyMinutes = Math.max(1, (_a = leafConfig().tickIntervalMinutes) !== null && _a !== void 0 ? _a : 1);
    const interval = everyMinutes * 60 * 1000;
    const first = Math.floor(Date.now() / interval) * interval + interval;
    // Most of the interval: long enough that a server whose clock or timer is
    // a few seconds behind finds this tick taken, short enough to have expired
    // by the next boundary.
    const leaseMs = Math.max(interval / 2, interval - 15 * 1000);
    arm(first, interval, leaseMs);
    console.log(`[ETHFlowLeaf] Ticker starting in ${Math.round((first - Date.now()) / 1000)}s, then every ${everyMinutes} minute(s)`);
}
export function stopTicker() {
    if (timer)
        clearTimeout(timer);
    timer = null;
}
