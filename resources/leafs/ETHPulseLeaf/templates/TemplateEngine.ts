/**
 * Template Engine Configuration
 */

export interface TemplateConfig {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
    companyName?: string
    footerText?: string
    socialLinks?: {
        twitter?: string
        instagram?: string
        facebook?: string
        linkedin?: string
        website?: string
    }
    customTemplatesPath?: string
}

export const defaultTemplateConfig: TemplateConfig = {
    primaryColor: '#6366F1',
    secondaryColor: '#818CF8',
    companyName: 'Your Company',
    footerText: '© 2026 Your Company. All rights reserved.',
}
