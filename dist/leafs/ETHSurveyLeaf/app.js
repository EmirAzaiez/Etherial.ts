var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runExclusive } from '../../components/database/lock.js';
import { SurveyResponse } from './models/SurveyResponse.js';
import { attachTriggers, expireDue, invite, notifyDue } from './services/invitations.js';
import { state } from './services/state.js';
import { RESPONSES_COLLECTION, kindOf, localize, usersOptions } from './services/options.js';
export * from './services/options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * A survey is one question (NPS 0–10, or satisfaction 1–5) and an optional
 * comment. People are invited by a trigger — an appointment marked as done, a
 * ticket closed — or by the project's code. The app asks for the question
 * waiting (`GET /surveys/pending`), shows it, and posts the answer. The
 * back-office's Surveys page reads the score, the response rate, the trend
 * and what people wrote. Postgres only.
 */
export default class ETHSurveyLeaf {
    constructor(config = {}) {
        var _a;
        this.etherial_module_name = 'eth_survey_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/app'), methods: ['pending', 'answer', 'dismiss'] }, { route: path.join(__dirname, 'routes/admin'), methods: ['overview', 'comments', 'user'] });
        const keys = ((_a = config.surveys) !== null && _a !== void 0 ? _a : []).map((s) => s.key);
        const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
        if (twice.length)
            throw new Error(`[ETHSurveyLeaf] Two surveys share the key "${twice[0]}"`);
    }
    /** Lifecycle: beforeRun — hand the table to the database before it syncs. */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([SurveyResponse]);
    }
    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }) {
        var _a, _b, _c, _d, _e, _f, _g;
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        const tick = () => __awaiter(this, void 0, void 0, function* () {
            try {
                // One server per minute: the rows are claimed one by one, so a
                // second server would only scan the same table for nothing.
                yield runExclusive('eth_survey.tick', { ttlMs: 50 * 1000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
                    yield expireDue();
                    yield notifyDue();
                }));
            }
            catch (err) {
                console.error('[ETHSurveyLeaf] Could not open or close questions:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
        });
        // Not at boot: the table may not be synced yet. The first turn of the
        // interval is a minute away (a setTimeout as well ran it twice then).
        (_c = (_b = setInterval(tick, 60 * 1000)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
        const count = (_e = (_d = this.config.surveys) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
        console.log(`[ETHSurveyLeaf] ${count ? `${count} survey${count > 1 ? 's' : ''}, ${(_g = (_f = this.config.triggers) === null || _f === void 0 ? void 0 : _f.length) !== null && _g !== void 0 ? _g : 0} trigger(s)` : 'No survey yet: list them in `surveys`'}`);
    }
    /** Lifecycle: afterRun — every model exists: hook the triggers, tell the back-office. */
    afterRun() {
        var _a, _b, _c, _d, _e, _f;
        if ((_a = this.config.triggers) === null || _a === void 0 ? void 0 : _a.length)
            attachTriggers(this.config.triggers);
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        const users = usersOptions(this.config);
        const hasUsers = !!((_b = adminLeaf.getCollection) === null || _b === void 0 ? void 0 : _b.call(adminLeaf, users.collection));
        if (!adminLeaf.getCollection(RESPONSES_COLLECTION))
            adminLeaf.registerCollection(responsesCollection(this.config, users.collection, hasUsers));
        const fallback = (_c = this.config.defaultLocale) !== null && _c !== void 0 ? _c : 'en';
        (_d = adminLeaf.setFeature) === null || _d === void 0 ? void 0 : _d.call(adminLeaf, 'surveys', {
            collection: RESPONSES_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            cooldownDays: (_e = this.config.cooldownDays) !== null && _e !== void 0 ? _e : 30,
            surveys: ((_f = this.config.surveys) !== null && _f !== void 0 ? _f : []).map((s) => {
                var _a, _b, _c, _d;
                return ({
                    key: s.key,
                    title: s.title,
                    kind: kindOf(s),
                    question: localize(s.question, fallback, fallback),
                    description: (_a = s.description) !== null && _a !== void 0 ? _a : null,
                    delayMinutes: (_b = s.delayMinutes) !== null && _b !== void 0 ? _b : 0,
                    expiresAfterDays: (_c = s.expiresAfterDays) !== null && _c !== void 0 ? _c : 7,
                    triggers: ((_d = this.config.triggers) !== null && _d !== void 0 ? _d : []).filter((t) => t.survey === s.key).map((t) => t.model),
                });
            }),
        });
    }
    /** Asks someone a survey from the project's own code. */
    invite(input) {
        return invite(input);
    }
    commands() {
        return [
            {
                command: 'purge',
                description: 'Delete every survey question and answer (asks nothing: for test databases)',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const count = yield SurveyResponse.destroy({ where: {}, truncate: true });
                    return { success: true, message: `Purged surveys (${count !== null && count !== void 0 ? count : 0} rows)` };
                }),
            },
        ];
    }
}
const STATUS_OPTIONS = [
    { value: 'pending', label: 'Waiting', color: 'blue' },
    { value: 'answered', label: 'Answered', color: 'green' },
    { value: 'dismissed', label: 'Not now', color: 'gray' },
    { value: 'expired', label: 'Expired', color: 'gray' },
];
function responsesCollection(config, usersCollection, hasUsers) {
    var _a;
    return {
        name: RESPONSES_COLLECTION,
        model: SurveyResponse,
        crud: ['list', 'show'],
        exportable: true,
        meta: {
            label: 'Survey answer',
            labelPlural: 'Survey answers',
            icon: 'MessageSquareHeart',
            description: 'Every survey question put to someone, and their answer',
            group: 'System',
            order: 96,
            // Read through the Surveys page; listed for exports and for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'survey',
                type: 'select',
                label: 'Survey',
                filterable: true,
                options: ((_a = config.surveys) !== null && _a !== void 0 ? _a : []).map((s) => ({ value: s.key, label: s.title })),
            },
            hasUsers
                ? { name: 'user_id', type: 'relation', label: 'Asked', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer', label: 'Asked', filterable: true },
            { name: 'status', type: 'select', label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'score', type: 'integer', label: 'Score', sortable: true, filterable: true },
            { name: 'comment', type: 'text', label: 'Comment', searchable: true },
            { name: 'subject_label', type: 'string', label: 'About', searchable: true },
            { name: 'subject_type', type: 'string', label: 'Asked after' },
            { name: 'subject_id', type: 'string', label: 'Record' },
            { name: 'locale', type: 'string', label: 'Language', filterable: true },
            { name: 'platform', type: 'string', label: 'Platform', filterable: true },
            { name: 'app_version', type: 'string', label: 'App version' },
            { name: 'available_at', type: 'datetime', label: 'Asked', sortable: true, filterable: true },
            { name: 'answered_at', type: 'datetime', label: 'Answered', sortable: true, filterable: true },
            { name: 'expires_at', type: 'datetime', label: 'Closes' },
            { name: 'notified_at', type: 'datetime', label: 'Told' },
        ],
        views: {
            list: {
                fields: ['available_at', 'survey', 'user_id', 'status', 'score', 'comment', 'subject_label'],
                sort: { field: 'available_at', direction: 'desc' },
                search: ['comment', 'subject_label'],
                filters: ['survey', 'status', 'user_id', 'available_at'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Answer', fields: ['survey', 'status', 'score', 'comment', 'answered_at'] },
                    { title: 'Asked', fields: ['user_id', 'subject_label', 'subject_type', 'subject_id', 'available_at', 'expires_at', 'notified_at'] },
                    { title: 'From', fields: ['locale', 'platform', 'app_version'] },
                ],
            },
        },
    };
}
