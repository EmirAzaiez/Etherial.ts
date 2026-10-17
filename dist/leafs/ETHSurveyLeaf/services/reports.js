// ──────────────────────────────────────────────────────────────────────────
// What the back-office's Surveys page reads: the score, how many answered,
// how it moves week by week, and what people wrote. Postgres only.
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import etherial from 'etherial';
import { QueryTypes } from 'sequelize';
import { state } from './state.js';
import { kindOf, scaleOf, usersOptions } from './options.js';
const DAY_MS = 24 * 3600 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TABLE = 'survey_responses';
export class ReportError extends Error {
    constructor(status, code) {
        super(code);
        this.status = status;
        this.code = code;
    }
}
function sequelize() {
    var _a;
    return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
}
export function ensurePostgres() {
    var _a, _b;
    if (((_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.getDialect) === null || _b === void 0 ? void 0 : _b.call(_a)) !== 'postgres')
        throw new ReportError(501, 'postgres_required');
}
function rows(sql, replacements) {
    return __awaiter(this, void 0, void 0, function* () {
        return sequelize().query(sql, { replacements, type: QueryTypes.SELECT });
    });
}
function timezone() {
    return state.config.timezone || 'UTC';
}
function today(tz) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function shift(day, by) {
    return new Date(Date.parse(`${day}T00:00:00Z`) + by * DAY_MS).toISOString().slice(0, 10);
}
/** `?from=&to=` as calendar days; the last 90 days when not given (answers come slowly). Two years at most. */
export function rangeOf(query) {
    const tz = timezone();
    const to = typeof (query === null || query === void 0 ? void 0 : query.to) === 'string' && DAY.test(query.to) ? query.to : today(tz);
    let from = typeof (query === null || query === void 0 ? void 0 : query.from) === 'string' && DAY.test(query.from) ? query.from : shift(to, -89);
    if (from > to)
        from = to;
    if (Date.parse(to) - Date.parse(from) > 731 * DAY_MS)
        from = shift(to, -731);
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    return { from, to, days, tz };
}
function previousOf(range) {
    return Object.assign(Object.assign({}, range), { from: shift(range.from, -range.days), to: shift(range.from, -1) });
}
function within(column, prefix = '') {
    return `${column} >= (CAST(:${prefix}from AS date)::timestamp AT TIME ZONE :tz) AND ${column} < ((CAST(:${prefix}to AS date) + 1)::timestamp AT TIME ZONE :tz)`;
}
function params(range, prefix = '') {
    return { [`${prefix}from`]: range.from, [`${prefix}to`]: range.to, tz: range.tz };
}
/** The surveys read together: one, or all of the same kind. */
export function surveysOf(query) {
    var _a;
    const all = (_a = state.config.surveys) !== null && _a !== void 0 ? _a : [];
    if (!all.length)
        throw new ReportError(404, 'no_survey');
    const asked = typeof (query === null || query === void 0 ? void 0 : query.survey) === 'string' && query.survey ? all.find((s) => s.key === query.survey) : null;
    if ((query === null || query === void 0 ? void 0 : query.survey) && !asked)
        throw new ReportError(404, 'unknown_survey');
    // Scores of two kinds do not add up: "all" means every survey of the first one's kind.
    const kind = asked ? kindOf(asked) : kindOf(all[0]);
    const surveys = asked ? [asked] : all.filter((s) => kindOf(s) === kind);
    return { kind, keys: surveys.map((s) => s.key), surveys };
}
/** Promoters 9–10, passives 7–8, detractors 0–6 for NPS; satisfied 4–5, neutral 3, unhappy 1–2 for CSAT. */
function groups(kind) {
    return kind === 'nps'
        ? { high: 'score >= 9', mid: 'score BETWEEN 7 AND 8', low: 'score <= 6' }
        : { high: 'score >= 4', mid: 'score = 3', low: 'score <= 2' };
}
/** NPS: % promoters − % detractors, −100 to 100. CSAT: % satisfied, 0 to 100. */
function scoreOf(kind, t) {
    if (!t.answered)
        return null;
    const value = kind === 'nps' ? ((t.high - t.low) / t.answered) * 100 : (t.high / t.answered) * 100;
    return Math.round(value);
}
function totals(kind_1, keys_1, range_1) {
    return __awaiter(this, arguments, void 0, function* (kind, keys, range, prefix = '') {
        const g = groups(kind);
        // Asked: questions that opened in the period. Answered: answers given in it.
        const [asked] = yield rows(`SELECT count(*)::int AS asked,
                count(*) FILTER (WHERE status = 'answered')::int AS answered_of_asked,
                count(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
                count(*) FILTER (WHERE status = 'expired')::int AS expired,
                count(*) FILTER (WHERE status = 'pending')::int AS pending
           FROM ${TABLE} WHERE survey IN (:keys) AND ${within('available_at', prefix)}`, Object.assign({ keys }, params(range, prefix)));
        const [answers] = yield rows(`SELECT count(*)::int AS answered,
                count(*) FILTER (WHERE ${g.high})::int AS high,
                count(*) FILTER (WHERE ${g.mid})::int AS mid,
                count(*) FILTER (WHERE ${g.low})::int AS low,
                count(*) FILTER (WHERE comment IS NOT NULL AND comment <> '')::int AS comments,
                COALESCE(avg(score), 0)::float AS average
           FROM ${TABLE} WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at', prefix)}`, Object.assign({ keys }, params(range, prefix)));
        return Object.assign(Object.assign(Object.assign({}, asked), answers), { score: scoreOf(kind, answers), 
            // Of the questions that closed, how many got an answer: still-open ones are left out.
            response_rate: asked.asked - asked.pending > 0 ? asked.answered_of_asked / (asked.asked - asked.pending) : null });
    });
}
export function overview(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const range = rangeOf(query);
        const { kind, keys, surveys } = surveysOf(query);
        const scale = scaleOf(kind);
        const g = groups(kind);
        const [current, previous, distribution, trend, subjects] = yield Promise.all([
            totals(kind, keys, range),
            totals(kind, keys, previousOf(range), 'p_'),
            rows(`SELECT score, count(*)::int AS n FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
              GROUP BY score`, Object.assign({ keys }, params(range))),
            // Weeks start on Monday, where the project lives.
            rows(`SELECT to_char(date_trunc('week', answered_at AT TIME ZONE :tz), 'YYYY-MM-DD') AS week,
                    count(*)::int AS answered,
                    count(*) FILTER (WHERE ${g.high})::int AS high,
                    count(*) FILTER (WHERE ${g.low})::int AS low
               FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
              GROUP BY 1 ORDER BY 1`, Object.assign({ keys }, params(range))),
            // What people were asked about, worst first: where to look.
            rows(`SELECT subject_label AS label, count(*)::int AS answered,
                    count(*) FILTER (WHERE ${g.high})::int AS high,
                    count(*) FILTER (WHERE ${g.low})::int AS low,
                    avg(score)::float AS average
               FROM ${TABLE}
              WHERE survey IN (:keys) AND status = 'answered' AND subject_label IS NOT NULL AND ${within('answered_at')}
              GROUP BY subject_label HAVING count(*) >= 3
              ORDER BY avg(score) ASC LIMIT 8`, Object.assign({ keys }, params(range))),
        ]);
        const byScore = new Map(distribution.map((d) => [Number(d.score), d.n]));
        return {
            range,
            kind,
            surveys: surveys.map((s) => s.key),
            scale,
            current,
            previous,
            distribution: Array.from({ length: scale.max - scale.min + 1 }, (_, i) => { var _a; return ({ score: scale.min + i, count: (_a = byScore.get(scale.min + i)) !== null && _a !== void 0 ? _a : 0 }); }),
            trend: trend.map((w) => ({ week: w.week, answered: w.answered, score: scoreOf(kind, w) })),
            subjects: subjects.map((s) => ({ label: s.label, answered: s.answered, score: scoreOf(kind, s), average: s.average })),
        };
    });
}
const PAGE = 30;
/** `<answered_at, to the microsecond>_<id>`: where the last page stopped. */
const CURSOR = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z)_(\d+)$/;
function cursorOf(value) {
    const match = typeof value === 'string' ? CURSOR.exec(value) : null;
    return match ? { at: match[1], id: Number(match[2]) } : null;
}
/**
 * What people wrote, the latest answers first; `group` keeps the high, middle
 * or low scores, `all=1` the answers without a comment too. `limit` up to 50.
 */
export function comments(query) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const range = rangeOf(query);
        const { kind, keys } = surveysOf(query);
        const g = groups(kind);
        const group = (query === null || query === void 0 ? void 0 : query.group) === 'high' || (query === null || query === void 0 ? void 0 : query.group) === 'mid' || (query === null || query === void 0 ? void 0 : query.group) === 'low' ? query.group : null;
        const before = cursorOf(query === null || query === void 0 ? void 0 : query.before);
        const withText = (query === null || query === void 0 ? void 0 : query.all) !== '1';
        const limit = Math.min(Math.max(Number(query === null || query === void 0 ? void 0 : query.limit) || PAGE, 1), 50);
        const list = yield rows(`SELECT id, survey, user_id, score, comment, subject_label, locale, platform, answered_at,
                to_char(answered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at
           FROM ${TABLE}
          WHERE survey IN (:keys) AND status = 'answered' AND ${within('answered_at')}
            ${withText ? `AND comment IS NOT NULL AND comment <> ''` : ''}
            ${group ? `AND ${g[group]}` : ''}
            ${before ? 'AND (answered_at, id) < (CAST(:beforeAt AS timestamptz), :beforeId)' : ''}
          ORDER BY answered_at DESC, id DESC LIMIT ${limit + 1}`, Object.assign({ keys, beforeAt: (_a = before === null || before === void 0 ? void 0 : before.at) !== null && _a !== void 0 ? _a : null, beforeId: (_b = before === null || before === void 0 ? void 0 : before.id) !== null && _b !== void 0 ? _b : null }, params(range)));
        const page = list.slice(0, limit);
        const labels = yield labelUsers(page.map((r) => r.user_id));
        const last = page[page.length - 1];
        return {
            kind,
            items: page.map((_a) => { var _b; var { cursor_at } = _a, r = __rest(_a, ["cursor_at"]); return (Object.assign(Object.assign({}, r), { user_label: (_b = labels[r.user_id]) !== null && _b !== void 0 ? _b : null })); }),
            nextBefore: list.length > limit ? `${last.cursor_at}_${last.id}` : null,
        };
    });
}
/** Everything one person was asked, for their page in the back-office. */
export function userResponses(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const list = yield rows(`SELECT id, survey, status, score, comment, subject_label, available_at, answered_at
           FROM ${TABLE} WHERE user_id = :userId ORDER BY available_at DESC LIMIT 50`, { userId });
        return list.map((r) => {
            var _a, _b;
            const survey = (_a = state.config.surveys) === null || _a === void 0 ? void 0 : _a.find((s) => s.key === r.survey);
            return Object.assign(Object.assign({}, r), { kind: survey ? kindOf(survey) : 'nps', title: (_b = survey === null || survey === void 0 ? void 0 : survey.title) !== null && _b !== void 0 ? _b : r.survey });
        });
    });
}
/** Names the users behind ids, the way the project names them. */
function labelUsers(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const unique = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
        if (!unique.length)
            return {};
        const options = usersOptions(state.config);
        const Model = (_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.models) === null || _b === void 0 ? void 0 : _b[options.model];
        if (!Model)
            return {};
        const attributes = Object.keys((_c = Model.rawAttributes) !== null && _c !== void 0 ? _c : {});
        const wanted = [...options.name, ...options.fallback].filter((f) => attributes.includes(f));
        try {
            const found = yield Model.findAll({ where: { id: unique }, attributes: ['id', ...wanted], paranoid: false, raw: true });
            const labels = {};
            for (const user of found) {
                const name = options.name.map((f) => user[f]).filter((v) => v !== null && v !== undefined && String(v).trim()).join(' ').trim();
                const fallback = options.fallback.map((f) => user[f]).find((v) => v !== null && v !== undefined && String(v).trim());
                labels[user.id] = name || (fallback ? String(fallback) : `#${user.id}`);
            }
            return labels;
        }
        catch (err) {
            console.error('[ETHSurveyLeaf] Could not name users:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return {};
        }
    });
}
