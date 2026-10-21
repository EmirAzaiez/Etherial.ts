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
import { SurveyForm } from './models/SurveyForm.js';
import { SurveyResponse } from './models/SurveyResponse.js';
import { registerSurveyFormsAdmin } from './admin/forms.js';
import { attachEvents, expireDue, invite, notifyDue } from './services/invitations.js';
import { state } from './services/state.js';
import { FORMS_COLLECTION, RESPONSES_COLLECTION, defaultLocaleOf, localesOf, usersOptions, } from './services/options.js';
export * from './services/options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * The surveys are written in the back-office: a rating that scores them (NPS
 * 0–10, or satisfaction 1–5), then up to nine more questions — ratings,
 * choices, written answers — and the event they are asked after. The project
 * declares those events (an appointment done, a ticket closed) and what a
 * survey can be narrowed to (a scheduler, a ticket type). The app asks for the
 * survey waiting (`GET /surveys/pending`), shows it, and posts the answers.
 * The back-office's Surveys page reads the score, the response rate, the
 * trend and what people answered. Postgres only.
 */
export default class ETHSurveyLeaf {
    constructor(config = {}) {
        var _a;
        this.etherial_module_name = 'eth_survey_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/app'), methods: ['pending', 'answer', 'dismiss'] }, { route: path.join(__dirname, 'routes/admin'), methods: ['list', 'targets', 'overview', 'comments', 'user'] });
        const keys = ((_a = config.events) !== null && _a !== void 0 ? _a : []).map((e) => e.key);
        const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
        if (twice.length)
            throw new Error(`[ETHSurveyLeaf] Two events share the key "${twice[0]}"`);
    }
    /**
     * Lifecycle: beforeRun — hand the tables to the database before it syncs,
     * and the surveys' form to the back-office before it sets up its history.
     */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([SurveyForm, SurveyResponse]);
        registerSurveyFormsAdmin(etherial.eth_admin_leaf, this.config);
    }
    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }) {
        var _a, _b, _c, _d, _e;
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
        const count = (_e = (_d = this.config.events) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0;
        console.log(`[ETHSurveyLeaf] ${count ? `${count} event${count > 1 ? 's' : ''} to ask surveys after` : 'No event: surveys are asked from the code (invite)'}`);
    }
    /** Lifecycle: afterRun — every model exists: hook the events, tell the back-office. */
    afterRun() {
        var _a, _b, _c, _d, _e;
        if ((_a = this.config.events) === null || _a === void 0 ? void 0 : _a.length)
            attachEvents(this.config.events);
        const adminLeaf = etherial.eth_admin_leaf;
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
            return;
        const users = usersOptions(this.config);
        const hasUsers = !!((_b = adminLeaf.getCollection) === null || _b === void 0 ? void 0 : _b.call(adminLeaf, users.collection));
        if (!adminLeaf.getCollection(RESPONSES_COLLECTION))
            adminLeaf.registerCollection(responsesCollection(users.collection, hasUsers));
        // The surveys themselves change from the back-office: it reads them from `GET /admin/surveys`.
        (_c = adminLeaf.setFeature) === null || _c === void 0 ? void 0 : _c.call(adminLeaf, 'surveys', {
            collection: RESPONSES_COLLECTION,
            formsCollection: FORMS_COLLECTION,
            usersCollection: hasUsers ? users.collection : null,
            timezone: this.config.timezone || 'UTC',
            cooldownDays: (_d = this.config.cooldownDays) !== null && _d !== void 0 ? _d : 30,
            defaultLocale: defaultLocaleOf(this.config),
            locales: localesOf(this.config),
            events: ((_e = this.config.events) !== null && _e !== void 0 ? _e : []).map((e) => {
                var _a, _b;
                return ({
                    key: e.key,
                    label: e.label,
                    description: (_a = e.description) !== null && _a !== void 0 ? _a : null,
                    target: e.target ? { label: e.target.label, collection: (_b = e.target.collection) !== null && _b !== void 0 ? _b : null } : null,
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
                description: 'Delete every survey question put to someone and its answer, the surveys staying (asks nothing: for test databases)',
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
function responsesCollection(usersCollection, hasUsers) {
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
            // Its key: the surveys are written in the back-office, after the boot.
            { name: 'survey', type: 'string', label: 'Survey', filterable: true },
            hasUsers
                ? { name: 'user_id', type: 'relation', label: 'Asked', filterable: true, relation: { collection: usersCollection, displayField: 'email' } }
                : { name: 'user_id', type: 'integer', label: 'Asked', filterable: true },
            { name: 'status', type: 'select', label: 'Status', filterable: true, options: STATUS_OPTIONS },
            { name: 'score', type: 'integer', label: 'Score', sortable: true, filterable: true },
            { name: 'comment', type: 'text', label: 'Comment', searchable: true },
            { name: 'answers', type: 'json', label: 'Answers' },
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
                    { title: 'Answer', fields: ['survey', 'status', 'score', 'comment', 'answers', 'answered_at'] },
                    { title: 'Asked', fields: ['user_id', 'subject_label', 'subject_type', 'subject_id', 'available_at', 'expires_at', 'notified_at'] },
                    { title: 'From', fields: ['locale', 'platform', 'app_version'] },
                ],
            },
        },
    };
}
