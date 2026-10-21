import { SurveyForm } from '../models/SurveyForm.js'
import { checkDelete, prepareCreate, prepareUpdate } from '../services/forms.js'
import { ETHSurveyLeafConfig, FORMS_COLLECTION } from '../services/options.js'

/** The back-office widget on the event: the choice, then what it is narrowed to. */
export const SURVEY_TRIGGER_WIDGET = 'survey-trigger'
/** Served as written (a `json` field would be flattened for display): the BO draws them. */
export const SURVEY_QUESTIONS_TYPE = 'survey-questions'
export const SURVEY_TARGETS_TYPE = 'survey-targets'

function registerHooks(adminLeaf: any) {
    adminLeaf.hooks.register('eth-survey:forms', {
        collection: FORMS_COLLECTION,
        description: 'Check a survey before it is saved: its questions, when it is asked, no two asked after the same thing',
        beforeCreate: async (data: any) => prepareCreate(data),
        beforeUpdate: async (record: any, data: any) => prepareUpdate(record, data),
        beforeDelete: async (record: any) => {
            await checkDelete(record)
            return true
        },
    })
}

function formsCollection(config: ETHSurveyLeafConfig) {
    const events = config.events ?? []
    return {
        name: FORMS_COLLECTION,
        model: SurveyForm,
        crud: ['list', 'show', 'create', 'update', 'delete'] as ('list' | 'show' | 'create' | 'update' | 'delete')[],
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
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            { name: 'title', type: 'string' as const, label: 'Title', required: true, searchable: true, sortable: true, maxLength: 255, helpText: 'For the back-office: people in the app only read the questions.' },
            { name: 'key', type: 'string' as const, label: 'Key', readonly: true, helpText: 'Set from the title when the survey is created, and kept with every answer.' },
            { name: 'description', type: 'text' as const, label: 'Notes', helpText: 'Why it is asked, for the team.' },
            { name: 'active', type: 'boolean' as const, label: 'On', defaultValue: true, filterable: true, helpText: 'Off: nobody is asked any more, and the questions still waiting are no longer shown.' },
            ...(events.length
                ? [
                      {
                          name: 'event',
                          type: 'select' as const,
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
            { name: 'delay_minutes', type: 'integer' as const, label: 'Wait before asking (minutes)', defaultValue: 60, min: 0, max: 43200, helpText: 'Time between the event and the question: let the visit end first.' },
            { name: 'expires_after_days', type: 'integer' as const, label: 'Open for (days)', defaultValue: 7, min: 1, max: 90, helpText: 'Left unanswered this long, the question is dropped.' },
            { name: 'created_at', type: 'datetime' as const, label: 'Created', readonly: true, sortable: true },
            { name: 'updated_at', type: 'datetime' as const, label: 'Updated', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['title', ...(events.length ? ['event'] : []), 'targets', 'questions', 'active', 'updated_at'],
                sort: { field: 'id', direction: 'asc' as const },
                search: ['title'],
                filters: ['active', ...(events.length ? ['event'] : [])],
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Survey', fields: ['title', 'key', 'description', 'active'] },
                    { title: 'When it is asked', fields: [...(events.length ? ['event', 'targets'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
            create: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Survey', fields: ['title', 'description', 'active'] },
                    // The event's widget draws what it is narrowed to.
                    { title: 'When it is asked', fields: [...(events.length ? ['event'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
            edit: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Survey', fields: ['title', 'description', 'active'] },
                    { title: 'When it is asked', fields: [...(events.length ? ['event'] : []), 'delay_minutes', 'expires_after_days'] },
                    { title: 'Questions', fields: ['questions'] },
                ],
            },
        },
    }
}

/** Hooks first: the admin leaf reads a collection's hooks when it is registered. */
export function registerSurveyFormsAdmin(adminLeaf: any, config: ETHSurveyLeafConfig) {
    if (!adminLeaf?.hooks || !adminLeaf?.registerCollection) return
    registerHooks(adminLeaf)
    if (!adminLeaf.getCollection(FORMS_COLLECTION)) adminLeaf.registerCollection(formsCollection(config))
}
