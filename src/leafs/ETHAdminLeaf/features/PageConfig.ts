import { FieldDefinition } from './ActionRegistry.js'

export interface CustomPageForm {
    fields: FieldDefinition[]
    submitEndpoint: string
    submitLabel?: string
}

export interface PageConfig {
    name: string           // slug unique, used as route
    title: string          // displayed in sidebar + header
    icon?: string          // lucide icon name
    group?: string         // sidebar group (same system as collections)
    order?: number
    component: string      // React component name on the frontend
    showInMenu?: boolean   // default true
    form?: CustomPageForm  // if present, auto-rendered form
    meta?: Record<string, any>
    // Optional per-page authorization on top of canAccessAdmin.
    // Return false to forbid; throw to forbid with a custom message.
    canAccess?: (user: any) => boolean | Promise<boolean>
}

export interface SerializedPage {
    name: string
    title: string
    icon?: string
    group?: string
    order?: number
    component: string
    showInMenu: boolean
    form?: { fields: FieldDefinition[]; submitEndpoint: string; submitLabel?: string }
    meta?: Record<string, any>
}
