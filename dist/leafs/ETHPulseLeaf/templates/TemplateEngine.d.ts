/**
 * Template Engine Configuration
 *
 * Global config injected into every email template as `config`.
 * All fields are optional and have sensible defaults.
 */
export interface SocialLinks {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
}
export interface TemplateConfig {
    /** Company / app name shown in header & footer */
    companyName?: string;
    /** URL to your logo (displayed in the email header) */
    logoUrl?: string;
    /** Primary brand color used for header gradient & buttons */
    primaryColor?: string;
    /** Secondary brand color used for gradient end */
    secondaryColor?: string;
    /** Copyright or legal text in the footer (e.g. "© 2026 Acme Inc. All rights reserved.") */
    footerText?: string;
    /** Small note at the very bottom of the email */
    footerNote?: string;
    /** Social media links displayed as icons in the footer */
    socialLinks?: SocialLinks;
}
export declare const defaultTemplateConfig: TemplateConfig;
