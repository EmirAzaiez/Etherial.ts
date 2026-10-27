import { PageBlocks } from './options.js';
export interface TemplateOut {
    id: number;
    name: string;
    blocks: PageBlocks;
    created_at: Date;
    updated_at: Date;
}
/** Every template, the newest first. */
export declare function listTemplates(): Promise<TemplateOut[]>;
export declare function createTemplate(body: Record<string, any>): Promise<TemplateOut>;
/** Renamed, or its blocks rewritten: only what the body gives changes. */
export declare function updateTemplate(id: string | number, body: Record<string, any>): Promise<TemplateOut>;
export declare function deleteTemplate(id: string | number): Promise<{
    id: number;
}>;
