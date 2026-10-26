import { AppRelease } from '../models/AppRelease.js'
import { Banner } from '../models/Banner.js'
import { Contact } from '../models/Contact.js'
import { ContentLanguage } from '../models/ContentLanguage.js'
import { FaqQuestion } from '../models/FaqQuestion.js'
import { FaqSection } from '../models/FaqSection.js'
import { LegalDocument } from '../models/LegalDocument.js'
import { Office } from '../models/Office.js'
import { Story } from '../models/Story.js'
import { StorySlide } from '../models/StorySlide.js'
import {
    AUDIENCES,
    COLLECTIONS,
    CONTACT_KINDS,
    ContentFeature,
    ETHContentLeafConfig,
    LANGUAGES,
    PLATFORMS,
    PLATFORM_NAMES,
    PROMPTS,
    featuresOf,
    folderOf,
} from '../services/options.js'
import { languages, state } from '../services/state.js'

type Crud = ('list' | 'show' | 'create' | 'update' | 'delete')[]
const CRUD: Crud = ['list', 'show', 'create', 'update', 'delete']

const IMAGES = ['image/jpeg', 'image/png', 'image/webp']

const KIND_LABELS: Record<string, string> = {
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    email: 'Email',
    website: 'Website',
    instagram: 'Instagram',
    facebook: 'Facebook',
    x: 'X (Twitter)',
    linkedin: 'LinkedIn',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    snapchat: 'Snapchat',
}

const AUDIENCE_LABELS: Record<string, string> = { everyone: 'Everyone', signed_in: 'Signed-in users', guests: 'Guests only' }

const PROMPT_LABELS: Record<string, string> = {
    auto: 'A banner if it is a new major version',
    banner: 'A banner, always',
    required: 'Blocked until updated',
}

/** The languages as a text field's switch has them. */
function switchOf() {
    const { all, default: defaultLocale, names, rtl } = languages()
    return { locales: all, defaultLocale, localeLabels: names, rtlLocales: rtl }
}

/**
 * Every text field's language switch. The back-office reads the fields at
 * each schema request: a language added or removed in Content › Languages
 * shows on its next load, without a restart.
 */
const switches: Record<string, any>[] = []
state.onLanguages.push(() => {
    const now = switchOf()
    for (const s of switches) Object.assign(s, now)
})

function collectionsOf(config: ETHContentLeafConfig) {
    const folder = folderOf(config)
    const group = config.admin?.group ?? 'Content'
    const order = config.admin?.order ?? 60
    // The same language switch for every text of a form, its cards' included.
    const translations = (type: 'string' | 'text' | 'richtext') => {
        const s = { ...switchOf(), field: { type } }
        switches.push(s)
        return s
    }
    const text = (name: string, label: string, type: 'string' | 'text' | 'richtext', extra: Record<string, any> = {}) => ({
        name,
        type: 'translations',
        label,
        col: 12,
        translations: translations(type),
        ...extra,
    })
    const image = (name: string, label: string, extra: Record<string, any> = {}) => ({
        name,
        type: 'media',
        label,
        col: 12,
        media: { folder, accept: IMAGES, preview: true },
        ...extra,
    })
    const position = (label = 'Order') => ({ name: 'position', type: 'integer', label, sortable: true, defaultValue: 0, hidden: true })
    const published = (defaultValue: boolean, helpText: string) => ({
        name: 'published',
        type: 'boolean',
        label: 'Published',
        defaultValue,
        filterable: true,
        col: 4,
        helpText,
    })
    const schedule = [
        {
            name: 'audience',
            type: 'select',
            label: 'Shown to',
            defaultValue: 'everyone',
            filterable: true,
            col: 4,
            options: AUDIENCES.map((value) => ({ value, label: AUDIENCE_LABELS[value] })),
        },
        { name: 'starts_at', type: 'datetime', label: 'From', sortable: true, col: 4, helpText: 'Empty: as soon as it is published.' },
        { name: 'ends_at', type: 'datetime', label: 'Until', sortable: true, col: 4, helpText: 'Empty: until it is unpublished.' },
    ]
    const updated = { name: 'updated_at', type: 'datetime', label: 'Updated', readonly: true, sortable: true }
    // Its texts are a column per language (JSON): lists show, search and sort the default language's, in `label`.
    const label = (title: string) => ({ name: 'label', type: 'string', label: title, readonly: true, searchable: true, sortable: true })
    const meta = (label: string, labelPlural: string, icon: string, description: string, rank: number) => ({
        label,
        labelPlural,
        icon,
        description,
        group,
        order: order + rank,
    })
    // A child's own collection: written in its parent's form, never on its own page.
    const childMeta = (label: string, labelPlural: string) => ({ label, labelPlural, hidden: true, group })

    const all: Record<ContentFeature, { name: string; [key: string]: any }[]> = {
        languages: [
            {
                name: COLLECTIONS.languages,
                model: ContentLanguage,
                crud: CRUD,
                meta: meta('Language', 'Languages', 'settings', 'The languages the contents are written in, and those the app gets', 7),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    {
                        name: 'code',
                        type: 'select',
                        label: 'Language',
                        required: true,
                        filterable: true,
                        col: 6,
                        options: Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l.native === l.name ? l.name : `${l.native} (${l.name})` })),
                        helpText: 'Its fields appear in every content’s form once the back-office is reloaded. It can’t be changed afterwards.',
                    },
                    { name: 'name', type: 'string', label: 'Name', maxLength: 40, searchable: true, sortable: true, col: 6, helpText: 'As the app’s language picker shows it. Empty: its own name (Français).' },
                    {
                        name: 'published',
                        type: 'boolean',
                        label: 'In the app',
                        defaultValue: false,
                        filterable: true,
                        col: 4,
                        helpText: 'Off while it is being translated: the team writes it here, the app gets the default language meanwhile.',
                    },
                    {
                        name: 'is_default',
                        type: 'boolean',
                        label: 'Default language',
                        defaultValue: false,
                        filterable: true,
                        col: 4,
                        helpText: 'What a text missing in another language falls back to, so every content needs it. Switched once every content has it.',
                    },
                    { name: 'rtl', type: 'boolean', label: 'Right to left', col: 4, helpText: 'Arabic, Hebrew, Persian, Urdu are, as they are added.' },
                    updated,
                ],
                views: {
                    list: { fields: ['name', 'code', 'is_default', 'published', 'rtl'], sort: { field: 'id', direction: 'asc' }, search: ['name'], filters: ['published'] },
                    show: { layout: 'sections', sections: [{ title: 'Language', fields: ['code', 'name', 'published', 'is_default', 'rtl', 'updated_at'] }] },
                    // Its code is chosen once, its writing direction follows it.
                    create: { layout: 'sections', sections: [{ title: 'Language', fields: ['code', 'name', 'published'] }] },
                    edit: { layout: 'sections', sections: [{ title: 'Language', fields: ['name', 'published', 'is_default', 'rtl'] }] },
                },
            },
        ],
        faq: [
            {
                name: COLLECTIONS.faq,
                model: FaqSection,
                crud: CRUD,
                meta: meta('FAQ section', 'FAQ', 'message-square', 'The questions of Help & FAQ, by section, in each language', 0),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    text('title', 'Section', 'string', { required: true, helpText: 'General, Payments, Customer support…' }),
                    label('Section'),
                    published(true, 'Off: the section and its questions are hidden in the app.'),
                    {
                        name: 'questions',
                        type: 'hasMany',
                        label: 'Questions',
                        helpText: 'Dragged into place, the first one on top.',
                        hasMany: {
                            collection: COLLECTIONS.faqQuestions,
                            foreignKey: 'section_id',
                            fields: ['question', 'answer', 'published'],
                            layout: 'card',
                            sortable: true,
                            orderField: 'position',
                            titleField: 'label',
                            collapsible: true,
                            defaultCollapsed: true,
                            addLabel: 'Add a question',
                            deleteConfirm: 'Remove this question, in every language?',
                        },
                    },
                    position('Order in the FAQ'),
                    updated,
                ],
                views: {
                    list: {
                        fields: ['label', 'published', 'updated_at'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['label'],
                        filters: ['published'],
                        reorder: { details: ['published'], orders: [{ field: 'position', label: 'Order', description: 'The sections of the FAQ, top to bottom' }] },
                    },
                    show: { layout: 'sections', sections: [{ title: 'Section', fields: ['title', 'published'] }, { title: 'Questions', fields: ['questions'] }] },
                    create: { layout: 'sections', sections: [{ title: 'Section', fields: ['title', 'published'] }, { title: 'Questions', fields: ['questions'] }] },
                    edit: { layout: 'sections', sections: [{ title: 'Section', fields: ['title', 'published'] }, { title: 'Questions', fields: ['questions'] }] },
                },
            },
            {
                name: COLLECTIONS.faqQuestions,
                model: FaqQuestion,
                crud: CRUD,
                meta: childMeta('FAQ question', 'FAQ questions'),
                fields: [
                    { name: 'id', type: 'integer', readonly: true },
                    { name: 'section_id', type: 'relation', relation: { collection: COLLECTIONS.faq, displayField: 'label' }, hidden: true },
                    text('question', 'Question', 'string', { required: true }),
                    text('answer', 'Answer', 'text', { required: true, helpText: 'A blank line between two paragraphs.' }),
                    label('Question'),
                    { ...published(true, 'Off: hidden in the app.'), col: 12 },
                    position(),
                ],
                views: { list: { fields: ['label', 'published'], sort: { field: 'position', direction: 'asc' }, search: ['label'] } },
            },
        ],
        contacts: [
            {
                name: COLLECTIONS.contacts,
                model: Contact,
                crud: CRUD,
                meta: meta('Contact', 'Contacts', 'smartphone', 'The phone numbers, WhatsApp, emails and social accounts the app shows', 1),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    {
                        name: 'kind',
                        type: 'select',
                        label: 'Kind',
                        required: true,
                        filterable: true,
                        col: 4,
                        options: CONTACT_KINDS.map((value) => ({ value, label: KIND_LABELS[value] })),
                        helpText: 'The app picks its icon and its link from it.',
                    },
                    {
                        name: 'value',
                        type: 'string',
                        label: 'Number, address or link',
                        required: true,
                        searchable: true,
                        maxLength: 300,
                        col: 8,
                        helpText: '+971 4 123 4567 for a phone or a WhatsApp, care@… for an email, https://… for a site or an account.',
                    },
                    text('label', 'Name', 'string', { helpText: 'Customer care, Sales… Empty: named after its kind.' }),
                    text('hours', 'Hours', 'string', { helpText: 'Sun–Thu, 9:00–17:00' }),
                    published(true, 'Off: hidden in the app.'),
                    position(),
                    updated,
                ],
                views: {
                    list: {
                        fields: ['kind', 'value', 'published', 'updated_at'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['value'],
                        filters: ['kind', 'published'],
                        reorder: { details: ['value', 'published'], orders: [{ field: 'position', label: 'Order', description: 'The contacts in the app, top to bottom' }] },
                    },
                },
            },
            {
                name: COLLECTIONS.offices,
                model: Office,
                crud: CRUD,
                meta: meta('Office', 'Offices', 'map-pin', 'The offices and sales centers: address, hours, map', 2),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    text('name', 'Name', 'string', { required: true, helpText: 'Head office, Dubai sales center…' }),
                    label('Name'),
                    text('address', 'Address', 'text'),
                    text('hours', 'Hours', 'string', { helpText: 'Sun–Thu, 9:00–17:00' }),
                    { name: 'phone', type: 'string', label: 'Phone', maxLength: 40, col: 6 },
                    { name: 'email', type: 'string', label: 'Email', maxLength: 200, col: 6 },
                    {
                        name: 'location_map',
                        type: 'map-picker',
                        label: 'On the map',
                        col: 12,
                        map: { latField: 'latitude', lngField: 'longitude' },
                        helpText: 'Click the map, or search an address, to drop the pin.',
                    },
                    { name: 'latitude', type: 'number', label: 'Latitude', col: 6 },
                    { name: 'longitude', type: 'number', label: 'Longitude', col: 6 },
                    { name: 'map_url', type: 'url', label: 'Map link', col: 12, helpText: 'A Google Maps link. Empty: the app opens the pin.' },
                    published(true, 'Off: hidden in the app.'),
                    position(),
                    updated,
                ],
                views: {
                    list: {
                        fields: ['label', 'phone', 'published', 'updated_at'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['label', 'phone'],
                        filters: ['published'],
                        reorder: { details: ['phone', 'published'], orders: [{ field: 'position', label: 'Order', description: 'The offices in the app, top to bottom' }] },
                    },
                    show: {
                        layout: 'sections',
                        sections: [
                            { title: 'Office', fields: ['name', 'address', 'hours', 'phone', 'email', 'published'] },
                            { title: 'Location', fields: ['location_map', 'latitude', 'longitude', 'map_url'] },
                        ],
                    },
                    create: {
                        layout: 'sections',
                        sections: [
                            { title: 'Office', fields: ['name', 'address', 'hours', 'phone', 'email', 'published'] },
                            { title: 'Location', fields: ['location_map', 'latitude', 'longitude', 'map_url'] },
                        ],
                    },
                    edit: {
                        layout: 'sections',
                        sections: [
                            { title: 'Office', fields: ['name', 'address', 'hours', 'phone', 'email', 'published'] },
                            { title: 'Location', fields: ['location_map', 'latitude', 'longitude', 'map_url'] },
                        ],
                    },
                },
            },
        ],
        legal: [
            {
                name: COLLECTIONS.legal,
                model: LegalDocument,
                crud: CRUD,
                meta: meta('Legal document', 'Legal documents', 'shield', 'Terms of use, privacy policy…: the text, or the page of the website', 3),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    text('title', 'Title', 'string', { required: true }),
                    label('Title'),
                    {
                        name: 'slug',
                        type: 'string',
                        label: 'Address',
                        searchable: true,
                        sortable: true,
                        maxLength: 80,
                        col: 4,
                        helpText: 'What the app asks for: terms, privacy. Empty: made from the title. Changing it breaks the app’s link.',
                    },
                    { name: 'version', type: 'string', label: 'Version', maxLength: 40, col: 4, helpText: '2026-10, v3… Shown under the title.' },
                    published(false, "Off: a draft, the app doesn't see it."),
                    text('body', 'Text', 'richtext'),
                    text('url', 'Or a page of the website', 'string', {
                        helpText: 'https://… The app opens it instead of the text. In each language, if the website has one.',
                    }),
                    position(),
                    { name: 'published_at', type: 'datetime', label: 'First published', readonly: true, sortable: true },
                    updated,
                ],
                views: {
                    list: {
                        fields: ['label', 'slug', 'version', 'published', 'updated_at'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['label', 'slug'],
                        filters: ['published'],
                        reorder: { details: ['slug', 'published'], orders: [{ field: 'position', label: 'Order', description: 'The documents in the app, top to bottom' }] },
                    },
                    show: {
                        layout: 'sections',
                        sections: [
                            { title: 'Document', fields: ['title', 'slug', 'version', 'published', 'published_at'] },
                            { title: 'Content', fields: ['body', 'url'] },
                        ],
                    },
                    create: {
                        layout: 'sections',
                        sections: [
                            { title: 'Document', fields: ['title', 'slug', 'version', 'published'] },
                            { title: 'Content', fields: ['body', 'url'] },
                        ],
                    },
                    edit: {
                        layout: 'sections',
                        sections: [
                            { title: 'Document', fields: ['title', 'slug', 'version', 'published'] },
                            { title: 'Content', fields: ['body', 'url'] },
                        ],
                    },
                },
            },
        ],
        banners: [
            {
                name: COLLECTIONS.banners,
                model: Banner,
                crud: CRUD,
                meta: meta('Banner', 'Banners', 'image', "The home screen's carousel: an image and where a tap goes", 4),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    image('image_id', 'Image', { required: true, helpText: 'Wide: 16:9, at least 1200 px across.' }),
                    text('title', 'Title', 'string', { helpText: 'On the image. Empty: the image alone.' }),
                    label('Title'),
                    text('subtitle', 'Subtitle', 'string'),
                    text('button', 'Button', 'string', { helpText: 'Discover, Book now… Empty: the whole banner opens the link.' }),
                    {
                        name: 'link',
                        type: 'string',
                        label: 'Link',
                        maxLength: 500,
                        col: 12,
                        helpText: 'https://… or a link of the app’s own. Empty: nothing opens.',
                    },
                    ...schedule,
                    published(false, "Off: a draft, the app doesn't see it."),
                    position(),
                    updated,
                ],
                views: {
                    list: {
                        fields: ['image_id', 'label', 'audience', 'starts_at', 'ends_at', 'published'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['label', 'link'],
                        filters: ['published', 'audience'],
                        reorder: { details: ['audience', 'published'], orders: [{ field: 'position', label: 'Order', description: 'The carousel, first to last' }] },
                    },
                    show: {
                        layout: 'sections',
                        sections: [
                            { title: 'Banner', fields: ['image_id', 'title', 'subtitle', 'button', 'link'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published'] },
                        ],
                    },
                    create: {
                        layout: 'sections',
                        sections: [
                            { title: 'Banner', fields: ['image_id', 'title', 'subtitle', 'button', 'link'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published'] },
                        ],
                    },
                    edit: {
                        layout: 'sections',
                        sections: [
                            { title: 'Banner', fields: ['image_id', 'title', 'subtitle', 'button', 'link'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published'] },
                        ],
                    },
                },
            },
        ],
        stories: [
            {
                name: COLLECTIONS.stories,
                model: Story,
                crud: CRUD,
                meta: meta('Story', 'Stories', 'play-circle', 'Full-screen slides behind a bubble of the home screen', 5),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    text('title', 'Title', 'string', { required: true, helpText: 'Under the bubble: a word or two.' }),
                    label('Title'),
                    image('cover_id', 'Bubble', { helpText: 'Square. Empty: the first slide’s image.' }),
                    {
                        name: 'slides',
                        type: 'hasMany',
                        label: 'Slides',
                        helpText: 'Dragged into place, the first one shown first.',
                        hasMany: {
                            collection: COLLECTIONS.storySlides,
                            foreignKey: 'story_id',
                            fields: ['image_id', 'title', 'text', 'button', 'link', 'duration'],
                            layout: 'card',
                            sortable: true,
                            orderField: 'position',
                            titleField: 'label',
                            previewField: 'image_id',
                            collapsible: true,
                            min: 1,
                            addLabel: 'Add a slide',
                            deleteConfirm: 'Remove this slide?',
                        },
                    },
                    ...schedule,
                    published(false, "Off: a draft, the app doesn't see it."),
                    position(),
                    { name: 'published_at', type: 'datetime', label: 'First published', readonly: true, sortable: true },
                    updated,
                ],
                views: {
                    list: {
                        fields: ['cover_id', 'label', 'audience', 'starts_at', 'ends_at', 'published'],
                        sort: { field: 'position', direction: 'asc' },
                        search: ['label'],
                        filters: ['published', 'audience'],
                        reorder: { details: ['audience', 'published'], orders: [{ field: 'position', label: 'Order', description: 'The bubbles, left to right' }] },
                    },
                    show: {
                        layout: 'sections',
                        sections: [
                            { title: 'Story', fields: ['title', 'cover_id'] },
                            { title: 'Slides', fields: ['slides'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published', 'published_at'] },
                        ],
                    },
                    create: {
                        layout: 'sections',
                        sections: [
                            { title: 'Story', fields: ['title', 'cover_id'] },
                            { title: 'Slides', fields: ['slides'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published'] },
                        ],
                    },
                    edit: {
                        layout: 'sections',
                        sections: [
                            { title: 'Story', fields: ['title', 'cover_id'] },
                            { title: 'Slides', fields: ['slides'] },
                            { title: 'Publishing', fields: ['audience', 'starts_at', 'ends_at', 'published'] },
                        ],
                    },
                },
            },
            {
                name: COLLECTIONS.storySlides,
                model: StorySlide,
                crud: CRUD,
                meta: childMeta('Story slide', 'Story slides'),
                fields: [
                    { name: 'id', type: 'integer', readonly: true },
                    { name: 'story_id', type: 'relation', relation: { collection: COLLECTIONS.stories, displayField: 'label' }, hidden: true },
                    image('image_id', 'Image', { required: true, helpText: 'Upright: 9:16, at least 1080 px across.' }),
                    text('title', 'Title', 'string'),
                    text('text', 'Text', 'text'),
                    text('button', 'Button', 'string', { helpText: 'Learn more… Shown only with a link.' }),
                    { name: 'link', type: 'string', label: 'Link', maxLength: 500, col: 8, helpText: 'https://… or a link of the app’s own.' },
                    { name: 'duration', type: 'integer', label: 'Seconds', defaultValue: 5, min: 2, max: 30, col: 4 },
                    label('Title'),
                    position(),
                ],
                views: { list: { fields: ['image_id', 'label', 'duration'], sort: { field: 'position', direction: 'asc' }, search: ['label'] } },
            },
        ],
        versions: [
            {
                name: COLLECTIONS.versions,
                model: AppRelease,
                crud: CRUD,
                meta: meta('App version', 'App versions', 'refresh-cw', 'The versions on the stores, and whether an older app is asked to update', 6),
                fields: [
                    { name: 'id', type: 'integer', readonly: true, sortable: true },
                    {
                        name: 'platform',
                        type: 'select',
                        label: 'Store',
                        required: true,
                        filterable: true,
                        col: 4,
                        options: PLATFORMS.map((value) => ({ value, label: PLATFORM_NAMES[value] })),
                    },
                    {
                        name: 'version',
                        type: 'string',
                        label: 'Version',
                        required: true,
                        searchable: true,
                        maxLength: 20,
                        col: 4,
                        helpText: '2.0.0, exactly as on the store.',
                    },
                    {
                        name: 'prompt',
                        type: 'select',
                        label: 'Older apps get',
                        required: true,
                        defaultValue: 'auto',
                        filterable: true,
                        col: 4,
                        options: PROMPTS.map((value) => ({ value, label: PROMPT_LABELS[value] })),
                        helpText: 'A banner can be closed. Blocked: the app shows nothing else until it is updated.',
                    },
                    { name: 'label', type: 'string', label: 'Version', readonly: true, searchable: true, sortable: true },
                    text('title', 'Title', 'string', { helpText: 'Empty: “A new version is available”, or “Update required”.' }),
                    text('message', 'Message', 'text', { helpText: 'What is new, or why it is required. Empty: a line of the leaf’s.' }),
                    published(false, 'On once the version is out on the store: before, the button leads to the version before.'),
                    { name: 'published_at', type: 'datetime', label: 'Published', readonly: true, sortable: true },
                    updated,
                ],
                views: {
                    list: {
                        fields: ['label', 'prompt', 'published', 'published_at'],
                        sort: { field: 'id', direction: 'desc' },
                        search: ['label'],
                        filters: ['platform', 'prompt', 'published'],
                    },
                    show: {
                        layout: 'sections',
                        sections: [
                            { title: 'Version', fields: ['platform', 'version', 'prompt', 'published', 'published_at'] },
                            { title: 'Banner', fields: ['title', 'message'] },
                        ],
                    },
                    create: {
                        layout: 'sections',
                        sections: [
                            { title: 'Version', fields: ['platform', 'version', 'prompt', 'published'] },
                            { title: 'Banner', fields: ['title', 'message'] },
                        ],
                    },
                    edit: {
                        layout: 'sections',
                        sections: [
                            { title: 'Version', fields: ['platform', 'version', 'prompt', 'published'] },
                            { title: 'Banner', fields: ['title', 'message'] },
                        ],
                    },
                },
            },
        ],
    }

    return featuresOf(config).flatMap((feature) => all[feature] ?? [])
}

/** Every collection of the contents the project offers. Kept when the project registered one of the same name. */
export function registerContentAdmin(adminLeaf: any, config: ETHContentLeafConfig) {
    if (!adminLeaf?.registerCollection) return
    for (const collection of collectionsOf(config)) {
        if (!adminLeaf.getCollection?.(collection.name)) adminLeaf.registerCollection(collection)
    }
}
