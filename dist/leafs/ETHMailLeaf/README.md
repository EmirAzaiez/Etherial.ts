# ETHMailLeaf

Les emails qu'un projet envoie, dessinés une fois dans le code et retouchés dans le back-office.

Le principe :

1. Le projet **liste ses emails dans le code** : une clé, les variables que le code remplit, et le texte dans chaque langue, en **blocs** (titre, texte, bouton, code, note…).
2. Le leaf en fait un email qui s'affiche bien partout (Gmail, Outlook, Apple Mail, mobile), aux couleurs et au logo du projet, **de droite à gauche en arabe**.
3. La page **Emails** du back-office réécrit n'importe lequel, langue par langue, avec un aperçu en direct et un envoi de test. Sa version part **à la place** de celle du code, jusqu'à ce qu'on la réinitialise. **Chaque version enregistrée est gardée** : on peut revenir à n'importe laquelle.
4. La **charte** (logo, couleurs, polices, pied de page) se modifie aussi dans le back-office.
5. Avec `campaigns`, le back-office écrit aussi ses **propres emails** (newsletters, annonces) et les envoie à une audience, à une date, au rythme du serveur SMTP, avec un **lien de désabonnement** qui marche.
6. L'envoi passe par **ETHPulseLeaf** (son provider email), qui garde le journal de **tous** les messages partis, campagnes comprises.

Le leaf crée ses tables par le `sync` du projet :

| Table | Contient |
|-------|----------|
| `mail_templates` | Les versions réécrites dans le back-office, une par email et par langue. Sans réécriture, c'est la version du code qui part. |
| `mail_template_versions` | L'historique : chaque enregistrement et chaque réinitialisation. |
| `mail_settings` | La charte du back-office, et le secret qui signe les liens de désabonnement. |
| `mail_campaigns`, `mail_campaign_recipients` | Les campagnes et, pour chacune, chaque destinataire avec son statut. |
| `mail_unsubscribes` | Les adresses désabonnées des campagnes. |

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHMailLeaf from 'etherial/leafs/ETHMailLeaf/app'
import { emailsConfig } from './emails'

export default {
    // ... eth_pulse_leaf, eth_admin_leaf ...
    eth_mail_leaf: {
        module: ETHMailLeaf,
        config: emailsConfig,
    },
}
```

Le leaf se déclare au back-office dans `afterRun`, une fois tous les leafs lancés : sa place dans la config n'a pas d'importance. Les emails partent par le provider email d'ETHPulseLeaf. Sans ETHPulseLeaf, ils se dessinent mais ne partent pas : un avertissement le dit au démarrage.

### src/emails.ts

```ts
import type { ETHMailLeafConfig } from 'etherial/leafs/ETHMailLeaf/app'

export const emailsConfig: ETHMailLeafConfig = {
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    // La langue d'un utilisateur, quand l'appel n'en donne pas. null : la langue par défaut.
    locale: (user) => (user?.language_id === 2 ? 'ar' : user?.language_id === 1 ? 'en' : null),

    theme: {
        brandName: { en: 'RETAL', ar: 'رتال' },
        logoUrl: 'https://…/logo.png',   // une URL publique : les boîtes mail ne lisent pas les fichiers locaux
        logoWidth: 72,
        colors: { primary: '#85553A', onPrimary: '#FFFFFF', background: '#F2F2F2' },
        radius: 8,
        footer: { en: 'Retal Urban Development Company', ar: 'شركة رتال للتطوير العمراني' },
        links: [{ label: 'retal.com.sa', url: 'https://retal.com.sa' }],
    },

    emails: [
        {
            key: 'login_code',
            name: 'Sign-in code',                       // ce que le back-office affiche
            description: 'Sent when a resident signs in with their email.',
            category: 'Account',                        // les emails sont rangés par catégorie
            variables: {
                code: { label: 'Code', example: '4821' },     // l'exemple sert à l'aperçu et aux tests
                minutes: { label: 'Minutes before it expires', example: 5 },
            },
            subject: { en: 'Your sign-in code', ar: 'رمز الدخول' },
            preheader: { en: 'It expires in {{minutes}} minutes.', ar: '…' },
            blocks: [
                { type: 'heading', text: { en: 'Your sign-in code', ar: '…' } },
                { type: 'text', text: { en: 'It expires in **{{minutes}} minutes**.', ar: '…' } },
                { type: 'code', value: '{{code}}' },
                { type: 'note', tone: 'warning', text: { en: 'Never share this code.', ar: '…' } },
            ],
        },
    ],
}
```

Une clé ne prend que des lettres, des chiffres, `_`, `.` et `-`. Deux emails ne peuvent pas avoir la même clé : le leaf refuse de démarrer.

---

## 2. Envoyer un email

```ts
const mail = (etherial as any).eth_mail_leaf

await mail.send('login_code', {
    to: email,
    locale: req.headers['x-app-locale'],   // facultatif
    user,                                   // facultatif : sa langue, et le journal de Pulse
    data: { code, minutes: 5 },
})
```

La langue est choisie dans cet ordre : `locale` si elle fait partie de `locales` (`ar-SA` compte comme `ar`), puis celle de `user` par la fonction `locale` de la config, puis `defaultLocale`.

`send` répond `{ key, sent, messageId, error, subject, html, text, locale, dir, missing }`. Un refus du provider **ne lève pas d'erreur** : `sent` vaut `false` et `error` dit pourquoi. `send` ne rejette que pour une clé inconnue, ou si ETHPulseLeaf manque. `missing` liste les variables utilisées par l'email mais laissées vides par `data` : elles sortent vides, sans bloquer l'envoi.

Autres options de `send` : `cc`, `bcc`, `replyTo`, `attachments`, `userId` (sinon `user.id`), qui range le message dans le journal de Pulse.

Dans la config : `from` est l'expéditeur (sinon celui du provider), `replyTo` l'adresse de réponse par défaut, et `provider` un provider email de Pulse autre que celui par défaut. `rtlLocales` liste les langues écrites de droite à gauche (par défaut `ar`, `fa`, `he`, `ur`). Le `theme` prend aussi `logoAlign`, `font`, `fontRtl`, et les couleurs `text`, `muted`, `card`, `border`, `subtle`.

Pour obtenir l'email sans l'envoyer (un aperçu, une pièce jointe) : `await mail.render('login_code', { data, locale, user })`.

---

## 3. Les blocs

Dans les textes : `{{variable}}`, `{{user.first_name}}` (chemin avec des points), `**gras**`, `[libellé](https://…)`, et une ligne vide pour un nouveau paragraphe. Les valeurs de `data` sont échappées : du HTML dans un prénom sort tel quel, en texte.

Une variable peut avoir une **valeur par défaut**, après `|` : `Hello {{first_name|there}},` donne « Hello there, » quand le prénom est vide. Sans elle, une variable vide sort vide (et `missing` la liste).

| Bloc | Champs | Pour |
|------|--------|------|
| `heading` | `text`, `align` | Le titre en haut |
| `text` | `text`, `align`, `muted` | Un ou plusieurs paragraphes (`muted` : gris, plus petit) |
| `button` | `label`, `url`, `align`, `style` (`primary` \| `outline`) | Un lien sur lequel on appuie |
| `code` | `value`, `label` | Un code à taper : grand, espacé, toujours de gauche à droite |
| `note` | `text`, `tone` (`info` \| `warning`) | Une phrase encadrée à ne pas manquer |
| `details` | `rows: [{ label, value }]` | Des lignes libellé / valeur : la date, le lieu, la référence |
| `image` | `src`, `alt`, `width`, `url`, `align` | Une image depuis une URL |
| `divider` | | Un trait fin |
| `spacer` | `size` (`sm` \| `md` \| `lg`) | De l'espace |

`align` vaut `start` (à gauche en anglais, à droite en arabe), `center` ou `end`. Les liens n'acceptent que `https://`, `http://`, `mailto:`, `tel:` ou une `{{variable}}`.

Le logo, le nom de la marque et le pied de page viennent du `theme` et entourent les blocs. Ils se modifient dans la page **Email design** du back-office (voir plus bas), pas dans un email.

---

## 4. Le back-office

La page **Emails** apparaît dans le menu quand le projet a au moins un email. Elle liste les emails par catégorie, avec les langues réécrites. Une pastille orange signale une réécriture dont la version du code a changé depuis : la réécriture part toujours, à vérifier.

Pour un email et une langue :

- l'objet, la ligne d'aperçu (le texte gris après l'objet dans la boîte de réception) et les blocs, à ajouter, déplacer, dupliquer ou supprimer ;
- les variables : un clic insère `{{variable}}` là où l'on tape, et on peut changer leur valeur d'exemple pour l'aperçu ;
- l'aperçu en direct : ordinateur, téléphone, ou version texte ;
- **Save** : cette version part désormais dans cette langue ;
- **Reset to code** : on efface la réécriture, et c'est la version du code qui repart ;
- **Send a test** : la version de la page, même non enregistrée, avec les valeurs d'exemple et `[Test]` devant l'objet. Sans adresse saisie, le test part à l'adresse du compte connecté ;
- **History** : les 100 dernières versions de cette langue (qui, quand, enregistrée ou réinitialisée). On en ouvre une, elle se charge dans l'éditeur, et on l'enregistre : c'est une nouvelle version, qui note de laquelle elle vient. Rien n'est jamais écrasé.

Un email marqué `editable: false` dans le code se lit dans le back-office mais ne s'y modifie pas.

### La charte (Email design)

Logo (URL, largeur, alignement), nom de la marque et pied de page dans chaque langue, couleurs, polices, arrondi des coins, liens du pied de page. L'aperçu se met à jour en direct sur un vrai email. **Save** : tous les emails partent avec cette charte (en 30 secondes au plus, le temps du cache), campagnes et page de désabonnement comprises. **Reset** : retour au `theme` du code.

Une couleur ajoutée plus tard dans le code n'est pas perdue : la charte du back-office se pose par-dessus celle du code.

### Les droits

Les rôles du back-office donnent l'accès par deux collections cachées (groupe System) :

| Collection | `list` | `create` | `update` | `delete` |
|------------|--------|----------|----------|----------|
| `mail-templates` | Ouvrir Emails et Email design, voir les aperçus et l'historique | | Enregistrer, réinitialiser, tester un email ; enregistrer ou réinitialiser la charte | |
| `mail-campaigns` | Ouvrir Email campaigns, voir les audiences et les résultats | Créer, dupliquer | Modifier, tester, programmer, déprogrammer, annuler | Supprimer |

Les routes génériques de ces collections ne font que lire : créer, modifier ou supprimer une ligne par elles est refusé. Tout passe par les pages dédiées, qui vérifient chaque bloc.

### Les routes

| Route | Droit |
|-------|-------|
| `GET /admin/emails` | `mail-templates` lecture |
| `GET /admin/emails/:key?locale=` | lecture |
| `POST /admin/emails/:key/preview` | lecture |
| `PUT /admin/emails/:key` (`restoredFrom` : la version reprise) | modification |
| `DELETE /admin/emails/:key?locale=` | modification |
| `POST /admin/emails/:key/test` | modification |
| `GET /admin/emails/:key/versions?locale=` | lecture |
| `GET /admin/emails/:key/versions/:id` | lecture |
| `GET /admin/email-theme` | lecture |
| `POST /admin/email-theme/preview` | lecture |
| `PUT /admin/email-theme` | modification |
| `DELETE /admin/email-theme` | modification |

---

## 5. Les campagnes

### Brancher

```ts
export const emailsConfig: ETHMailLeafConfig = {
    // ...
    campaigns: {
        // Les audiences proposées. Relues à chaque ouverture d'une campagne.
        audiences: async () => [
            { key: 'all', label: 'All residents', description: 'Every resident with an email address' },
            ...(await Segment.findAll()).map((s) => ({ key: `segment:${s.id}`, label: s.name, group: 'Segments' })),
        ],
        // Les personnes d'une audience, au départ de la campagne (et pour les compter).
        recipients: async (audience) => {
            const users = await usersOf(audience) // à vous : lever une erreur si l'audience n'existe plus
            return users.map((u) => ({ email: u.email, userId: u.id, user: u, data: { first_name: u.first_name } }))
        },
        // Ce que `data` contient, pour l'éditeur et l'aperçu.
        variables: { first_name: { label: 'First name', example: 'Sara' } },
        publicUrl: process.env.ETH_MAIL_LEAF_PUBLIC_URL,   // https://api.exemple.com
        perMinute: 30,                                      // Office 365 : 30 par minute
    },
}
```

- `recipients` : une adresse en double ou invalide est écartée, la langue de chacun vient de `locale`, puis de `user` par la fonction `locale` de la config.
- `publicUrl` : l'adresse publique de l'API, pour les liens de désabonnement. Sans elle, c'est l'adresse par laquelle le back-office joint l'API au moment de programmer. En production, **mettez-la**.
- `perMinute` : le nombre d'emails par minute, toutes campagnes confondues (60 par défaut). Office 365 en accepte 30 depuis une boîte.
- `unsubscribeText` : la ligne en bas de chaque email de campagne, par langue, avec `{{unsubscribe_url}}`. Par défaut : « You receive this email because you have an account with us. Unsubscribe ».

### Dans le back-office

La page **Email campaigns** liste les campagnes par statut. Pour en écrire une :

1. un nom (interne), une **audience** (avec le nombre de personnes joignables, par langue, et les désabonnés) ;
2. l'objet, la ligne d'aperçu et les blocs **dans chaque langue**, avec le même éditeur et le même aperçu que les emails. La langue par défaut est obligatoire. Une personne dont la langue n'est pas écrite reçoit la langue par défaut ;
3. **Send a test** à une adresse ;
4. **Schedule** : maintenant ou à une date (dans l'année). Une campagne programmée ne se modifie plus : on la déprogramme, elle redevient un brouillon.

Pendant et après l'envoi : les compteurs (envoyés, en échec, sautés, désabonnés), et chaque destinataire avec son statut, filtrable et cherchable. **Cancel** arrête une campagne en cours : ceux qui n'ont pas encore reçu l'email ne le reçoivent pas. **Duplicate** en refait un brouillon, pour la renvoyer ou s'en servir de modèle.

### Comment elle part

| Statut | |
|--------|---|
| `draft` | Brouillon, modifiable |
| `scheduled` | Programmée : ne bouge plus jusqu'à l'heure |
| `preparing` | L'heure est venue : le leaf appelle `recipients` et note chaque destinataire |
| `sending` | Les emails partent, par lots, au rythme de `perMinute` |
| `sent` | Tout est parti (ou a échoué, ou a été sauté) |
| `cancelled` | Annulée |
| `failed` | `recipients` a levé une erreur : le message est affiché |

Un passage toutes les 20 secondes fait avancer les campagnes. Il est sûr à plusieurs serveurs : chaque destinataire est réservé avant d'être envoyé. Si le serveur s'arrête pendant un envoi, les emails en cours sont marqués en échec (« Interrupted ») et **jamais renvoyés** : mieux vaut un email manqué qu'un doublon. La préparation, elle, reprend où elle en était.

Chaque email de campagne part avec son lien de désabonnement et les en-têtes `List-Unsubscribe` / `List-Unsubscribe-Post`, que Gmail et Outlook affichent comme un bouton « Se désabonner ».

### Le désabonnement

Le lien est signé pour l'adresse : on ne peut pas désabonner quelqu'un d'autre. Il ouvre une page aux couleurs de la charte, dans la langue de l'email, qui **demande confirmation** (les antivirus des boîtes mail ouvrent les liens tout seuls). Le bouton des boîtes mail, lui, désabonne directement (RFC 8058).

Une adresse désabonnée ne reçoit plus **aucune campagne** : elle est notée « sautée » dans les suivantes. Les emails envoyés par `send()` (un code de connexion, un message du service client) **l'ignorent** : la personne en a besoin. `await mail.isUnsubscribed(email)` dit si une adresse s'est désabonnée.

| Route | |
|-------|---|
| `GET /mail/unsubscribe?e=&t=&c=&l=` | La page de confirmation (publique) |
| `POST /mail/unsubscribe?e=&t=&c=&l=` | Désabonne (le bouton de la page, ou celui de la boîte mail) |
| `GET /admin/mail-audiences` | Les audiences |
| `GET /admin/mail-audiences/count?audience=` | Combien de personnes joignables |
| `GET` / `POST /admin/mail-campaigns` | La liste (`?status=&page=&limit=`) / créer |
| `POST /admin/mail-campaigns/preview` | L'aperçu d'une langue du brouillon (`locale`, `subject`, `preheader`, `blocks`, `data`) |
| `GET` / `PUT` / `DELETE /admin/mail-campaigns/:id` | Lire / modifier un brouillon / supprimer |
| `GET /admin/mail-campaigns/:id/recipients` | Les destinataires (`?status=&search=&page=&limit=`) |
| `POST /admin/mail-campaigns/:id/test` | Envoyer une langue du brouillon à l'écran (`to`, `locale`, `subject`, `preheader`, `blocks`) |
| `POST /admin/mail-campaigns/:id/schedule` | Programmer (`scheduledAt`) |
| `POST /admin/mail-campaigns/:id/unschedule` | Repasser en brouillon |
| `POST /admin/mail-campaigns/:id/cancel` | Arrêter |
| `POST /admin/mail-campaigns/:id/duplicate` | Copier en brouillon |

---

## 6. Commandes

```bash
npx etherial cmd eth_mail_leaf:list                                # les emails, et les langues réécrites
npx etherial cmd eth_mail_leaf:test login_code moi@exemple.com ar  # un vrai envoi, avec les valeurs d'exemple
```
