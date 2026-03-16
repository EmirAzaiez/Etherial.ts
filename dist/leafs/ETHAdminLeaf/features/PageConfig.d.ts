import { FieldDefinition } from './ActionRegistry.js';
export interface CustomPageForm {
    fields: FieldDefinition[];
    submitEndpoint: string;
    submitLabel?: string;
}
export interface PageConfig {
    name: string;
    title: string;
    icon?: string;
    group?: string;
    order?: number;
    component: string;
    showInMenu?: boolean;
    form?: CustomPageForm;
    meta?: Record<string, any>;
}
export interface SerializedPage {
    name: string;
    title: string;
    icon?: string;
    group?: string;
    order?: number;
    component: string;
    showInMenu: boolean;
    form?: {
        fields: FieldDefinition[];
        submitEndpoint: string;
        submitLabel?: string;
    };
    meta?: Record<string, any>;
}
