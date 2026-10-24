# ETHCaseLeaf

Les demandes des clients (maintenance, réclamations, questions) traitées par notre staff dans notre back-office. Le système du client (Salesforce…) ne reçoit qu'une copie si le projet le veut.

C'est le mode « ++ » : nous sommes maîtres des tickets. Un projet où Salesforce reste maître (le mode relais, comme Retal et ses `Case`) n'utilise pas ce leaf, et ce code reste propre au projet. Un projet peut aussi mélanger les deux : ses tickets venus de Salesforce restent en lecture seule (`readOnly`), ceux de l'app sont traités chez nous.

Le leaf apporte :

- **la conversation** : réponses que le client lit, notes internes qu'il ne voit jamais, fichiers, réponses types ;
- **le traitement** : assignation, statut, priorité, catégorie, et l'action **Assign to Me** ;
- **les délais (SLA)** : des règles par type, catégorie et priorité donnent à chaque ticket une échéance de première réponse et de résolution ; une horloge marque les tickets en retard et alerte le staff, une seule fois ;
- **l'historique** de chaque ticket : statut, assignation, priorité, catégorie, type, confirmation et note du client, retard, avec l'auteur et le canal (app, back-office, système) ;
- **les alertes au staff** dans la cloche du back-office : nouveau ticket, réponse du client, ticket assigné, client qui dit « pas réglé », retard ;
- **les messages au client** par le `notify` du projet : une réponse, un ticket résolu, un ticket fermé ;
- **le lien avec ETHSurveyLeaf** : un questionnaire à la fermeture d'un ticket, et, si le projet le veut, un ticket ouvert par une mauvaise réponse ;
- **l'envoi vers un système extérieur** (`sync`, `syncComments`), si le projet le branche.

Le projet garde :

- **ses tables** : il étend les modèles de base du leaf (section 2) ;
- **sur quoi porte un ticket** (`subject`, un lot) ;
- **ses routes de l'app** : elles appellent les services du leaf (section 5) ;
- **le texte des messages** : `notify` reçoit l'événement et choisit le push, l'email, la langue.

---

## 1. Brancher le leaf

### Config.ts

Le leaf se place **avant** `eth_admin_leaf` : il déclare son back-office pendant son `run`, et l'admin installe son historique des modifications sur les collections déjà déclarées. Il se place aussi **après** `eth_survey_leaf` si `fromSurvey` est utilisé.

```ts
import ETHCaseLeaf from 'etherial/leafs/ETHCaseLeaf/app'
import { casesConfig } from './cases'

export default {
    // ...
    eth_case_leaf: {
        module: ETHCaseLeaf,
        config: casesConfig,
    },
    eth_admin_leaf: { /* ... */ },
}
```

### src/cases.ts

```ts
import type { ETHCaseLeafConfig } from 'etherial/leafs/ETHCaseLeaf/app'

export const casesConfig: ETHCaseLeafConfig = {
    kinds: [{ value: 'MAINTENANCE', label: 'Maintenance' }, /* ... */],
    subject: { field: 'unit_id', model: 'Unit', collection: 'units', displayField: 'name', label: 'Unit' },
    // Les tickets lus depuis Salesforce : affichés, pas traités ici.
    readOnly: (kase) => (kase.sf_case_id ? `${kase.reference} comes from Salesforce: handle it there.` : null),
    notify: async ({ kind, case: kase, comment }) => {
        // 'reply' | 'resolved' | 'closed' : un push, un email… dans la langue du client
    },
    staffAttachments: 'internal',
    attachmentFolders: ['case-attachments'],
    admin: { group: 'Owners', words: { case: 'Request', cases: 'Requests', customer: 'Owner' } },
}
```

---

## 2. Les tables

Le leaf fournit deux modèles de base, sans `@Table`. Le projet les étend, choisit le nom des tables et ajoute ses clés étrangères et ses associations, comme pour ETHPulseLeaf :

| Base | Table habituelle | Ce que le projet ajoute |
|---|---|---|
| `BaseCase` | `cases` | les FK `user_id` et `assigned_to_user_id`, la colonne du subject (`unit_id`), ses colonnes propres (`sf_case_id`), les associations, `comments` |
| `BaseCaseComment` | `case_comments` | les FK `case_id` et `author_user_id`, les associations |

```ts
@Table({ timestamps: true, tableName: 'cases', freezeTableName: true })
export class Case extends BaseCase {
    @ForeignKey(() => User)
    declare user_id: number

    @BelongsTo(() => User, 'user_id')
    declare user: User

    @ForeignKey(() => User)
    declare assigned_to_user_id: number

    @BelongsTo(() => User, 'assigned_to_user_id')
    declare assigned_to: User

    @HasMany(() => CaseComment)
    declare comments: CaseComment[]
}
```

**Règles :**

1. Les colonnes, leurs index et les hooks restent dans la base. La sous-classe ne redéclare ni `@Column` ni `@Index` sur une colonne de la base : `@ForeignKey` et `declare` suffisent.
2. Les index de la base (`user_id`, `status`, `last_activity_at`, `case_id`) portent les mêmes noms que ceux qu'un projet aurait déclarés lui-même : une table existante ne bouge pas.
3. Les noms de modèle par défaut sont `Case` et `CaseComment`. L'option `models` en change.

Le leaf ajoute trois tables à lui : `case_events` (l'historique), `case_canned_replies` (les réponses types) et `case_sla_policies` (les délais).

### Colonnes ajoutées par rapport à un ticket simple

| Colonne | Rôle |
|---|---|
| `first_response_due_at` | échéance de la première réponse (règle SLA à l'ouverture) |
| `resolution_due_at` | échéance de résolution, recomptée à une réouverture |
| `awaiting_reply_since` | depuis quand le client attend une réponse ; vidé quand le staff répond |
| `attention` | `overdue` (en retard), `reply` (le client attend), ou vide : ce que la boîte de réception filtre |
| `case_comments.attachments` | les fichiers d'un message du staff |

---

## 3. Ce que font les hooks

Quel que soit l'auteur (l'app, le staff, une synchro), les hooks des modèles :

- **à la création** : écrivent la référence (`CASE-000123`, option `reference`), démarrent les horloges (échéances, client en attente), écrivent l'événement « ouvert » et alertent le staff, sauf si le ticket est ouvert depuis le back-office ;
- **à un changement de statut** : datent `status_entered_at`, `resolved_at` et `closed_at` ; une réouverture (résolu ou fermé, puis rouvert) compte dans `reopened_count` et relance l'échéance de résolution ;
- **à un changement de type, de catégorie ou de priorité** : recalculent les échéances ;
- **après chaque modification** : écrivent l'historique, alertent la personne assignée, alertent le staff quand le client dit « pas réglé », et préviennent le client quand son ticket est résolu ou fermé ;
- **à un message** : une réponse du staff (pas une note interne) date la première réponse, vide l'attente et prévient le client ; un message du client remet le ticket « In progress » s'il attendait le client, et alerte le staff.

Une écriture qui passe `{ notify: false }` ne prévient pas le client (c'est lui qui a agi). Un ticket en lecture seule (`readOnly`) n'a ni horloge ni alerte, mais le client est toujours prévenu d'une résolution ou d'une fermeture.

Les statuts : `NEW`, `TRIAGED`, `IN_PROGRESS`, `WAITING_ON_CUSTOMER`, `WAITING_ON_VENDOR` (ouverts), `RESOLVED`, `CLOSED`, `CANCELLED`. Un ticket résolu attend la confirmation du client (`awaitsConfirmation`).

---

## 4. Les délais (SLA)

Dans **Response Times**, chaque règle porte sur un type, une catégorie et une priorité (vide = tous) et donne un délai de réponse et un délai de résolution, en heures calendaires. La règle la plus précise qui correspond s'applique ; sans règle, pas d'échéance.

- Les échéances sont posées à l'ouverture et recalculées si le type, la catégorie ou la priorité changent.
- Un ticket « Waiting on customer » n'est jamais marqué en retard.
- Chaque minute, l'horloge (une seule instance à la fois, verrou en base) marque `attention = overdue` sur les tickets passés et alerte la personne assignée, sinon tout le staff qui traite les tickets. Une seule alerte par ticket ; elle repart si le ticket repasse en retard après une réponse ou une réouverture.

Les tickets existants avant le branchement n'ont pas d'échéance : seuls les nouveaux, et ceux qui changent de type, catégorie ou priorité, en reçoivent une.

---

## 5. Les routes de l'app (côté projet)

Le leaf n'a pas de route pour l'app : chaque projet garde son format de réponse. Ses routes appellent les services :

| Service | Rôle |
|---|---|
| `openCase(draft)` | ouvre un ticket (`channel` par défaut `APP`) |
| `replyToCase(kase, { body, internal, attachments, author, status })` | message du staff, avec changement de statut éventuel ; le client n'est prévenu qu'une fois |
| `confirmResolution(kase, { fixed, note })` | le client confirme (fermé) ou non (remis « In progress ») |
| `rateCase(kase, { rating, note })` | la note du client |
| `awaitsConfirmation(kase)` | le ticket attend-il la confirmation du client |

Un message du client se crée directement (`CaseComment.create({ author_kind: 'resident', ... })`) : le hook fait le reste.

---

## 6. Le back-office

Les collections, dans le groupe `admin.group` (défaut « Support ») :

- **Cases** : la boîte de réception, filtrable par statut, attention (en retard, réponse attendue), type, catégorie, priorité, assigné ; la fiche montre le panneau de conversation ;
- **Case Conversations** : tous les messages ;
- **Canned Replies** : les réponses types, avec `{{customer_name}}`, `{{reference}}`, `{{subject}}`, `{{staff_name}}` ; les plus utilisées d'abord ;
- **Response Times** : les règles SLA ;
- **Case History** (masquée du menu) : l'historique brut.

Le panneau de conversation du back-office partagé appelle :

- `GET /admin/cases/:id/thread` : le ticket, les messages et l'historique mêlés par date, les réponses types prêtes à l'emploi, ce que la personne a le droit de faire ;
- `POST /admin/cases/:id/replies` `{ body, internal?, attachments?: [mediaId], status?, canned_reply_id? }` : une réponse ou une note interne, avec un statut éventuel.

Les fichiers du staff passent par ETHMediaLeaf (`requestMediaUpload` puis `confirmMediaUpload`) dans un dossier de `attachmentFolders`, en lecture publique. `staffAttachments: 'internal'` les limite aux notes internes, tant que l'app n'affiche pas les fichiers sur les réponses. Le leaf déclare ses identifiants de fichiers au nettoyage des orphelins d'ETHMediaLeaf.

`admin.words` renomme « Case », « Cases » et « Customer » partout. `admin.extend(name, collection)` modifie une collection avant sa déclaration. Une collection déjà déclarée par le projet n'est pas touchée.

---

## 7. Le lien avec ETHSurveyLeaf

```ts
import { caseClosedSurveyEvent } from 'etherial/leafs/ETHCaseLeaf/app'

// dans la config du survey leaf
events: [caseClosedSurveyEvent()]
```

Avec `fromSurvey`, une réponse que le projet juge mauvaise ouvre un ticket (`channel: 'SURVEY'`), une seule fois, à l'arrivée de la réponse :

```ts
fromSurvey: (response) => (response.score <= 2 ? { user_id: response.user_id, subject: 'Unhappy after a closed request', kind: 'COMPLAINT' } : null)
```

---

## 8. L'envoi vers un système extérieur

Comme les autres leafs (voir `components/sync`) : sans `sync`, rien ne part.

```ts
sync: {
    label: 'Salesforce',
    send: async (kase, { externalId, changes }) => {
        // créer ou mettre à jour la copie, renvoyer son id
        return { externalId: '500...' }
    },
    link: (id) => `https://example.my.salesforce.com/${id}`,
},
syncComments: { send: async (comment, ctx) => { /* ... */ } },
```

L'envoi part après le commit, avec reprises, regroupement et verrou. Les colonnes des horloges (`attention`, échéances, attente, `last_activity_at`) ne déclenchent pas d'envoi, et les notes internes ne partent jamais. Le back-office montre l'état, un bouton **Resend** et une pause par cible.
