# ETHPageLeaf

Des pages d'information écrites dans le back-office, bloc par bloc : une grande image avec un titre dessus, du texte mis en forme, des cartes, une FAQ, un événement à ajouter à son agenda… Pas de formulaire, pas de saisie : une page à lire.

Une page s'écrit dans le back-office (menu **Content › Pages**, bouton **New page**) :

- **un titre** et une ligne de résumé, dans chaque langue du projet ;
- **des blocs** (la liste au [§ 2](#les-blocs)), chacun avec ses réglages et une **boîte** autour : fond, couleur du texte, marges, coins arrondis, bord à bord, sa police ;
- **son adresse** (`opening-hours`), faite à partir du titre si on la laisse vide ;
- **Published** pour la mettre en ligne, **In the menu** pour la lister dans le menu de l'app.

Un aperçu téléphone à côté des blocs montre la page telle qu'elle sera publiée, dans la langue choisie en haut du formulaire. Une page peut partir d'un **modèle**, des blocs enregistrés depuis l'éditeur ([§ 4](#4-les-modèles)).

Les polices des titres et du texte se choisissent une fois pour toutes les pages ([§ 5](#5-les-réglages-de-toutes-les-pages)) ; un bloc peut avoir la sienne.

Une page arrive dans l'app de deux façons, qui montrent la même chose :

1. **Les blocs** : `GET /pages` donne toutes les pages publiées avec leurs blocs, l'app les garde et dessine la page elle-même. Une page déjà reçue s'ouvre donc sans chargement.
2. **Le HTML** : à l'enregistrement d'une page publiée, le leaf écrit une page web par langue dans le bucket du media leaf, `pages/<adresse>/<langue>.html`. C'est le lien à partager, et ce que l'app peut montrer dans une web view. **L'API ne sert jamais ce HTML** : le lien pointe vers le bucket (ou le CDN).

Le HTML est écrit *avant* l'enregistrement : si le bucket refuse, la page n'est pas enregistrée et le back-office affiche l'erreur. Le web ne montre donc jamais une autre version que celle du back-office. Dépublier, supprimer ou changer l'adresse d'une page retire ses anciens fichiers.

Le leaf crée les tables `content_pages` et `content_page_templates` par le `sync` du projet, sans migration à écrire.

Dans le back-office, la collection s'appelle `content-pages` (pas `pages` : le back-office ouvre ses propres pages à `/pages/<page>`). C'est ce nom qui va dans `navigation` et dans les droits des rôles.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHPageLeaf from 'etherial/leafs/ETHPageLeaf/app'

export default {
    eth_page_leaf: {
        module: ETHPageLeaf,
        config: {
            locales: ['en', 'ar'],       // les langues des pages, la langue par défaut en premier
            timezone: 'Asia/Dubai',      // l'heure des événements : leur lien « Add to calendar » le dit
            publicUrl: process.env.ETH_PAGE_LEAF_PUBLIC_URL,   // https://api.exemple.com : le lien « Add to calendar » passe par l'API
            folder: 'pages',             // le dossier du media leaf (images et HTML)
            theme: {
                brandName: { en: 'Jubail Island', ar: 'جزيرة الجبيل' },
                logoUrl: 'https://…/logo.png',
                colors: { primary: '#072B31', onPrimary: '#FFFFFF' },
                fonts: { title: 'noto-naskh-arabic', text: 'rubik' },   // celles de l'app, tant que le B.O n'en choisit pas
                radius: 12,
            },
            admin: { group: 'Content' },
        },
    },
    // ...
}
```

Le leaf déclare sa collection au back-office dans `beforeRun`. Sa place dans la config n'a pas d'importance.

`timezone` : l'heure d'un événement est écrite telle quelle (`19:00`), c'est celle du projet. Le lien « Add to calendar » la donne à Google Agenda (`ctz=Asia/Dubai`), qui la montre à chacun dans son propre fuseau. Sans `timezone`, Google prend celui du téléphone.

`publicUrl` : l'adresse de l'API telle que les téléphones la joignent. Le lien « Add to calendar » d'un événement passe alors par `GET /page-calendar/event.ics?title&date&until&start&end&place`, sans connexion, qui répond selon l'appareil qui l'ouvre :

- un iPhone (dans l'app, Safari s'ouvre) ou un ordinateur reçoit l'événement en fichier `.ics` (`text/calendar`) : l'iPhone montre la fiche « Ajouter au calendrier », un Mac l'ouvre dans Calendrier, un PC dans Outlook ;
- un téléphone Android, qui n'a pas cette fiche, va sur la page « nouvel événement » de Google Agenda ;
- `&as=google`, `&as=outlook` ou `&as=file` force l'un des trois. Sur ordinateur (une souris), la page web propose les trois au clic sur le bouton : beaucoup gardent leur agenda dans le navigateur.

Les heures du fichier sont en UTC, calculées depuis `timezone` (sans `timezone`, l'heure du téléphone). Sans `publicUrl`, le lien est celui de Google Agenda, comme avant.

Le thème donne aussi leurs couleurs aux blocs : `primary`, `text`, `muted` et `subtle` sont celles de `theme.colors` sur le web, et celles de la palette de l'app dans l'app.

`theme.fonts` : les polices des pages tant que le back-office n'en a pas choisi ([§ 2, Les polices](#les-polices)), des ids du catalogue (`FONTS`, exporté par le leaf). Mettre celles de l'app : le web lui ressemble. `title` : les titres ; sans, ceux-ci sont dans celle du texte. `text` : le reste ; sans, la police du système (`theme.font` / `fontRtl`).

### Le dossier du media leaf

Le dossier doit être **public-read** dans les règles du media leaf : les images des pages et leur HTML sont lus sans connexion.

```ts
eth_media_leaf: {
    config: {
        rules: [
            { folders: ['pages'], visibility: 'public-read', max_size: 10 * 1024 * 1024, mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
            // ...
        ],
    },
},
```

Au démarrage, le leaf prévient dans les logs si ce dossier n'est pas public-read.

Les images envoyées depuis un bloc gardent l'id de leur média : `cleanup:orphans` ne les supprime pas.

---

## 2. Ce que l'app reçoit

Sans connexion. La langue : `?locale=`, sinon l'en-tête `x-app-locale`, sinon `Accept-Language`, sinon la langue par défaut.

### GET /pages

Toutes les pages publiées, triées par `position` (l'ordre du menu, réglé par glisser-déposer sur la page **Order** de la liste) :

```json
[
    {
        "id": 3,
        "slug": "opening-hours",
        "locale": "en",
        "dir": "ltr",
        "title": "Opening hours",
        "summary": "When the beach, the club and the shops are open",
        "blocks": [
            {
                "type": "hero",
                "image": { "src": "https://…/pages/abc.jpg", "media": 42, "alt": "The beach" },
                "title": "Opening hours",
                "button": { "label": "Call us", "url": "tel:+97124480011" }
            },
            {
                "type": "text",
                "text": [{ "type": "paragraph", "spans": [{ "text": "The beach is open " }, { "text": "every day", "bold": true }, { "text": "." }] }]
            },
            {
                "type": "details",
                "rows": [{ "label": "Mon – Fri", "value": "8:00 – 20:00" }],
                "style": { "background": "subtle", "rounded": true }
            },
            {
                "type": "event",
                "title": "Winter market",
                "date": "2026-11-14",
                "startTime": "19:00",
                "endTime": "22:00",
                "resolved": {
                    "event": {
                        "day": "14",
                        "month": "Nov",
                        "date": "Saturday, 14 November 2026",
                        "time": "19:00 – 22:00",
                        "calendarUrl": "https://api.exemple.com/page-calendar/event.ics?title=Winter+market&date=2026-11-14&start=19%3A00&end=22%3A00",
                        "calendars": {
                            "google": "https://api.exemple.com/page-calendar/event.ics?…&as=google",
                            "outlook": "https://api.exemple.com/page-calendar/event.ics?…&as=outlook",
                            "file": "https://api.exemple.com/page-calendar/event.ics?…&as=file"
                        }
                    }
                }
            }
        ],
        "in_menu": true,
        "position": 1,
        "url": "https://…/pages/opening-hours/en.html",
        "fonts": {
            "title": "noto-naskh-arabic",
            "text": "rubik",
            "files": {
                "noto-naskh-arabic": { "family": "Noto Naskh Arabic", "files": { "400": "https://fonts.gstatic.com/…ttf", "700": "https://fonts.gstatic.com/…ttf" } },
                "rubik": { "family": "Rubik", "files": { "400": "…", "500": "…", "600": "…", "700": "…", "400i": "…" } }
            }
        },
        "updated_at": "2026-10-26T09:12:00.000Z"
    }
]
```

Le menu de l'app liste celles qui ont `in_menu`. Les autres s'ouvrent depuis un lien, une push ou une bannière.

Une langue sans blocs donne la page dans la langue par défaut (`locale` dit laquelle) : un titre en arabe au-dessus de blocs anglais ferait une demi-page.

### GET /pages/:slug

Une page publiée, dans le menu ou non. `404 page_not_found` sinon, ou si c'est un brouillon.

### Les polices

Choisies dans le back-office pour toutes les pages (le groupe **Fonts** de l'éditeur, sans bloc choisi), ou pour un bloc (`style.font`). Ce sont des Google Fonts du catalogue (`FONTS` : 22 polices, sans et serif, dont 9 avec l'arabe).

`fonts` dans une page :

- `title` : la police des titres (les titres, celui d'un `hero`, celui d'une image & texte) ; `null` : celle du texte.
- `text` : celle du reste ; `null` : celle de l'app.
- `files` : celles que la page utilise (les deux, et celle d'un bloc qui a la sienne) : un TTF par graisse (`400`, `500`, `600`, `700` ; `400i` l'italique). Toutes n'ont pas toutes les graisses : on prend la plus proche.

Sur le web, les titres sont en 700 (`h3` et le titre d'une image & texte en 600), le texte en 400, le gras en 700. L'app de Jubail fait pareil (`src/Components/Pages/pageFonts.ts`) : Rubik et Noto Naskh Arabic sont déjà dedans ; une autre police est téléchargée la première fois (le cache du téléphone la garde) et la page reste dans celles de l'app tant qu'elle se charge.

### Les blocs

Les types sont dans `services/options.ts` (`PageBlock`) : c'est le contrat entre l'API, le back-office et l'app.

| type | champs |
|---|---|
| `heading` | `text` (spans), `level?` (`1`, `2` par défaut, `3`), `align?` |
| `text` | `text` (texte riche), `align?`, `size?` (`sm`, `md`, `lg`) |
| `button` | `label`, `url`, `align?`, `variant?` (`primary`, `outline`, `soft`), `color?`, `full?` (toute la largeur) |
| `image` | `image`, `caption?`, `url?` (l'image est un lien), `width?` (px au plus), `align?`, `ratio?` |
| `hero` | `image`, `title?`, `subtitle?`, `button?`, `height?` (`sm`, `md`, `lg`), `overlay?` (0 à 90 %, 35 par défaut), `align?`, `position?` (`top`, `center`, `bottom`) |
| `gallery` | `images: [{ src, media?, alt?, caption? }]`, `layout?` (`carousel`, `grid`), `ratio?` |
| `video` | `url` (YouTube, Vimeo ou un fichier `.mp4`…), `poster?`, `caption?` |
| `cards` | `items: [{ image?, title, text?, url? }]`, `columns?` (`1`, `2`) |
| `media-text` | `image`, `title?`, `text` (texte riche), `button?`, `side?` (`start`, `end`) : l'image à côté du texte, au-dessus sur un téléphone |
| `faq` | `items: [{ question, answer }]`, la réponse en texte riche |
| `contact` | `items: [{ kind, value, label? }]`, `layout?` (`buttons`, `list`) ; `kind` : `phone`, `whatsapp`, `email`, `map`, `website` |
| `event` | `date` (`YYYY-MM-DD`), `title?`, `endDate?`, `startTime?` / `endTime?` (`HH:MM`), `place?`, `mapUrl?`, `calendar?` (`false` : pas de lien « Add to calendar ») |
| `quote` | `text`, `author?` |
| `stats` | `items: [{ value, label }]` : « 120 · Villas » |
| `note` | `text` (texte riche), `title?`, `tone?` (`info`, `success`, `warning`, `danger`) |
| `details` | `rows: [{ label, value }]` : les horaires, l'adresse, le téléphone |
| `divider` | — |
| `spacer` | `size?` (`none`, `sm`, `md`, `lg`, `xl`) |

- **Une image** (`image`, `poster`, celles d'une galerie ou d'une carte) : `{ src, media?, alt? }`. `src` en `https://` ; `media` est l'id du média quand l'image a été envoyée depuis le back-office : `cleanup:orphans` ne la supprime pas tant qu'une page ou un modèle s'en sert.
- **Le bouton d'un bloc** (`hero`, `media-text`) : `{ label, url }`.
- **`align`** vaut `start`, `center` ou `end` : `start` est à gauche en anglais et à droite en arabe. Pareil pour `side`.
- **`ratio`** : `auto` (celui de l'image), `16:9`, `4:3`, `1:1`, `3:4`.
- **Un lien** (bouton, carte, texte, image) commence par `https://`, `mailto:` ou `tel:`, ou vaut `page:<adresse>` pour ouvrir une autre page : l'app ouvre alors sa page, le HTML pointe vers le fichier voisin dans le bucket.

### Le texte riche

Un titre (`heading`) est une ligne de **spans** ; un texte (`text`, `note`, `media-text`, une réponse de FAQ) est une suite de paragraphes et de listes :

```json
[
    { "type": "paragraph", "spans": [{ "text": "Open " }, { "text": "every day", "bold": true, "color": "primary" }] },
    { "type": "list", "ordered": true, "items": [[{ "text": "Book in the app" }], [{ "text": "See the map", "link": "page:map" }]] }
]
```

Un span prend `bold`, `italic`, `underline`, `strike`, `color` et `link`. Un `\n` dans un span est un retour à la ligne.

À l'enregistrement, le texte est nettoyé : les spans vides disparaissent, deux spans voisins avec les mêmes marques n'en font qu'un, une couleur ou un lien qui ne veut rien dire est retiré (le texte reste, sans lien). Un lien faux sur un **bouton**, lui, refuse l'enregistrement.

### Les couleurs

Une couleur est `primary`, `text`, `muted`, `subtle`, `white`, `black`, ou `#RRGGBB`. Les quatre premières suivent le thème ([§ 1](#configts)). Le reste est retiré.

Sur un fond foncé, le texte passe en blanc tout seul ; les liens et le texte secondaire suivent la couleur du texte de la boîte.

### La boîte d'un bloc (`style`)

Tout bloc peut prendre `style` :

| champ | |
|---|---|
| `background` | le fond, une couleur |
| `color` | la couleur du texte ; sinon celle de la page, blanc sur un fond foncé |
| `padding` | l'espace à l'intérieur : `none` 0 · `sm` 12 · `md` 20 · `lg` 32 · `xl` 48 ; `md` par défaut avec un fond, `none` sans |
| `rounded` | les coins arrondis du thème |
| `bleed` | bord à bord, hors des marges de la page ; le contenu reste aligné sur la colonne |
| `above` / `below` | l'espace au-dessus / en dessous : `none` 0 · `sm` 8 · `md` 20 · `lg` 36 · `xl` 56. Au-dessus : `none` par défaut, `md` pour un titre qui n'est pas le premier bloc. En dessous : `md`, `none` pour un `spacer` (c'est déjà un espace) |
| `font` | la police de tous ses mots, titres et texte (un id de `FONTS`), à la place de celles de la page ; un id inconnu est retiré |

Les tailles sont en pixels sur le web, en points dans l'app.

### Ce que l'API calcule (`resolved`)

Certains blocs envoyés à l'app ont un champ `resolved`, calculé par l'API dans la langue de la page (`resolveBlocks`). Le HTML du bucket est fait avec les mêmes valeurs : l'app et le web disent les mêmes mots, et le téléphone ne calcule rien.

- **`event`** : `day` (« 14 »), `month` (« Nov » ; la mise en majuscules se fait au dessin), `date` (« Saturday, 14 November 2026 », ou « 2–4 December 2026 » avec `endDate`), `time` (« 19:00 – 22:00 », « 19:00 » ou `null`) et `calendarUrl`, le lien « Add to calendar » (celui de l'API avec `publicUrl`, sinon celui de Google Agenda ; `null` avec `calendar: false`), avec `calendars` (Google, Outlook, le fichier) pour qui veut choisir. Les chiffres sont latins dans toutes les langues. Un événement sans heure prend la journée entière ; 22:00 → 02:00 finit le lendemain ; sans heure de fin, il dure une heure. Il est noté dans l'agenda sous son `title`, sinon sous le titre de la page.
- **`video`** : `provider` (`youtube`, `vimeo`, `file`, `link`), `poster` (celui du bloc, sinon l'image de YouTube) et `embedUrl` (le lecteur YouTube sans cookies ou celui de Vimeo, sinon `null`).
- **`contact`** : pour chaque ligne, son `href` (`tel:+97124480011`, `https://wa.me/97124480011`, `mailto:…`, le lien de la carte ou du site) et son `label` : celui du bloc, sinon un mot dans la langue de la page (Call, WhatsApp, Email, Directions, Website ; اتصل, واتساب… ; Appeler, Itinéraire…).

### Ce qui est refusé

À l'enregistrement d'une page, un bloc pas fini est refusé, avec sa langue et son numéro dans le message (`English, block 3: the button has no words.`) : un titre, un texte, une note ou une citation vides, un bouton sans mots ou sans lien valable, un bloc `image`, `hero` ou `media-text` sans image, une galerie sans image, une vidéo sans adresse `https://`, une carte sans titre, une question sans réponse, un contact faux, un événement sans date (ou qui finit avant de commencer), des chiffres ou des lignes vides. Un réglage qui ne veut rien dire (une taille, un alignement, une couleur) est simplement retiré.

L'aperçu et les modèles lisent les blocs **en brouillon** : rien n'est refusé, un bloc pas fini reste tel quel (un bouton sans lien garde `url: ''`).

---

## 3. Une page comme contenu d'un autre enregistrement

Une news, une offre… peut avoir une page pour contenu sans qu'on la crée à part : un champ de type `page` sur sa collection, et ses blocs s'écrivent dans son formulaire, avec l'aperçu téléphone, comme on choisit l'image d'un champ média.

```ts
// le modèle : la colonne garde l'id de la page
@AllowNull(true)
@Column(DataType.INTEGER)
declare page_id: number | null

// la collection du back-office
{ name: 'page_id', type: 'page', label: 'Content', page: { title: 'title' } }
```

- `page.title` : la colonne de l'enregistrement qui donne son titre à la page (`title` par défaut). `page.summary` : celle de la ligne sous le titre, aucune par défaut.
- La page est créée avec son premier bloc, enregistrée avec l'enregistrement, copiée avec lui (**Duplicate** donne à la copie sa propre page) et supprimée avec lui, son HTML aussi. Pas sur une collection en soft delete : l'enregistrement peut revenir, sa page reste.
- Elle est publiée dès qu'elle a des blocs dans la langue par défaut, et son titre suit celui de l'enregistrement.
- Elle n'est ni dans **Pages** du back-office, ni dans `GET /pages`, ni dans le menu de l'app. `GET /pages/:slug` et son lien web l'ouvrent comme les autres : comme tout le HTML du bucket, elle est lisible par qui a le lien, même si l'enregistrement est réservé à certains utilisateurs.

L'API envoie la page avec l'enregistrement, dans la forme de `GET /pages` :

```ts
import { localeOf, publishedPages } from 'etherial/leafs/ETHPageLeaf/app'

const pages = await publishedPages(news.map((n) => n.page_id), localeOf(req))
return news.map((n) => ({ ...serialize(n), page: pages.get(n.page_id) ?? null }))
```

Un brouillon (pas de blocs dans la langue par défaut) donne `null`.

---

## 4. Les modèles

Un modèle, ce sont des blocs enregistrés depuis l'éditeur pour commencer une autre page avec : une page d'événement, une fiche de lieu… Ils se modifient et se renomment dans **Content › Page templates** (la clé `page-templates` dans `navigation`). Tout utilisateur du back-office peut les lire, les créer, les modifier et les supprimer : ce ne sont que des blocs, et une news s'écrit avec eux aussi.

| | |
|---|---|
| `GET /admin/content-pages/templates` | tous, le plus récent d'abord : `[{ id, name, blocks, created_at, updated_at }]` |
| `POST /admin/content-pages/templates` | `{ name, blocks }` → le modèle enregistré |
| `PUT /admin/content-pages/templates/:id` | `{ name?, blocks? }`, seul ce qui est donné change → le modèle enregistré |
| `DELETE /admin/content-pages/templates/:id` | → `{ id }` |

- `name` : obligatoire, 120 caractères au plus.
- `blocks` : une liste par langue (`{ "en": [...], "ar": [...] }`), lue en brouillon, avec au moins un bloc dans une langue.
- Un `id` inconnu : `404`.

Les images d'un modèle comptent comme celles d'une page pour `cleanup:orphans`.

## 5. Les réglages de toutes les pages

| | |
|---|---|
| `GET /admin/content-pages/settings` | `{ fonts: { title, text } }` : ce que le back-office a choisi, `null` pour celle du thème. Tout utilisateur du back-office |
| `PUT /admin/content-pages/settings` | `{ fonts: { title?, text? } }` : une police donnée remplace celle choisie, `null` revient à celle du thème, un id inconnu aussi. Ceux qui peuvent modifier les pages |

Gardés dans la table `content_page_settings` (une ligne) et en mémoire (relus après 30 s). Un changement réécrit le HTML de toutes les pages publiées dans le bucket, en tâche de fond ; l'app reçoit les nouvelles à sa prochaine lecture.

---

## 6. L'aperçu du back-office

`POST /admin/content-pages/preview` dessine la page du formulaire, comme le bucket l'aura, et renvoie `{ html }`. Tout utilisateur du back-office : il dessine ce qu'on lui envoie et ne lit rien.

```json
{ "locale": "ar", "title": { "en": "…", "ar": "…" }, "summary": { "en": "…" }, "blocks": { "en": [], "ar": [] }, "chrome": false, "fonts": { "title": "cairo", "text": null } }
```

- `blocks` : une liste par langue, ou directement la liste de la langue demandée.
- Les blocs sont lus **en brouillon** : une image pas encore envoyée est un cadre gris, un bouton sans lien est dessiné quand même, un bloc vide garde sa place, une vidéo montre son image et pas son lecteur (qui se rechargerait à chaque touche). Un type inconnu est sauté.
- Chaque bloc porte `data-block="<i>"`, `i` étant sa place dans la liste envoyée (un bloc sauté ne décale pas les suivants) : le back-office sait ainsi quel bloc est sous le doigt.
- `chrome: false` : sans le nom de la marque, le choix de la langue ni le pied de page, pour une page montrée dans l'écran d'un enregistrement (le contenu d'une news : l'app y a son propre en-tête).
- `fonts` : les polices de toutes les pages, comme le back-office les a (celles du thème pour `null`) ; sans, celles enregistrées.
- Pas de script dans le HTML : le back-office ajoute le sien.

Le back-office trouve ce qu'il lui faut dans la feature `pages` du schéma : `previewPath`, `templatesPath` (`/admin/content-pages/templates`), et `theme` : `{ colors: { primary, onPrimary, text, muted, background, border, subtle }, radius }`, les couleurs et l'arrondi du thème, avec les mêmes valeurs par défaut que le web, pour les pastilles de l'éditeur ; `fonts` : `{ catalog, defaults, settingsPath }`, les polices à choisir (sans leurs fichiers), celles du thème, et où lire et changer celles de toutes les pages.

---

## 7. Commandes

- `eth_page_leaf:publish` : réécrit le HTML de toutes les pages publiées, par exemple après un changement de thème dans la config.
