# ETHContentLeaf

Ce que toutes les apps montrent et que l'équipe tient à jour elle-même, dans le back-office, dans chaque langue du projet :

| Contenu | Ce que c'est | Route de l'app |
|---|---|---|
| `languages` | Les langues des contenus, celle par défaut, et celles que l'app reçoit : l'équipe en ajoute une sans toucher au code | `GET /content/languages` |
| `faq` | Les sections de l'aide (Général, Paiements…) et leurs questions | `GET /content/faq` |
| `contacts` | Téléphone, WhatsApp, email, site, réseaux sociaux, et les bureaux (adresse, horaires, carte) | `GET /content/contacts` |
| `legal` | Conditions d'utilisation, politique de confidentialité… : le texte, ou une page du site | `GET /content/legal`, `GET /content/legal/:slug` |
| `banners` | Le carrousel de l'accueil : une image et ce qu'ouvre un appui | `GET /content/banners` |
| `stories` | Des bulles sur l'accueil et leurs slides plein écran | `GET /content/stories` |
| `versions` | Les versions de l'app sur les stores, et ce qu'une app plus ancienne affiche : rien, un bandeau « mettez à jour », ou un blocage | `GET /content/app-version` |

Les mêmes contenus pour tout le monde, invités compris : aucune route ne demande de connexion. Seules les bannières et les stories regardent qui demande (leur **public** : tout le monde, connectés, invités) et la date (**From** / **Until**). Un brouillon n'est jamais envoyé.

Le leaf crée ses tables (`content_languages`, `content_faq_sections`, `content_faq_questions`, `content_contacts`, `content_offices`, `content_legal_documents`, `content_banners`, `content_stories`, `content_story_slides`, `content_app_releases`) par le `sync` du projet, sans migration à écrire. Seules celles des contenus choisis existent.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHContentLeaf from 'etherial/leafs/ETHContentLeaf/app'

export default {
    eth_content_leaf: {
        module: ETHContentLeaf,
        config: {
            locales: ['en', 'ar'],          // les langues d'un nouveau serveur, la langue par défaut en premier (§ 1, Les langues)
            features: ['languages', 'faq', 'contacts', 'legal', 'banners', 'stories', 'versions'], // défaut : tous
            folder: 'content',              // le dossier du media leaf des images
            stores: {                       // où mène le bouton « Mettre à jour »
                ios: 'https://apps.apple.com/app/id0000000000',
                android: 'https://play.google.com/store/apps/details?id=com.example.app',
            },
            seed: { faq: STARTER_FAQ },     // ce qu'un nouveau serveur a au départ (§ 4)
            admin: { group: 'Content' },
        },
    },
    // ...
}
```

Le leaf déclare ses collections au back-office dans `beforeRun` : sa place dans la config n'a pas d'importance.

**`features`** : un projet qui a déjà son propre contenu, appelé par l'app à la même adresse, le laisse de côté. Exemple : RETAL sert déjà `/content/banners`, il prend `['faq', 'contacts', 'legal']` tant que son app n'est pas passée aux bannières du leaf. Un contenu absent n'a ni table, ni collection, ni route.

### Le dossier du media leaf

Les images des bannières et des stories sont lues sans connexion : leur dossier doit être **public-read**.

```ts
eth_media_leaf: {
    config: {
        rules: [
            { folders: ['content'], visibility: 'public-read', max_size: 10 * 1024 * 1024, mime_types: ['image/jpeg', 'image/png', 'image/webp'] },
            // ...
        ],
    },
},
```

Sans cette règle, le leaf le dit au démarrage. Le leaf relie ses colonnes d'image au modèle de médias du projet (`mediaModel`, défaut `Media`) au démarrage, et dit au nettoyage des médias orphelins (`cleanup:orphans`) quelles images il utilise.

### Le back-office

Les collections, à mettre dans `navigation` et dans les droits des rôles (`COLLECTIONS`) :

| Collection | Menu |
|---|---|
| `content-faq` | FAQ : une section par fiche, ses questions dedans |
| `content-contacts` | Contacts |
| `content-offices` | Offices |
| `content-legal` | Legal documents |
| `content-banners` | Banners |
| `content-stories` | Stories : une story par fiche, ses slides dedans |
| `content-app-versions` | App versions |
| `content-languages` | Languages |
| `content-faq-questions`, `content-story-slides` | Aucun (`outOfMenu`) : elles s'écrivent dans la fiche de leur parent |

```ts
navigation: {
    groups: [
        { label: 'Content', items: ['content-faq', 'content-contacts', 'content-offices', 'content-legal', 'content-banners', 'content-stories', 'content-app-versions', 'content-languages'] },
    ],
    outOfMenu: ['content-faq-questions', 'content-story-slides'],
},
```

Chaque texte a un champ par langue, avec le sélecteur de langue du back-office en haut du formulaire (il vaut aussi pour les questions et les slides). Le texte de la langue par défaut est obligatoire là où il faut un titre : sans lui, le back-office refuse d'enregistrer et dit pourquoi. Les listes montrent, cherchent et trient ce texte-là (colonne `label`, écrite par le leaf).

L'ordre se règle en glissant les lignes, depuis la page **Order** de chaque liste, et les questions et les slides dans la fiche de leur parent.

### Les langues

**Content › Languages** dit dans quelles langues les contenus s'écrivent. Une ligne par langue :

| Champ | |
|---|---|
| **Language** (`code`) | Choisie dans une liste (`LANGUAGES` : 30 langues, `fr`, `es`, `hi`, `zh`…). C'est la clé de ses textes dans chaque contenu : elle ne change plus. |
| **Name** | Ce que montre le sélecteur de langue de l'app. Vide : son propre nom (Français, العربية). |
| **In the app** (`published`) | Éteint : la langue n'est que dans le back-office, le temps de la traduire. L'app ne la reçoit pas, et une app qui la demande reçoit la langue par défaut. |
| **Default language** | Ce que reçoit un texte absent dans une autre langue, et le texte obligatoire de chaque contenu. Une seule ; elle est toujours dans l'app. |
| **Right to left** | Vide : comme `rtlLocales` le dit (arabe, hébreu, persan, ourdou). |

Une langue ajoutée a son champ dans chaque formulaire de contenu sans redémarrer le serveur ; le back-office la montre après un rechargement de la page. Les autres serveurs du projet relisent les langues chaque minute.

Au premier démarrage, la table est remplie avec `locales` : la première est la langue par défaut, toutes sont dans l'app. Ensuite, c'est le back-office qui décide et `locales` ne sert plus. Sans le contenu `languages`, ce sont `locales`, `defaultLocale` et `rtlLocales` qui décident, pour de bon.

Ce sont les langues **des contenus du leaf**. Les textes de l'app elle-même, les notifications et les emails du projet ont les leurs.

### Qui est connecté

Pour le public des bannières et des stories. Par défaut, un jeton Bearer que l'auth d'etherial accepte (signature, expiration, utilisateur). Un projet dont les sessions se révoquent donne sa propre vérification :

```ts
signedIn: async (req) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    const payload = token ? etherial.http_auth.verifyToken(token) : null
    return !!payload && !!(await userFromTokenPayload(payload))
},
```

---

## 2. Les routes

Toutes répondent `{ status: 200, data }`, dans la langue demandée : `?locale=ar`, sinon l'en-tête `x-app-locale`, sinon `Accept-Language`, parmi les langues de l'app (**In the app**), sinon la langue par défaut. Un texte absent dans cette langue arrive dans la langue par défaut. `data.locale` dit la langue servie.

### `GET /content/languages`

Les langues que l'app reçoit, la langue par défaut en premier : pour son sélecteur de langue.

```json
{
    "locale": "en", "default": "en",
    "languages": [
        { "code": "en", "name": "English", "rtl": false, "default": true },
        { "code": "ar", "name": "العربية", "rtl": true, "default": false }
    ]
}
```

### `GET /content/faq`

Les sections publiées qui ont au moins une question publiée, dans l'ordre.

```json
{
    "locale": "en",
    "sections": [
        { "id": 1, "title": "Payments", "questions": [{ "id": 3, "question": "Can I pay in instalments?", "answer": "Yes…\n\nAsk your…" }] }
    ]
}
```

`answer` est du texte simple : une ligne vide entre deux paragraphes.

### `GET /content/contacts`

```json
{
    "locale": "en",
    "channels": [{ "id": 1, "kind": "whatsapp", "label": "Customer care", "value": "+971 50 000 0000", "href": "https://wa.me/971500000000", "hours": "Sun–Thu, 9:00–17:00" }],
    "offices": [{ "id": 1, "name": "Head office", "address": "…", "hours": "…", "phone": "+971 4 …", "phone_href": "tel:+9714…", "email": "…", "latitude": 25.2, "longitude": 55.3, "map_url": "https://www.google.com/maps/search/?api=1&query=25.2,55.3" }]
}
```

`kind` : `phone`, `whatsapp`, `email`, `website`, `instagram`, `facebook`, `x`, `linkedin`, `youtube`, `tiktok`, `snapchat`. L'app choisit son icône d'après lui. `href` est ce qu'ouvre un appui : `tel:`, `https://wa.me/…`, `mailto:`, ou l'adresse elle-même. `label` est `null` quand l'équipe ne l'a pas nommé : l'app le nomme d'après `kind`. `map_url` est fait à partir du point quand l'équipe n'a pas donné de lien.

### `GET /content/legal` et `GET /content/legal/:slug`

La liste, sans les textes :

```json
{ "locale": "en", "documents": [{ "id": 1, "slug": "privacy", "title": "Privacy policy", "version": "2026-10", "url": null, "has_body": true, "published_at": "…", "updated_at": "…" }] }
```

Un document, avec son texte (`body`, du HTML) : `GET /content/legal/privacy`. Quand `url` est donnée, l'app ouvre cette page du site plutôt que le texte. Un document inconnu ou en brouillon : 404 `legal_document_not_found`.

### `GET /content/banners`

Les bannières publiées, du public de celui qui demande, entre leurs dates, dans l'ordre.

```json
{ "locale": "en", "banners": [{ "id": 1, "image": { "id": 12, "url": "https://…", "width": 1600, "height": 900 }, "title": "…", "subtitle": null, "button": "Discover", "link": "https://…", "ends_at": null }] }
```

`link` est une adresse web ou un lien propre à l'app (ses routes) : c'est l'app qui l'ouvre. Sans `button`, toute la bannière ouvre le lien. Une bannière dont l'image a disparu n'est pas envoyée.

### `GET /content/stories`

```json
{
    "locale": "en",
    "stories": [{
        "id": 1, "title": "New launch", "cover": { "id": 20, "url": "…" }, "published_at": "…", "updated_at": "…",
        "slides": [{ "id": 4, "image": { "id": 21, "url": "…" }, "title": "…", "text": "…", "button": "Learn more", "link": "https://…", "duration": 5 }]
    }]
}
```

`cover` est l'image de la bulle, sinon celle de la première slide. `duration` en secondes (2 à 30). `button` n'est donné qu'avec un `link`. L'app marque une story comme nouvelle tant qu'elle n'a pas vu son `updated_at`. Une story sans slide à montrer n'est pas envoyée.

### `GET /content/app-version?platform=ios&version=1.4.2`

À appeler au lancement de l'app et quand elle revient au premier plan. La plateforme et la version peuvent aussi passer par les en-têtes `x-app-platform` et `x-app-version`.

```json
{
    "locale": "en", "platform": "ios", "version": "1.4.2",
    "latest": "2.0.0", "minimum": "1.2.0",
    "update": "banner",
    "store_url": "https://apps.apple.com/app/id…",
    "title": "A new version is available", "message": "Update the app to get the latest features."
}
```

| `update` | L'app… |
|---|---|
| `none` | ne montre rien : c'est la dernière version, ou aucune n'est listée |
| `available` | ne montre rien : une version mineure plus récente existe (1.5 après 1.4) |
| `banner` | montre un bandeau qu'on peut fermer, avec un bouton vers `store_url` |
| `required` | ne montre plus que l'écran de mise à jour, jusqu'à la mise à jour |

Chaque version publiée plus récente que celle de l'app compte, et la plus forte gagne :
- une version **Blocked until updated** bloque toutes les apps plus anciennes ;
- une version **A banner, always** affiche le bandeau ;
- une version **A banner if it is a new major version** (le défaut) ne l'affiche que si son premier chiffre est plus grand que celui de l'app : 2.0.0 pour une app en 1.x, rien pour une app en 2.0.0 face à 2.1.0.

`title` et `message` sont ceux que l'équipe a écrits, dans la langue de l'app, pour la plus récente des versions qui demandent la même chose. Sinon ceux du leaf dans cette langue (anglais, arabe, français), sinon ceux de l'équipe dans une autre langue. Ils sont `null` pour `none` et `available`. Sans `version`, ou avec une version qui n'en est pas une, `update` est `null` : seuls `latest` et `minimum` sont donnés. Une plateforme inconnue : 400 `invalid_platform`.

L'app garde, en mémoire, la version dont elle a fermé le bandeau (`latest`), pour ne pas le remontrer avant la suivante.

---

## 3. Les règles d'écriture

- Une **page légale** a une adresse (`slug`, ce que l'app demande : `terms`, `privacy`), faite à partir du titre si on la laisse vide. On ne la publie qu'avec un texte ou une page du site. La changer casse le lien de l'app.
- Une **bannière** ou une **story** finit après avoir commencé. Sans dates, elle s'affiche tant qu'elle est publiée.
- Une **story** a au moins une slide.
- Une **version** s'écrit comme sur le store (`2.0.0`), une fois par store. On ne la publie qu'une fois sortie sur le store : avant, le bouton mènerait à la version d'avant.
- `published_at` (pages légales, stories, versions) est la date de la première publication. Le leaf l'écrit.
- Une **langue** ne devient la langue par défaut que si chaque contenu a déjà son texte dans cette langue. Sinon le back-office refuse, avec ce qui manque : « French can't be the default language yet: 5 FAQ sections, 10 questions and 10 answers have no French text. » Quand elle le devient, l'ancienne cesse de l'être, et les listes du back-office montrent les titres dans la nouvelle.
- La langue par défaut ne s'enlève pas et ne sort pas de l'app : une autre doit d'abord prendre sa place. Deux lignes n'ont pas la même langue.
- Une langue enlevée laisse ses textes dans les contenus. Remise, elle les retrouve.

---

## 4. Les contenus de départ (`seed`)

Ce qu'un nouveau serveur a au premier démarrage. Chaque table n'est remplie qu'**une fois** : tant qu'elle n'a jamais eu de ligne (sa séquence d'id n'a jamais servi). Une table que l'équipe a vidée reste vide, et deux serveurs qui démarrent ensemble ne l'écrivent qu'une fois. Les contenus ne sont donc jamais écrasés : la graine ne sert qu'à démarrer.

Un texte est `'…'` (la langue par défaut) ou `{ en: '…', ar: '…' }`.

```ts
seed: {
    faq: [{ title: { en: 'Payments', ar: 'الدفعات' }, questions: [{ question: { en: '…', ar: '…' }, answer: { en: '…', ar: '…' } }] }],
    contacts: [{ kind: 'phone', value: '+971 4 000 0000', label: { en: 'Customer care', ar: 'خدمة العملاء' } }],
    offices: [{ name: { en: 'Head office' }, address: { en: '…' }, latitude: 25.2, longitude: 55.3 }],
    legal: [{ slug: 'privacy', title: { en: 'Privacy policy', ar: 'سياسة الخصوصية' }, url: { en: 'https://…/privacy' } }],
},
```

Une page légale de la graine est publiée quand elle a un texte ou une adresse. Les bannières et les stories n'ont pas de graine : il leur faut des images. Les versions non plus : elles ne s'écrivent que dans le back-office, à chaque sortie sur un store.

---

## 5. Depuis le projet

```ts
import { FaqSection, COLLECTIONS, hrefOf, localeOf, languages, appUpdateOf } from 'etherial/leafs/ETHContentLeaf/app'
```

Les modèles s'importent pour lire les contenus ailleurs (un écran d'accueil qui rassemble tout, une notification), `COLLECTIONS` pour le menu et les droits.

`languages()` donne les langues du moment : `all` (celles du back-office), `app`, `default`, `rtl`, `names`.

`appUpdateOf(platform, version, locale)` donne la réponse de `GET /content/app-version`, pour une route du projet qui la rend déjà (un `/config` lu au lancement, par exemple).
