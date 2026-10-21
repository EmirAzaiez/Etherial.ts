// ──────────────────────────────────────────────────────────────────────────
// The surveys written in the back-office: reading them, checking what is
// saved, picking the one an event asks, and reading the answers the app sends.
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
import { randomBytes } from 'crypto';
import { Op } from 'sequelize';
import { SurveyForm } from '../models/SurveyForm.js';
import { SurveyResponse } from '../models/SurveyResponse.js';
import { state } from './state.js';
import { MAX_OPTIONS, MAX_QUESTIONS, QUESTION_TYPES, defaultLocaleOf, isRating, kindOf, localesOf, localize, scaleOf, } from './options.js';
const ID = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_DELAY_MINUTES = 30 * 24 * 60;
const MAX_OPEN_DAYS = 90;
const MAX_TARGETS = 500;
export function eventOf(key) {
    var _a;
    return typeof key === 'string' ? (_a = state.config.events) === null || _a === void 0 ? void 0 : _a.find((e) => e.key === key) : undefined;
}
export function surveyByKey(key) {
    return SurveyForm.findOne({ where: { key } });
}
export function allSurveys() {
    return SurveyForm.findAll({ order: [['id', 'ASC']] });
}
export function activeKeys() {
    return __awaiter(this, void 0, void 0, function* () {
        const forms = yield SurveyForm.findAll({ where: { active: true }, attributes: ['key'] });
        return forms.map((f) => f.key);
    });
}
export function infoOf(form) {
    return { key: form.key, title: form.title, kind: kindOf(form.questions), event: form.event };
}
/** What the back-office reads of a survey: the Surveys page, its tabs, its forms. */
export function adminInfoOf(form) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fallback = defaultLocaleOf(state.config);
    const event = eventOf(form.event);
    return {
        id: form.id,
        key: form.key,
        title: form.title,
        description: (_a = form.description) !== null && _a !== void 0 ? _a : null,
        active: !!form.active,
        kind: kindOf(form.questions),
        question: localize((_c = (_b = form.questions) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.label, fallback, fallback),
        event: (_d = form.event) !== null && _d !== void 0 ? _d : null,
        eventLabel: (_e = event === null || event === void 0 ? void 0 : event.label) !== null && _e !== void 0 ? _e : null,
        targetLabel: (_g = (_f = event === null || event === void 0 ? void 0 : event.target) === null || _f === void 0 ? void 0 : _f.label) !== null && _g !== void 0 ? _g : null,
        targets: (_h = form.targets) !== null && _h !== void 0 ? _h : [],
        questions: (_j = form.questions) !== null && _j !== void 0 ? _j : [],
        delayMinutes: form.delay_minutes,
        expiresAfterDays: form.expires_after_days,
    };
}
/**
 * The survey asked after this event, for this value of it (a scheduler, a
 * ticket type): the one narrowed to it, else the one asked after every one.
 * Saving checks that no two active surveys of an event overlap.
 */
export function surveyFor(event, target) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const forms = yield SurveyForm.findAll({ where: { event, active: true }, order: [['id', 'ASC']] });
        const narrowed = target === null ? undefined : forms.find((f) => { var _a; return ((_a = f.targets) !== null && _a !== void 0 ? _a : []).some((t) => String(t.value) === target); });
        return (_a = narrowed !== null && narrowed !== void 0 ? narrowed : forms.find((f) => { var _a; return !((_a = f.targets) !== null && _a !== void 0 ? _a : []).length; })) !== null && _a !== void 0 ? _a : null;
    });
}
// ── Saving from the back-office ───────────────────────────────────────────
/** Its message is shown in the back-office's form, as the admin leaf does with a hook's errors. */
export class SurveyFormError extends Error {
}
function languageName(locale) {
    var _a;
    try {
        return (_a = new Intl.DisplayNames(['en'], { type: 'language' }).of(locale)) !== null && _a !== void 0 ? _a : locale;
    }
    catch (_b) {
        return locale;
    }
}
function parsed(value) {
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch (_a) {
        return null;
    }
}
/** A text in the survey's languages, empty ones left out. */
function texts(value, max) {
    const locales = localesOf(state.config);
    const out = {};
    if (typeof value === 'string') {
        if (value.trim())
            out[locales[0]] = value.trim().slice(0, max);
        return out;
    }
    if (!value || typeof value !== 'object')
        return out;
    for (const locale of locales) {
        const text = value[locale];
        if (typeof text === 'string' && text.trim())
            out[locale] = text.trim().slice(0, max);
    }
    return out;
}
/**
 * The id kept when it is a fine one not used yet, a new one otherwise. New
 * ones are random, never `q3` again: a question taken off keeps its answers,
 * and the one added after it must not inherit them.
 */
function idFor(wanted, prefix, taken) {
    if (typeof wanted === 'string' && ID.test(wanted) && !taken.has(wanted)) {
        taken.add(wanted);
        return wanted;
    }
    let id;
    do
        id = `${prefix}${randomBytes(4).toString('hex')}`;
    while (taken.has(id));
    taken.add(id);
    return id;
}
function optionsOf(value, n) {
    const fallback = defaultLocaleOf(state.config);
    const list = Array.isArray(value) ? value : [];
    const taken = new Set();
    const out = [];
    list.forEach((option) => {
        const label = texts(option === null || option === void 0 ? void 0 : option.label, 200);
        // An empty line left at the end of the list is not a choice.
        if (!Object.keys(label).length)
            return;
        if (!label[fallback])
            throw new SurveyFormError(`Question ${n}, choice ${out.length + 1} needs its text in ${languageName(fallback)}.`);
        out.push({ id: idFor(option === null || option === void 0 ? void 0 : option.id, 'o', taken), label });
    });
    if (out.length < 2)
        throw new SurveyFormError(`Question ${n} needs at least two choices.`);
    if (out.length > MAX_OPTIONS)
        throw new SurveyFormError(`Question ${n} has ${MAX_OPTIONS} choices at most.`);
    return out;
}
export function normalizeQuestions(value) {
    const list = parsed(value);
    if (!Array.isArray(list) || !list.length)
        throw new SurveyFormError('Add at least one question.');
    if (list.length > MAX_QUESTIONS)
        throw new SurveyFormError(`A survey has ${MAX_QUESTIONS} questions at most: it is answered on a phone.`);
    const fallback = defaultLocaleOf(state.config);
    const taken = new Set();
    return list.map((q, i) => {
        const n = i + 1;
        if (!QUESTION_TYPES.includes(q === null || q === void 0 ? void 0 : q.type))
            throw new SurveyFormError(`Question ${n}: choose what kind of answer it takes.`);
        if (i === 0 && !isRating(q.type)) {
            throw new SurveyFormError('The first question gives the survey its score: make it a 0–10 or a 1–5 rating.');
        }
        const label = texts(q.label, 500);
        if (!label[fallback])
            throw new SurveyFormError(`Question ${n} needs its text in ${languageName(fallback)}.`);
        const out = { id: idFor(q.id, 'q', taken), type: q.type, label, required: i === 0 || !!q.required };
        if (isRating(q.type)) {
            const low = texts(q.lowLabel, 60);
            const high = texts(q.highLabel, 60);
            if (Object.keys(low).length)
                out.lowLabel = low;
            if (Object.keys(high).length)
                out.highLabel = high;
        }
        if (q.type === 'choice' || q.type === 'multiple')
            out.options = optionsOf(q.options, n);
        return out;
    });
}
function normalizeEvent(value) {
    var _a;
    const events = (_a = state.config.events) !== null && _a !== void 0 ? _a : [];
    // A project without events asks its surveys from its own code (`invite()`).
    if (!events.length)
        return null;
    const event = eventOf(value);
    if (!event)
        throw new SurveyFormError('Choose after what the survey is asked.');
    return event.key;
}
function normalizeTargets(value, event) {
    const list = parsed(value);
    if (!(event === null || event === void 0 ? void 0 : event.target) || !Array.isArray(list))
        return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const raw = item && typeof item === 'object' ? item.value : item;
        if (raw === undefined || raw === null || raw === '')
            continue;
        const v = String(raw).slice(0, 255);
        if (seen.has(v))
            continue;
        seen.add(v);
        const label = item && typeof item === 'object' && typeof item.label === 'string' && item.label.trim() ? item.label.trim().slice(0, 255) : v;
        out.push({ value: v, label });
    }
    if (out.length > MAX_TARGETS)
        throw new SurveyFormError(`Choose ${MAX_TARGETS} values at most, or none to ask after every one.`);
    return out;
}
/**
 * The names the values have now: a link from a record's page gives only its
 * id, and a scheduler may have been renamed. A value no longer offered keeps
 * the name it had.
 */
function withCurrentLabels(targets, event) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!targets.length || !(event === null || event === void 0 ? void 0 : event.target))
            return targets;
        let options;
        try {
            options = yield event.target.options();
        }
        catch (_a) {
            return targets;
        }
        const names = new Map(options.map((o) => [String(o.value), o.label]));
        return targets.map((t) => (Object.assign(Object.assign({}, t), { label: names.get(t.value) || t.label })));
    });
}
function whole(value, fallback, min, max, name) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max)
        throw new SurveyFormError(`${name} is a whole number from ${min} to ${max}.`);
    return n;
}
function yes(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    return value === true || value === 'true' || value === 1 || value === '1';
}
/** One active survey per event and value: two would race on the same booking. */
function checkOverlap(id, event, targets, active) {
    return __awaiter(this, void 0, void 0, function* () {
        const ev = eventOf(event);
        if (!active || !ev)
            return;
        const others = yield SurveyForm.findAll({
            where: Object.assign({ event: ev.key, active: true }, (id ? { id: { [Op.ne]: id } } : {})),
            order: [['id', 'ASC']],
        });
        if (!targets.length) {
            const everyOne = others.find((o) => { var _a; return !((_a = o.targets) !== null && _a !== void 0 ? _a : []).length; });
            if (!everyOne)
                return;
            throw new SurveyFormError(ev.target
                ? `"${everyOne.title}" is already asked each time "${ev.label}". Narrow this survey to some ${ev.target.label.toLowerCase()} values, or turn "${everyOne.title}" off first.`
                : `"${everyOne.title}" is already asked each time "${ev.label}": turn it off first.`);
        }
        for (const target of targets) {
            const other = others.find((o) => { var _a; return ((_a = o.targets) !== null && _a !== void 0 ? _a : []).some((t) => String(t.value) === target.value); });
            if (other)
                throw new SurveyFormError(`${target.label} is already in "${other.title}": one survey is asked each time. Take it off one of them.`);
        }
    });
}
/** Answers already given keep their meaning: the score's scale, and what each question took. */
function checkAnswered(record, questions) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const answered = yield SurveyResponse.count({ where: { survey: record.key, status: 'answered' } });
        if (!answered)
            return;
        const before = (_a = record.questions) !== null && _a !== void 0 ? _a : [];
        const was = kindOf(before);
        if (kindOf(questions) !== was) {
            const scale = (k) => (k === 'nps' ? '0–10' : '1–5');
            throw new SurveyFormError(`This survey already has ${answered} answer${answered > 1 ? 's' : ''} on a ${scale(was)} scale: its first question stays a ${scale(was)} rating. Create a new survey for a ${scale(kindOf(questions))} one.`);
        }
        const fallback = defaultLocaleOf(state.config);
        for (const q of questions) {
            const old = before.find((b) => b.id === q.id);
            if (old && old.type !== q.type) {
                throw new SurveyFormError(`"${localize(q.label, fallback, fallback)}" already has answers: the kind of answer it takes can't change. Add a new question instead.`);
            }
        }
    });
}
/** `After a handover` → `after_a_handover`, free in both tables. */
function freshKey(title) {
    return __awaiter(this, void 0, void 0, function* () {
        const base = title
            .normalize('NFKD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48) || 'survey';
        const like = { [Op.like]: `${base}%` };
        const [forms, responses] = yield Promise.all([
            SurveyForm.findAll({ where: { key: like }, attributes: ['key'] }),
            SurveyResponse.findAll({ where: { survey: like }, attributes: ['survey'], group: ['survey'] }),
        ]);
        const used = new Set([...forms.map((f) => f.key), ...responses.map((r) => r.survey)]);
        if (!used.has(base))
            return base;
        let n = 2;
        while (used.has(`${base}_${n}`))
            n++;
        return `${base}_${n}`;
    });
}
/** Everything the form saves, checked, from what it sends over what was there. */
function prepared(record, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const was = record ? record.get({ plain: true }) : {};
        const pick = (name) => (name in data ? data[name] : was[name]);
        const title = typeof pick('title') === 'string' ? pick('title').trim().slice(0, 255) : '';
        if (!title)
            throw new SurveyFormError('Give the survey a title.');
        const event = normalizeEvent(pick('event'));
        const targets = yield withCurrentLabels(normalizeTargets(pick('targets'), eventOf(event)), eventOf(event));
        const questions = normalizeQuestions(pick('questions'));
        const active = yes(pick('active'), true);
        const delay = whole(pick('delay_minutes'), 60, 0, MAX_DELAY_MINUTES, 'The delay, in minutes,');
        const open = whole(pick('expires_after_days'), 7, 1, MAX_OPEN_DAYS, 'The days it stays open');
        yield checkOverlap((_a = record === null || record === void 0 ? void 0 : record.id) !== null && _a !== void 0 ? _a : null, event, targets, active);
        if (record)
            yield checkAnswered(record, questions);
        const description = typeof pick('description') === 'string' && pick('description').trim() ? pick('description').trim() : null;
        return { title, description, event, targets, questions, active, delay_minutes: delay, expires_after_days: open };
    });
}
export function prepareCreate(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const fields = yield prepared(null, data);
        return Object.assign(Object.assign(Object.assign({}, data), fields), { key: yield freshKey(fields.title) });
    });
}
export function prepareUpdate(record, data) {
    return __awaiter(this, void 0, void 0, function* () {
        // Set once: every answer points to it.
        delete data.key;
        return Object.assign(Object.assign({}, data), (yield prepared(record, data)));
    });
}
export function checkDelete(record) {
    return __awaiter(this, void 0, void 0, function* () {
        const asked = yield SurveyResponse.count({ where: { survey: record.key } });
        if (asked) {
            throw new SurveyFormError(`"${record.title}" was asked ${asked} time${asked > 1 ? 's' : ''}: its answers stay with it. Turn it off instead.`);
        }
    });
}
// ── The app ───────────────────────────────────────────────────────────────
/** The questions as the person reads them, in their language. */
export function questionsFor(form, locale) {
    var _a;
    const fallback = defaultLocaleOf(state.config);
    return ((_a = form.questions) !== null && _a !== void 0 ? _a : []).map((q) => (Object.assign(Object.assign({ id: q.id, type: q.type, label: localize(q.label, locale, fallback), required: !!q.required }, (isRating(q.type)
        ? { scale: scaleOf(q.type), low_label: localize(q.lowLabel, locale, fallback), high_label: localize(q.highLabel, locale, fallback) }
        : {})), (q.options ? { options: q.options.map((o) => ({ id: o.id, label: localize(o.label, locale, fallback) })) } : {}))));
}
function clip(value, max) {
    if (value === undefined || value === null)
        return null;
    const s = String(value).trim();
    return s ? s.slice(0, max) : null;
}
/**
 * `{ answers: { q1: 9, q2: 'o1', q3: ['o1', 'o3'], q4: 'text' } }`. The app
 * before several questions sends `{ score, comment }`: the score answers the
 * first question, the comment the first written one, and the questions it
 * never showed are not asked of it.
 */
export function readAnswers(form, body) {
    var _a, _b;
    const questions = (_a = form.questions) !== null && _a !== void 0 ? _a : [];
    const first = questions[0];
    if (!first)
        return { ok: false, error: 'no_question' };
    const legacy = !((body === null || body === void 0 ? void 0 : body.answers) && typeof body.answers === 'object' && !Array.isArray(body.answers));
    const given = legacy ? {} : body.answers;
    const firstText = questions.find((q) => q.type === 'text');
    if (legacy) {
        given[first.id] = body === null || body === void 0 ? void 0 : body.score;
        if (firstText)
            given[firstText.id] = body === null || body === void 0 ? void 0 : body.comment;
    }
    const answers = {};
    for (const q of questions) {
        const raw = given[q.id];
        const empty = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && !raw.length);
        if (empty) {
            if (q.required && (!legacy || q === first))
                return { ok: false, error: `${q.id} is required` };
            continue;
        }
        if (isRating(q.type)) {
            const { min, max } = scaleOf(q.type);
            const n = Number(raw);
            if (!Number.isInteger(n) || n < min || n > max)
                return { ok: false, error: `${q.id} must be a whole number from ${min} to ${max}` };
            answers[q.id] = n;
        }
        else if (q.type === 'choice') {
            const id = String(raw);
            if (!((_b = q.options) !== null && _b !== void 0 ? _b : []).some((o) => o.id === id))
                return { ok: false, error: `${q.id} is not one of its choices` };
            answers[q.id] = id;
        }
        else if (q.type === 'multiple') {
            const ids = Array.from(new Set((Array.isArray(raw) ? raw : [raw]).map(String)));
            if (ids.some((id) => { var _a; return !((_a = q.options) !== null && _a !== void 0 ? _a : []).some((o) => o.id === id); }))
                return { ok: false, error: `${q.id} is not one of its choices` };
            answers[q.id] = ids;
        }
        else {
            answers[q.id] = clip(raw, 2000);
        }
    }
    const written = questions.find((q) => q.type === 'text' && typeof answers[q.id] === 'string');
    return {
        ok: true,
        answers,
        score: answers[first.id],
        // Kept with the score for the Surveys page; an old app's comment too, with no written question to hold it.
        comment: written ? answers[written.id] : legacy && !firstText ? clip(body === null || body === void 0 ? void 0 : body.comment, 2000) : null,
    };
}
