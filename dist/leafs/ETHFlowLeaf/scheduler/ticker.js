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
import { leafConfig } from '../config.js';
import { FlowRun, FlowRunStatus } from '../models/FlowRun.js';
import { runScheduleTick } from '../triggers/schedule.js';
import { resumeDueRuns } from '../engine/fire.js';
import { refreshListeners } from '../engine/listeners.js';
import { sweepExpired } from '../engine/dedup.js';
let timer = null;
let alignment = null;
let running = false;
let ticks = 0;
/**
 * One pass. Exported so it can be triggered by hand — from a test, or from a
 * project that would rather drive the schedule with its own cron.
 */
export function tick() {
    return __awaiter(this, arguments, void 0, function* (now = new Date()) {
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
            yield refreshListeners();
            yield runScheduleTick(now);
            yield resumeDueRuns();
            // Housekeeping is hourly — it is not urgent, and it takes locks.
            if (ticks % 60 === 1) {
                yield sweepExpired();
                yield pruneRuns();
            }
        }
        catch (error) {
            console.error('[ETHFlowLeaf] Tick failed:', error);
        }
        finally {
            running = false;
        }
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
export function startTicker() {
    var _a, _b;
    if (timer || alignment)
        return;
    const everyMinutes = Math.max(1, (_a = leafConfig().tickIntervalMinutes) !== null && _a !== void 0 ? _a : 1);
    const interval = everyMinutes * 60 * 1000;
    const delay = interval - (Date.now() % interval);
    alignment = setTimeout(() => {
        var _a;
        alignment = null;
        void tick();
        timer = setInterval(() => void tick(), interval);
        // Node holds the process open for a timer, which would keep a CLI
        // command alive forever after it has finished its work.
        (_a = timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
    }, delay);
    (_b = alignment.unref) === null || _b === void 0 ? void 0 : _b.call(alignment);
    console.log(`[ETHFlowLeaf] Ticker starting in ${Math.round(delay / 1000)}s, then every ${everyMinutes} minute(s)`);
}
export function stopTicker() {
    if (timer)
        clearInterval(timer);
    if (alignment)
        clearTimeout(alignment);
    timer = null;
    alignment = null;
}
