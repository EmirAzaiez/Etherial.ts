# ETHAssistantLeaf

Claude dans le back-office. Le staff pose une question sur ses données, en anglais ou en arabe :

- « Combien de réservations padel ce mois-ci ? »
- « Quels résidents n'ont pas encore l'app ? »
- « Les demandes de maintenance ouvertes depuis plus d'une semaine, par type ? »

Claude répond en lisant les données : il compte, regroupe, liste et ouvre des fiches. Chaque chiffre est suivi d'un lien vers la liste filtrée du back-office qui montre les mêmes lignes.

Sur une fiche, il fait aussi deux choses :

- **résumer** la fiche et ses dernières lignes liées (messages, historique…), en 3 à 6 points ;
- **rédiger une réponse** au résident, en anglais ou en arabe, à relire avant de l'envoyer.

Le leaf **ne modifie rien lui-même**. Il ne lit que ce que la personne connectée peut ouvrir dans le back-office, et jamais les champs sensibles. Avec `proposals: true`, il peut **préparer** une modification que la personne vérifie et confirme dans le back-office (section 5). Avec `history: true`, chacun retrouve ses conversations (section 6).

Sans clé Anthropic, ou si l'IA n'est pas activée dans la config admin du projet (`features.ai`), le leaf ne fait rien : le back-office n'affiche pas l'assistant. Monter le hash du framework sur un projet ne change donc rien tant que ce projet n'a pas activé l'IA.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHAssistantLeaf, { ETHAssistantLeafConfig } from 'etherial/leafs/ETHAssistantLeaf/app'

export default {
    // ...
    eth_assistant_leaf: {
        module: ETHAssistantLeaf,
        config: {
            timezone: 'Asia/Riyadh',
            instructions: `Retal is a real-estate developer in Saudi Arabia. Residents use the app to book
amenities, report maintenance issues and follow their property.`,
        } satisfies ETHAssistantLeafConfig,
    },
    eth_admin_leaf: {
        module: ETHAdminLeaf,
        config: {
            // ...
            // Les aides IA du back-office : l'assistant, « Fill with AI », la traduction
            // automatique, le générateur de flows. Sans cette ligne, elles sont toutes masquées.
            features: { ai: true },
        },
    },
}
```

`features.ai` est l'interrupteur de toute l'IA du back-office, pas seulement de l'assistant. À `false` ou absent, le back-office masque l'assistant, le bouton « Fill with AI », « Auto-translate » et « Describe one » dans les flows, et leurs routes refusent. Les routes IA propres au projet demandent `etherial.eth_admin_leaf.aiEnabled()`. Les étapes IA à l'intérieur des flows ne dépendent pas de cet interrupteur : une automatisation en place continue de tourner.

### .env

```
ANTHROPIC_API_KEY=sk-ant-...
```

Le leaf crée une table, `assistant_requests`, par le `sync` du projet, sans migration à écrire. Il ajoute une route : `POST /admin/assistant/ask`.

Au démarrage, la console dit si l'assistant est actif :

```
[ETHAssistantLeaf] On: claude-sonnet-5-5 for questions, claude-haiku-5-5 for summaries and replies
[ETHAssistantLeaf] Off: set ANTHROPIC_API_KEY to turn it on
[ETHAssistantLeaf] Off: turn on the admin leaf's features.ai to turn it on
```

---

## 2. Qui peut s'en servir

Par défaut, une case dans les permissions d'un rôle : **Assistant questions → View**. Elle donne accès à l'assistant, et au journal des questions posées (voir §7). Le super admin y a toujours accès.

Un projet peut choisir une autre règle :

```ts
canUse: (user) => user.role === UserRole.ADMIN,
```

---

## 3. Ce que l'assistant peut lire

Il lit **une collection** si les trois conditions sont réunies :

1. le back-office la liste ;
2. le rôle de la personne peut ouvrir ses fiches. Une collection seulement consultée dans les listes de choix (« lookup ») ne suffit pas ;
3. le projet ne l'a pas écartée (`collections`).

Dans une collection, il lit **un champ** si :

- le schéma du back-office le déclare et la table le contient ;
- c'est du texte, un nombre, une date, un booléen, un choix ou un lien vers une autre fiche. Il ne lit ni le JSON, ni les médias, ni les fichiers ;
- le champ n'est pas `secure` ;
- son nom ne trahit pas un secret : `password`, `token`, `secret`, `otp`, `hash`, `salt`, `pin`, `cvv`, `api_key`… ;
- le projet ne l'a pas écarté (`excludeFields`).

Les liens vers une autre fiche sont nommés comme dans les listes du back-office (le `displayField` de la relation), par exemple « Sara Al-Harbi (#42) ».

Pour écarter ce que l'assistant ne doit pas lire :

```ts
collections: (name) => !['payments', 'national-ids'].includes(name),
excludeFields: { users: ['national_id', 'iban'] },
```

### Ce qui part chez Anthropic

**Ce que l'assistant lit est envoyé à Anthropic** pour qu'il puisse répondre : la question, les lignes lues, la fiche résumée. Cela inclut des données personnelles de résidents (noms, e-mails, téléphones, messages). Anthropic ne s'en sert pas pour entraîner ses modèles. Le client doit tout de même le savoir, et il doit l'accepter avant qu'on active la clé. `excludeFields` sert aussi à ça.

### Ce que l'assistant ne fait pas

- Il ne modifie, n'envoie et ne supprime rien. Si on le lui demande, il dit où cela se fait dans le back-office. Avec `proposals`, il prépare la modification, et c'est la personne qui l'enregistre. Il ne prépare jamais une suppression.
- Il ne donne pas de chiffre qu'il n'a pas lu.
- Il ne suit pas les consignes écrites dans les données. Si un message de résident lui dit d'ignorer ses règles, il le rapporte comme une donnée.

---

## 4. Comment il lit

Pour une question, le modèle « smart » (Sonnet par défaut) dispose de quatre outils :

| Outil | Rôle |
|---|---|
| `describe_collection` | Les champs d'une collection, les valeurs d'un choix, la collection vers laquelle pointe un lien. |
| `count_records` | Compte, avec des filtres. Peut regrouper par champ (statut, type…) ou par jour, semaine, mois ou année d'une date. |
| `query_records` | Liste des lignes (25 au plus) et leur total. |
| `get_record` | Une fiche entière. |

Il fait au plus `maxSteps` lectures (8 par défaut), puis il répond avec ce qu'il a lu.

### Les dates

- « Aujourd'hui », « ce mois-ci » et « la semaine dernière » se lisent dans le fuseau `timezone`. Les heures affichées aussi.
- Une date seule (`2026-10-31`) vaut **le jour entier**. « Jusqu'au 31 » inclut le 31.
- Les jours sont coupés **comme les listes du back-office** les coupent, dans le fuseau de la base. Les 42 réservations annoncées sont donc les 42 lignes derrière le lien. Sur une base en UTC, avec `timezone: 'Asia/Riyadh'`, une réservation à 1 h du matin heure de Riyad compte pour la veille, dans l'assistant comme dans les listes.

### Les liens

Un résultat porte un lien quand la liste du back-office peut montrer les mêmes lignes. Il faut pour cela :

- que chaque filtre porte sur un champ filtrable de la liste (`views.list.filters`) ;
- que chaque filtre soit une égalité sur un choix, un booléen, un lien ou un texte ;
- ou une plage de jours entiers ou de nombres.

Sinon, le résultat n'a pas de lien : mieux vaut pas de lien qu'un lien qui montre d'autres lignes. Un regroupement porte un lien par groupe (« 12 en attente » → la liste des 12).

### Résumer, rédiger

Ces deux tâches passent par le modèle « fast » (Haiku par défaut). Il reçoit :

- la fiche entière ;
- les 10 dernières lignes de chaque sous-collection affichée sur la fiche, si la personne peut les lire.

Il ne fait pas d'autre lecture. La réponse rédigée fait moins de 120 mots et n'invente rien. On peut préciser ce qu'elle doit dire (« dis-lui que le technicien passe jeudi »).

---

## 5. Préparer des modifications (`proposals`)

```ts
config: { proposals: true }            // ou { maxRecords: 50 } : plafond d'une modification groupée (100 au plus)
```

Désactivé par défaut. Activé, l'assistant reçoit quatre outils (cinq avec les automatisations) qui **n'écrivent rien** :

| Outil | Ce qu'il prépare |
|---|---|
| `propose_update` | Changer des champs sur une fiche. |
| `propose_bulk_update` | Le même changement sur plusieurs fiches, par ids ou par filtres (`maxRecords` au plus). |
| `propose_create` | Une nouvelle fiche. |
| `propose_action` | Lancer une action de la collection sur une ou plusieurs fiches (une seule si l'action est `danger`). |
| `propose_flow` | Une automatisation, avec `ETHFlowLeaf` installé et la page `flows` ouverte à la personne (voir plus bas). |

Avant de préparer quoi que ce soit, l'outil vérifie ce que l'endpoint vérifierait : la collection est lisible par la personne, `crud` et `checkAccess` l'autorisent, les champs sont dans `writableFields(collection, user)` du leaf admin (rôles, colonnes protégées), les fiches existent et ne sont pas supprimées, les valeurs sont valides (choix, liens, dates dans le fuseau du projet).

Une heure s'écrit `HH:mm`, un texte riche en HTML. Un champ traduit (`translations`) prend un objet langue → texte : sur une fiche existante, une langue absente garde son texte ; sur une nouvelle fiche, chaque langue est donnée.

Une **sous-liste** (`hasMany` affiché dans le formulaire, comme les horaires d'un planning) se donne en entier, dans l'ordre : `{ id, …champs changés }` garde un élément et le modifie, `{ id }` le garde tel quel, un élément sans `id` est ajouté, un élément absent est retiré (`_deleted`). `get_record` renvoie ses éléments avec leur id (50 au plus). Les champs obligatoires des nouveaux éléments, `min` et `max` sont vérifiés. La carte liste les éléments ajoutés, changés et retirés, ou le nouvel ordre.

Un choix multiple prend la liste de ses valeurs. Un lien multiple (`belongsToMany` sans `pivotFields`, comme les projets d'un segment) prend la liste des ids de toutes les fiches liées, et remplace la liste entière. `describe_collection` le liste dans `can_prepare.lists_of_links`. Un lien multiple, une sous-liste ou un champ traduit se change fiche par fiche, jamais dans une modification groupée. Les actions de catégorie `security` (mot de passe, clé) se lancent à la main, depuis la fiche. Une modification qui ne changerait rien est refusée.

Le back-office reçoit une **carte** dans la conversation : le résumé, un tableau champ / avant / après formaté comme dans le back-office, les fiches concernées, et les boutons Confirmer / Annuler. Confirmer passe par les endpoints habituels (`PUT`, `POST`, `/actions`), avec les droits, les hooks et la validation des formulaires, et l'en-tête `X-Admin-Via: assistant`. L'historique des modifications l'enregistre au nom de la personne, avec `meta.via = 'assistant'` (badge « Via assistant »). Une modification groupée est enregistrée fiche par fiche.

**Remplir le formulaire.** Sur le formulaire d'une nouvelle fiche, ou d'une fiche en cours de modification, le back-office envoie `context.view` (`create` ou `edit`) et `context.form`, ce que le formulaire contient à ce moment (enregistré ou non). L'assistant sait alors que sa carte peut remplir ce formulaire, et part de ce qui est tapé (« traduis ce que j'ai écrit »). Le leaf ne garde de `context.form` que les champs lisibles de la collection et de ses sous-listes, et l'ignore au-delà de 12 000 caractères. La carte d'une création, ou d'une modification d'une seule fiche, propose « Fill the form » quand ce formulaire est ouvert, et « Open in the form » ailleurs. Rien n'est enregistré : la personne vérifie et enregistre elle-même, et la décision est gardée comme `filled`.

**Les automatisations.** Avec `ETHFlowLeaf` installé, l'assistant reçoit aussi `propose_flow`, pour qui peut ouvrir la page `flows`. Il décrit l'automatisation ; le générateur du leaf flow la dessine (déclencheur, étapes, liens), appelé avec la clé et le modèle `smart` de l'assistant. La carte liste le déclencheur et les étapes, et ce qu'il reste à vérifier. Elle ne s'enregistre jamais : « Fill the builder » la met dans le constructeur ouvert, « Open in the builder » l'ouvre ailleurs. La personne la vérifie, l'enregistre et l'active là. Dans le constructeur, le back-office envoie `context.flow` (`{ id?, name?, graph }`) : l'assistant modifie ce qui est sur le canevas.

Chaque carte garde la version (`updated_at`) des fiches lues. Le back-office l'envoie en `If-Match` : si quelqu'un a modifié la fiche entre-temps, l'enregistrement est refusé (409) au lieu d'écraser son travail.

Ce que la personne a décidé est renvoyé à Claude avec la question suivante, sur une ligne « [Back office: …] ». Il sait ainsi si la modification a été enregistrée, annulée, refusée ou mise dans le formulaire, et ne prétend jamais qu'une modification est faite avant la confirmation.

Le back-office lit `features.assistant.proposals`. Sans lui, il n'affiche aucune carte.

---

## 6. Garder les conversations (`history`)

```ts
config: { history: true }              // ou { keepDays: 90 } : 0 = garder sans limite
```

Désactivé par défaut. Activé, le leaf crée la table `assistant_conversations` (par le `sync`) : chaque réponse est ajoutée à la conversation de la personne, avec ses cartes et ce qui a été décidé. Le bouton Historique du panneau liste ses conversations ; elle peut en rouvrir une pour la continuer, la renommer ou la supprimer. **Chacun ne voit que les siennes**, super admin compris.

Contrairement au journal, une conversation garde **les réponses**, donc des données de résidents. Le client doit le savoir. Les conversations sans activité depuis `keepDays` jours (90 par défaut) sont supprimées. Une carte rouverte plus d'une heure après ne peut plus être confirmée : on redemande, sur les données du moment.

Routes, toutes réservées à leur propriétaire (404 sinon) :

| Route | Rôle |
|---|---|
| `GET /admin/assistant/conversations?q=` | Les 100 dernières : `{ items: [{ id, title, turns, created_at, updated_at }] }`. |
| `GET /admin/assistant/conversations/:id` | Une conversation et ses tours. |
| `PUT /admin/assistant/conversations/:id` | `{ title }` : la renommer. |
| `DELETE /admin/assistant/conversations/:id` | La supprimer. |
| `POST /admin/assistant/conversations/:id/decisions` | `{ proposal, status, error?, createdId? }` : ce qui a été décidé sur une carte (`confirmed`, `cancelled`, `failed` ou `filled`). |

---

## 7. Le journal

Chaque demande crée une ligne dans `assistant_requests`, visible dans le back-office sous **Assistant questions**. Cette collection est hors du menu : on l'ouvre depuis le panneau de l'assistant ou par l'URL `/assistant-requests`.

Une ligne contient :

- qui a demandé, quand, quoi (la question) ;
- depuis quelle page ;
- les collections lues ;
- le nombre de lectures ;
- le statut : répondu ou échoué, avec l'erreur ;
- le modèle, les tokens et la durée.

**La réponse n'est pas gardée**. Elle peut contenir des données de résidents, et elle se retrouve en relisant les liens. Avec `history`, elle l'est dans la conversation de la personne seulement (section 6), pas dans le journal.

La commande `purge` du leaf vide le journal (et les conversations, avec `history`) sans confirmation. À réserver aux bases de test.

---

## 8. Coût et limites

- `dailyLimit` : nombre de demandes par personne sur 24 heures glissantes (200 par défaut, `0` pour aucune limite). Les demandes échouées ne comptent pas.
- Les règles et la liste des collections sont mises en cache chez Anthropic (prompt caching). Après la première question, elles coûtent dix fois moins.
- Une question coûte en général entre 2 000 et 15 000 tokens en entrée, selon le nombre de lectures, et quelques centaines en sortie. Le journal donne le chiffre exact de chaque demande.

---

## 9. Référence

### Config

| Clé | Défaut | Rôle |
|---|---|---|
| `apiKey` | `ANTHROPIC_API_KEY` | Clé Anthropic. Sans clé, le leaf ne fait rien. |
| `baseUrl` | `https://api.anthropic.com` | Un proxy, ou un faux serveur en test. |
| `models.smart` | `claude-sonnet-5-5` | Questions sur les données. |
| `models.fast` | `claude-haiku-5-5` | Résumés et réponses rédigées. |
| `collections` | toutes | Liste de noms, ou fonction `(name) => boolean`. |
| `excludeFields` | — | `{ collection: ['champ', ...] }`. |
| `dailyLimit` | `200` | Par personne, sur 24 h. `0` = aucune limite. |
| `timezone` | `UTC` | « Aujourd'hui », les heures affichées. |
| `instructions` | — | Le projet en quelques phrases, lues avant chaque question. |
| `maxSteps` | `8` | Lectures par question. |
| `canUse` | case « Assistant questions » | `(user) => boolean`. |
| `usersCollection` | `users` | Collection des utilisateurs, pour le journal. |
| `proposals` | `false` | `true` ou `{ maxRecords }` : préparer des modifications à confirmer (section 5). |
| `history` | `false` | `true` ou `{ keepDays }` : garder les conversations de chacun (section 6). |

### Route

`POST /admin/assistant/ask`

```json
{
    "task": "ask",
    "messages": [{ "role": "user", "content": "How many padel bookings this month?" }],
    "context": { "collection": "bookings", "filters": { "status": "confirmed" } }
}
```

- `task` : `ask` (question), `summarize` (résumé) ou `draft` (réponse rédigée).
- `messages` : la conversation, la dernière question en dernier. Les 12 derniers messages comptent.
- `context` : la page ouverte (`collection`, `id`, `filters`, `search`, et `view` : `create` ou `edit` sur un formulaire). Pour `summarize` et `draft`, `collection` et `id` sont obligatoires.
- `language` : `en` ou `ar`, pour `summarize` et `draft`. Une question reçoit une réponse dans sa propre langue.
- `conversationId` (avec `history`) : la conversation à continuer. `where` : la page, telle que le panneau la nomme.

Réponse :

```json
{
    "status": 200,
    "data": {
        "answer": "There are **42** padel bookings this month. [See them](/bookings?filters=...)",
        "steps": [{ "tool": "count_records", "label": "Counted Bookings", "collection": "bookings", "count": 42, "link": "/bookings?filters=..." }],
        "model": "claude-sonnet-5-5",
        "usage": { "input_tokens": 5210, "output_tokens": 96, "cached_tokens": 4100 }
    }
}
```

Avec `proposals`, `data.proposals` liste les cartes : `{ id, kind, collection, recordId?, recordIds?, action?, data, diff: [{ field, label, before, after }], summary, title, collectionLabel, actionLabel?, tone?, records?, link?, notes?, versions? }` (`kind` : `update`, `create`, `action`, `bulk_update` ou `flow`). Avec `history`, `data.conversationId` dit où le tour a été gardé.

Erreurs (`errors[0]`) :

| Code | Statut | Cas |
|---|---|---|
| `forbidden` | 403 | Pas le droit d'utiliser l'assistant, ou fiche illisible. |
| `assistant_not_configured` | 503 | Pas de clé. |
| `daily_limit` | 429 | Limite du jour atteinte. |
| `question_missing`, `record_missing` | 400 | Requête incomplète. |
| `record_not_found` | 404 | La fiche n'existe plus. |
| `provider_busy` | 503 | Anthropic surchargé, après trois essais. |
| `provider_timeout` | 504 | Pas de réponse en 60 s. |
| `provider_auth` | 502 | Clé refusée. |
| `provider_rejected`, `provider_unreachable` | 502 | Autre refus, ou réseau. |

Le back-office lit `features.assistant` dans `/admin/schema` : `{ enabled, collection, dailyLimit, proposals, history }`.
