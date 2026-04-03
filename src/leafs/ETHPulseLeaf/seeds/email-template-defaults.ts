/**
 * Default email template content per key and locale.
 * Used by the `seed-email-templates` CLI command.
 *
 * Each key maps to a locale -> content object.
 * If a locale is requested but not defined here, it falls back to 'en'.
 */

interface TemplateContent {
    subject: string
    title?: string
    greeting?: string
    body: string
    button_text?: string
    button_url?: string
    footer?: string
}

type TemplateDefaults = Record<string, Record<string, TemplateContent>>

export const emailTemplateDefaults: TemplateDefaults = {

    password_reset: {
        en: {
            subject: 'Reset your password',
            title: 'Password Reset',
            greeting: 'Hello {{firstname}},',
            body: '<p>You requested a password reset. Click the button below to set a new password.</p><p>If you did not request this, you can safely ignore this email.</p>',
            button_text: 'Reset Password',
            button_url: '{{resetUrl}}',
            footer: 'This link will expire in 1 hour.',
        },
        fr: {
            subject: 'Reinitialiser votre mot de passe',
            title: 'Reinitialisation du mot de passe',
            greeting: 'Bonjour {{firstname}},',
            body: '<p>Vous avez demande la reinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en definir un nouveau.</p><p>Si vous n\'avez pas fait cette demande, vous pouvez ignorer cet email.</p>',
            button_text: 'Reinitialiser le mot de passe',
            button_url: '{{resetUrl}}',
            footer: 'Ce lien expire dans 1 heure.',
        },
        ar: {
            subject: 'اعادة تعيين كلمة المرور',
            title: 'اعادة تعيين كلمة المرور',
            greeting: '{{firstname}} مرحبا',
            body: '<p>لقد طلبت اعادة تعيين كلمة المرور. انقر على الزر ادناه لتعيين كلمة مرور جديدة.</p><p>اذا لم تقم بهذا الطلب، يمكنك تجاهل هذا البريد الالكتروني.</p>',
            button_text: 'اعادة تعيين كلمة المرور',
            button_url: '{{resetUrl}}',
            footer: 'ينتهي هذا الرابط خلال ساعة واحدة.',
        },
    },

    email_verification: {
        en: {
            subject: 'Verify your email address',
            title: 'Email Verification',
            greeting: 'Hello {{firstname}},',
            body: '<p>Thank you for signing up! Please verify your email address by clicking the button below.</p>',
            button_text: 'Verify Email',
            button_url: '{{verifyUrl}}',
            footer: 'If you did not create an account, please ignore this email.',
        },
        fr: {
            subject: 'Verifiez votre adresse email',
            title: 'Verification de l\'email',
            greeting: 'Bonjour {{firstname}},',
            body: '<p>Merci pour votre inscription ! Veuillez verifier votre adresse email en cliquant sur le bouton ci-dessous.</p>',
            button_text: 'Verifier l\'email',
            button_url: '{{verifyUrl}}',
            footer: 'Si vous n\'avez pas cree de compte, veuillez ignorer cet email.',
        },
        ar: {
            subject: 'تحقق من بريدك الالكتروني',
            title: 'التحقق من البريد الالكتروني',
            greeting: '{{firstname}} مرحبا',
            body: '<p>شكرا لتسجيلك! يرجى التحقق من بريدك الالكتروني بالنقر على الزر ادناه.</p>',
            button_text: 'تحقق من البريد',
            button_url: '{{verifyUrl}}',
            footer: 'اذا لم تقم بانشاء حساب، يرجى تجاهل هذا البريد.',
        },
    },

    welcome: {
        en: {
            subject: 'Welcome to {{appName}}!',
            title: 'Welcome!',
            greeting: 'Hello {{firstname}},',
            body: '<p>Welcome to <strong>{{appName}}</strong>! We\'re excited to have you on board.</p><p>If you have any questions, feel free to reach out to our support team.</p>',
            footer: 'Thank you for joining us!',
        },
        fr: {
            subject: 'Bienvenue sur {{appName}} !',
            title: 'Bienvenue !',
            greeting: 'Bonjour {{firstname}},',
            body: '<p>Bienvenue sur <strong>{{appName}}</strong> ! Nous sommes ravis de vous compter parmi nous.</p><p>Si vous avez des questions, n\'hesitez pas a contacter notre equipe de support.</p>',
            footer: 'Merci de nous avoir rejoints !',
        },
        ar: {
            subject: '!{{appName}} مرحبا بك في',
            title: '!مرحبا',
            greeting: '{{firstname}} مرحبا',
            body: '<p>اهلا بك في <strong>{{appName}}</strong>! نحن سعداء بانضمامك الينا.</p><p>اذا كان لديك اي اسئلة، لا تتردد في التواصل مع فريق الدعم.</p>',
            footer: 'شكرا لانضمامك!',
        },
    },

    password_changed: {
        en: {
            subject: 'Your password has been changed',
            title: 'Password Changed',
            greeting: 'Hello {{firstname}},',
            body: '<p>Your password has been successfully changed.</p><p>If you did not make this change, please contact our support team immediately.</p>',
            footer: 'For your security, this notification was sent to your registered email.',
        },
        fr: {
            subject: 'Votre mot de passe a ete modifie',
            title: 'Mot de passe modifie',
            greeting: 'Bonjour {{firstname}},',
            body: '<p>Votre mot de passe a ete modifie avec succes.</p><p>Si vous n\'avez pas effectue ce changement, veuillez contacter notre equipe de support immediatement.</p>',
            footer: 'Pour votre securite, cette notification a ete envoyee a votre adresse email enregistree.',
        },
        ar: {
            subject: 'تم تغيير كلمة المرور الخاصة بك',
            title: 'تم تغيير كلمة المرور',
            greeting: '{{firstname}} مرحبا',
            body: '<p>تم تغيير كلمة المرور الخاصة بك بنجاح.</p><p>اذا لم تقم بهذا التغيير، يرجى الاتصال بفريق الدعم فورا.</p>',
            footer: 'لأمانك، تم ارسال هذا الاشعار الى بريدك الالكتروني المسجل.',
        },
    },
}

/**
 * Get default content for a template key + locale.
 * Falls back to 'en' if the requested locale doesn't exist.
 * Returns a generic skeleton if the key is unknown.
 */
export function getDefaultContent(key: string, locale: string): TemplateContent {
    const keyDefaults = emailTemplateDefaults[key]

    if (keyDefaults) {
        return keyDefaults[locale] || keyDefaults['en'] || Object.values(keyDefaults)[0]
    }

    // Generic skeleton for unknown keys
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return {
        subject: label,
        title: label,
        greeting: locale === 'ar' ? '{{firstname}} مرحبا' : (locale === 'fr' ? 'Bonjour {{firstname}},' : 'Hello {{firstname}},'),
        body: `<p>${label}</p>`,
    }
}
