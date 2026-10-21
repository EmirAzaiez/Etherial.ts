var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { SurveyForm } from '../models/SurveyForm.js';
import { checkDelete, prepareCreate, prepareUpdate } from '../services/forms.js';
import { FORMS_COLLECTION } from '../services/options.js';
/** The back-office widget on the event: the choice, then what it is narrowed to. */
export const SURVEY_TRIGGER_WIDGET = 'survey-trigger';
/** Served as written (a `json` field would be flattened for display): the BO draws them. */
export const SURVEY_QUESTIONS_TYPE = 'survey-questions';
export const SURVEY_TARGETS_TYPE = 'survey-targets';
function registerHooks(adminLeaf) {
    adminLeaf.hooks.register('eth-survey:forms', {
        collection: FORMS_COLLECTION,
        description: 'Check a survey before it is saved: its questions, when it is asked, no two asked after the same thing',
        beforeCreate: (data) => __awaiter(this, void 0, void 0, function* () { return prepareCreate(data); }),
        beforeUpdate: (record, data) => __awaiter(this, void 0, void 0, function* () { return prepareUpdate(record, data); }),
        beforeDelete: (record) => __awaiter(this, void 0, void 0, function* () {
            yield checkDelete(record);
            return true;
        }),
    });
}
function formsCollection(config) {
    var _a;
    const events = (_a = config.events) !== null && _a !== void 0 ? _a : [];
    return {
        name: FORMS_COLLECTION,
        model: SurveyForm,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Survey',
            labelPlural: 'Surveys',
            icon: 'ClipboardList',
            description: 'The surveys put to people in the app, their questions, and when they are asked',
            group: 'System',
            order: 95,
            // Written and read from the Surveys page; listed for the role permissions.
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'title', type: 'string', label: 'Title', required: true, searchable: true, sortable: true, maxLength: 255, helpText: 'For the back-office: people in the app only read the questions.' },
            { name: 'key', type: 'string', label: 'Key', readonly: true, helpText: 'Set from the title when the survey is created, and kept with every answer.' },
            { name: 'description', type: 'text', label: 'Notes', helpText: 'Why it is asked, for the team.' },
            { name: 'active', type: 'boolean', label: 'On', defaultValue: true, filterable: true, helpText: 'Off: nobody is asked any more, and the questions still waiting are no longer shown.' },
            ...(events.length
                ? [
                    {
                        name: 'event',
                        type: 'select',
                        label: 'Asked after',
                        required: true,
                        filterable: true,
                        options: events.map((e) => ({ value: e.key, label: e.label })),
                        widget: SURVEY_TRIGGER_WIDGET,
                        companions: ['targets'],
                        col: 12,
                    },
                ]
                : []),
            { name: 'targets', type: SURVEY_TARGETS_TYPE, label: 'Only after' },
            { name: 'questions', type: SURVEY_QUESTIONS_TYPE, label: 'Questions', required: true, col: 12 },
            { name: 'delay_minutes', type: 'integer', label: 'Wait before asking (minutes)', defaultValue: 60, min: 0, max: 43200, helpText: 'Time between the event and the question: let the visit end first.' },
            { name: 'expires_after_days', type: 'integer', label: 'Open for (days)', defaultValue: 7, min: 1, max: 90, helpText: 'Left unanswered this long, the question is dropped.' },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
            { name: 'updated_at', type: 'datetime', label: 'Updated', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['title', ...(events.length ? ['event'] : []), 'targets', 'questions', 'active', 'updated_at'],
                sort: { field: 'id', direction: 'asc' },
                search: ['title'],
                filters: ['active', ...(events.length ? ['event'] : [])],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Survey', fields: ['title', 'key', 'description', 'active'] },
                    { title: 'When it is asked', fields: [...(events.length ? ['event', 'targets'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
            create: {
                layout: 'sections',
                sections: [
                    { title: 'Survey', fields: ['title', 'description', 'active'] },
                    // The event's widget draws what it is narrowed to.
                    { title: 'When it is asked', fields: [...(events.length ? ['event'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
            edit: {
                layout: 'sections',
                sections: [
                    { title: 'Survey', fields: ['title', 'description', 'active'] },
                    { title: 'When it is asked', fields: [...(events.length ? ['event'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
        },
    };
}
/** Hooks first: the admin leaf reads a collection's hooks when it is registered. */
export function registerSurveyFormsAdmin(adminLeaf, config) {
    if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.hooks) || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection))
        return;
    registerHooks(adminLeaf);
    if (!adminLeaf.getCollection(FORMS_COLLECTION))
        adminLeaf.registerCollection(formsCollection(config));
}
