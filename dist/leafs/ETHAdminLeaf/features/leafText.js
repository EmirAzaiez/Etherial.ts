// ──────────────────────────────────────────────────────────────────────────
// The words of the leaf's own collections (staff roles, sign-ins, change
// history) in the back-office's language, `settings.locale`. The English is
// the key, as on the front: without a locale, or with one not listed here,
// every word stays the English one.
// ──────────────────────────────────────────────────────────────────────────
import etherial from 'etherial';
const FR = {
    // Staff roles
    'Admin Role': 'Rôle',
    'Admin Roles': 'Rôles du back-office',
    'New role': 'Nouveau rôle',
    'What each staff role can see and do in the back-office': 'Ce que chaque rôle peut voir et faire dans le back-office',
    'Tick a module to give the whole of it, or pick collection by collection.': 'Cochez un module pour le donner en entier, ou choisissez collection par collection.',
    Role: 'Rôle',
    'Staff with this role': 'Comptes avec ce rôle',
    Name: 'Nom',
    Description: 'Description',
    Permissions: 'Permissions',
    Created: 'Créé le',
    Updated: 'Modifié le',
    // Sign-ins
    Login: 'Connexion',
    'Back-office logins': 'Connexions au back-office',
    'Every sign-in to the back-office, successful or not': 'Chaque connexion au back-office, réussie ou refusée',
    Result: 'Résultat',
    'Signed in': 'Connecté',
    Refused: 'Refusée',
    Login_identifier: 'Identifiant',
    Account: 'Compte',
    Reason: 'Motif',
    'IP address': 'Adresse IP',
    Browser: 'Navigateur',
    'User agent': 'User agent',
    Date: 'Date',
    Attempt: 'Tentative',
    Origin: 'Origine',
    'Wrong credentials': 'Identifiants incorrects',
    'No back-office access': 'Pas d’accès au back-office',
    'Too many attempts': 'Trop de tentatives',
    'Too many sign-ins in a minute': 'Trop de connexions en une minute',
    on_client: 'sur',
    // Change history
    Change: 'Modification',
    'Change history': 'Historique des modifications',
    'Every change to a record, who made it and what it was before': 'Chaque modification d’une fiche : qui l’a faite et ce qu’il y avait avant',
    Created_action: 'Création',
    Edited: 'Modification',
    Deleted: 'Suppression',
    Restored: 'Restauration',
    Collection: 'Collection',
    Record: 'Fiche',
    By: 'Par',
    'A person': 'Une personne',
    System: 'Système',
    'Signed-out visitor': 'Visiteur non connecté',
    Person: 'Personne',
    Author: 'Auteur',
    Through: 'Via',
    'Back office': 'Back-office',
    App: 'App',
    Changes: 'Changements',
    Context: 'Contexte',
    Details: 'Détails',
};
const LANGUAGES = { fr: FR };
/**
 * The translator for `locale` (`fr`, `fr-FR`): `t('Change history')`. A word
 * that needs two translations takes a context, looked up as `text_context`
 * first (`t('Created', 'action')`).
 */
export function leafText(locale) {
    const words = locale ? LANGUAGES[String(locale).toLowerCase().split(/[-_]/)[0]] : undefined;
    if (!words)
        return (text) => text;
    const t = (text, context) => (context && words[`${text}_${context}`]) || words[text] || text;
    t.active = true;
    return t;
}
/** The field names a display template reads: `{firstname} {lastname|email}` → firstname, lastname, email. */
export function templateFields(template) {
    if (!template)
        return [];
    const names = new Set();
    for (const [, inner] of template.matchAll(/\{([^}]+)\}/g)) {
        for (const name of inner.split('|'))
            if (name.trim())
                names.add(name.trim());
    }
    return [...names];
}
/** The template's fields that are columns of the Sequelize model `modelName` (all of them when it isn't found). */
export function modelTemplateFields(template, modelName) {
    var _a, _b, _c, _d;
    const fields = templateFields(template);
    const columns = (_d = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c[modelName]) === null || _d === void 0 ? void 0 : _d.rawAttributes;
    return columns ? fields.filter((name) => name in columns) : fields;
}
/**
 * A display template filled from a record, as the back-office fills it:
 * `{a|b}` is the first of them that isn't empty. Null when nothing came out.
 */
export function fillTemplate(template, get) {
    const out = template
        .replace(/\{([^}]+)\}/g, (_, inner) => {
        for (const name of inner.split('|')) {
            const value = get(name.trim());
            if (value !== null && value !== undefined && String(value).trim() !== '')
                return String(value).trim();
        }
        return '';
    })
        .replace(/\s+/g, ' ')
        .trim();
    return out || null;
}
