# ETHSurveyLeaf

Des enquêtes de satisfaction posées dans l'app, et lues dans le back-office. Une enquête est **une seule question** notée (NPS de 0 à 10, ou satisfaction de 1 à 5), suivie d'un commentaire facultatif.

Le cycle d'une question :

1. Un **déclencheur** invite quelqu'un. Par exemple, un rendez-vous passe à « terminé », depuis le back-office, l'app ou une synchro Salesforce. Le code du projet peut aussi appeler `invite()`.
2. La question **s'ouvre** après le délai de l'enquête (`delayMinutes`). Par exemple, une heure après la visite.
3. L'app demande s'il y a une question en attente (`GET /surveys/pending`), l'affiche, puis envoie la réponse ou un « pas maintenant ».
4. Sans réponse, la question **expire** après `expiresAfterDays` jours.
5. Le back-office lit le score, le taux de réponse, la tendance et les commentaires : page **Surveys**, et panneau **Surveys** sur la fiche d'un utilisateur.

Le leaf ne fonctionne qu'avec Postgres. Il crée une table, `survey_responses`, par le `sync` du projet, sans migration à écrire.

Sans `surveys` ni `triggers`, le leaf ne pose aucune question. Monter le hash du framework sur un projet ne change donc rien tant que ce projet ne liste pas d'enquête.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHSurveyLeaf from 'etherial/leafs/ETHSurveyLeaf/app'
import { surveysConfig } from './surveys'

export default {
    // ... après eth_admin_leaf ...
    eth_survey_leaf: {
        module: ETHSurveyLeaf,
        config: surveysConfig,
    },
}
```

Le leaf se déclare au back-office dans `afterRun`. Il doit donc être listé **après** `eth_admin_leaf`.

### src/surveys.ts

```ts
import type { ETHSurveyLeafConfig } from 'etherial/leafs/ETHSurveyLeaf/app'

export const surveysConfig: ETHSurveyLeafConfig = {
    timezone: 'Asia/Riyadh',      // où se coupent les jours et les semaines des rapports
    defaultLocale: 'en',
    cooldownDays: 30,             // une question par mois au plus, toutes enquêtes confondues
    excludeUser: (user) => user?.role !== UserRole.USER,   // le staff n'est jamais interrogé

    surveys: [
        {
            key: 'appointment',
            title: 'After an appointment',
            description: 'Asked when an appointment is marked as completed.',
            kind: 'nps',
            question: { en: 'How likely are you to recommend us to a friend?', ar: '...' },
            commentPrompt: { en: 'What is the main reason for your score?', ar: '...' },
            lowLabel: { en: 'Not likely', ar: '...' },
            highLabel: { en: 'Very likely', ar: '...' },
            delayMinutes: 60,
            expiresAfterDays: 7,
        },
    ],

    triggers: [
        {
            survey: 'appointment',
            model: 'BookingAppointment',
            when: (row, previous) => row.status === 'completed' && previous('status') !== 'completed',
            user: (row) => row.user_id,
            subject: (row) => row.visit_type || 'Appointment',
        },
    ],
}
```

---

## 2. Les options

### Le leaf

| Option | Par défaut | Rôle |
|---|---|---|
| `surveys` | `[]` | Les enquêtes (voir plus bas). Deux enquêtes ne peuvent pas partager la même `key` : le serveur refuse de démarrer. |
| `triggers` | `[]` | Ce qui invite les gens (section 3). |
| `cooldownDays` | `30` | Pendant ce nombre de jours après une invitation, la personne n'est plus invitée, quelle que soit l'enquête. `0` désactive la règle. |
| `defaultLocale` | `en` | La langue utilisée quand l'app n'en donne pas, ou quand un texte n'existe pas dans la langue demandée. |
| `timezone` | `UTC` | Le fuseau où se coupent les jours et les semaines des rapports. |
| `excludeUser` | aucun | `(user) => boolean`. Renvoie `true` pour ne jamais interroger quelqu'un : staff, comptes de test. |
| `notify` | aucun | `(invitation, survey) => void`. Appelé une fois, quand la question s'ouvre, pour prévenir la personne (un push, par exemple). Sans lui, l'app trouve la question la prochaine fois qu'elle en demande une. |
| `users` | voir ci-dessous | Comment retrouver et nommer les utilisateurs. |

`users` : `collection` (la collection du back-office, `users` par défaut), `model` (le modèle Sequelize, `User`), `name` (les champs joints pour nommer quelqu'un, `['first_name', 'last_name']`), `fallback` (utilisés si le nom est vide, `['email', 'phone_number', 'phone']`).

### Une enquête

| Champ | Par défaut | Rôle |
|---|---|---|
| `key` | obligatoire | Identifiant stable, enregistré avec chaque réponse. Ne plus le changer une fois en production. |
| `title` | obligatoire | Le nom affiché dans le back-office. |
| `description` | aucune | Quand la question est posée, en une phrase. Le back-office l'affiche quand une période n'a aucune réponse. |
| `kind` | `nps` | `nps` : de 0 à 10. `csat` : de 1 à 5. |
| `question` | obligatoire | La question, telle que la personne la lit. |
| `commentPrompt` | aucun | Le texte du champ de commentaire. |
| `lowLabel` / `highLabel` | aucun | Les mots aux deux bouts de l'échelle. |
| `delayMinutes` | `0` | Minutes entre l'événement et l'ouverture de la question. Laisser la visite se terminer. |
| `expiresAfterDays` | `7` | Jours pendant lesquels la question reste ouverte. |

Les textes acceptent une chaîne unique ou un objet par langue : `{ en: '…', ar: '…' }`. Le leaf choisit la langue demandée, sinon `defaultLocale`, sinon la première écrite.

---

## 3. Les déclencheurs

Un déclencheur écoute les hooks d'un modèle Sequelize. Une modification compte donc d'où qu'elle vienne : back-office, app, synchro Salesforce, script.

| Champ | Rôle |
|---|---|
| `survey` | La `key` de l'enquête posée. |
| `model` | Le nom du modèle Sequelize : `BookingAppointment`. |
| `on` | `create`, `update` (par défaut) ou `both`. |
| `when(row, previous)` | Renvoie `true` si cette modification doit poser la question. `previous('status')` est la valeur avant la modification (`undefined` sur une nouvelle ligne). |
| `user(row)` | L'id de l'utilisateur interrogé. Peut être asynchrone. |
| `subject(row)` | Le sujet de la réponse : « Handover visit ». Peut être asynchrone. |

**Tester le passage, pas l'état.** `when` doit comparer avec `previous` : `row.status === 'completed' && previous('status') !== 'completed'`. Sinon, chaque nouvelle sauvegarde d'un rendez-vous terminé relancerait l'invitation. Le leaf la refuserait (même ligne, donc `already_asked`), mais après des requêtes pour rien.

**Le sujet doit rester générique.** Le back-office calcule un score par sujet. Mettez-y un type de visite ou un projet, jamais une date ni un identifiant : la date figure déjà sur chaque réponse, et un sujet par ligne donne un tableau illisible.

**Les transactions sont respectées.** Si la modification a lieu dans une transaction, l'invitation n'est créée qu'après le commit (`afterCommit`). Une transaction annulée n'invite personne.

**Une erreur ne bloque jamais la sauvegarde.** Si `when`, `user` ou `subject` lève une erreur, elle est journalisée et la modification du projet passe quand même.

### Inviter depuis le code

```ts
const result = await etherial.eth_survey_leaf.invite({
    survey: 'appointment',
    user_id: 42,
    subject: { type: 'ticket', id: 1234, label: 'Maintenance' },
    at: new Date(),   // quand l'événement a eu lieu (par défaut : maintenant)
})
// { invited: true, id } ou { invited: false, reason }
```

Raisons d'un refus : `unknown_survey`, `excluded` (`excludeUser`), `cooldown`, `already_asked` (même enquête, même `subject.type` et même `subject.id` déjà posés à cette personne ; un déclencheur utilise le nom du modèle et l'id de la ligne), `no_user`.

---

## 4. Le contrat avec l'app

Les trois routes demandent un utilisateur connecté (le token habituel). Une personne ne voit et ne modifie que ses propres questions.

| Route | Réponse |
|---|---|
| `GET /surveys/pending` | `data: null`, ou la question ouverte la plus ancienne : `{ id, survey, kind, scale: { min, max }, question, comment_prompt, low_label, high_label, subject_label, locale }`. Les textes arrivent déjà dans la langue de l'app. |
| `POST /surveys/:id/answer` | Corps `{ score, comment? }`. Renvoie `{ id, status: 'answered' }`. |
| `POST /surveys/:id/dismiss` | « Pas maintenant » : la question est fermée et ne revient pas. Renvoie `{ id, status }`. |

Codes d'erreur de `answer` :

- `404 not_found` : la question n'existe pas, ou n'est pas à cette personne ;
- `410 closed` : la question a été écartée ou a expiré entre-temps ;
- `422` : le score n'est pas un entier dans l'échelle.

Renvoyer une réponse à une question déjà répondue ne change rien et renvoie `200`. L'app peut donc réessayer sans risque après une coupure réseau.

### Les en-têtes lus

| En-tête | Usage |
|---|---|
| `x-app-locale` | La langue des textes (`?locale=` et `Accept-Language` en secours). Enregistrée avec la réponse. |
| `x-app-platform` | `ios` / `android`, enregistré avec la réponse. |
| `x-app-version` | Enregistré avec la réponse. |

### Ce que l'app doit faire

L'app Retal (`src/Components/Survey/SurveyPrompt.tsx`) sert de référence :

- demander `GET /surveys/pending` à l'ouverture et au retour au premier plan, au plus toutes les dix minutes ;
- n'afficher la question que sur un écran principal (le premier écran d'un onglet), jamais par-dessus un formulaire ;
- **ne jamais afficher une question sortie d'un cache hors-ligne** : elle a peut-être déjà reçu une réponse ;
- toucher en dehors du panneau le range jusqu'au prochain lancement de l'app ; « Pas maintenant » appelle `dismiss` ;
- sur `404` ou `410`, fermer sans message ; sur une erreur réseau, garder le panneau ouvert et proposer de réessayer.

L'app n'a besoin d'aucune nouvelle dépendance native, mais le questionnaire n'apparaît qu'avec une nouvelle version de l'app (build store ou OTA).

---

## 5. Le back-office

Le leaf déclare la fonctionnalité `surveys` au back-office, qui affiche alors :

- **La page Surveys** (`/surveys`). Elle montre le score de la période, comparé à la période précédente de même durée. Elle montre aussi le taux de réponse, les promoteurs / passifs / détracteurs, l'évolution semaine par semaine et la répartition des notes. Suivent le score par sujet et les commentaires, filtrables par groupe et paginés. L'enquête et la période sont dans l'adresse : une vue se partage par lien.
- **Le panneau Surveys** sur la fiche d'un utilisateur : tout ce qui lui a été demandé, avec ses réponses, ses « pas maintenant » et les questions expirées.
- **La collection `survey-responses`**, cachée du menu. Elle sert aux exports et aux permissions.

Pour qu'un rôle voie les enquêtes, il lui faut le droit `list` sur `survey-responses` dans la matrice des permissions. Le super admin l'a toujours.

### Le calcul des scores

- **NPS** : % de promoteurs (9–10) moins % de détracteurs (0–6), de −100 à 100. Les notes 7–8 sont passives.
- **CSAT** : % de satisfaits (4–5), de 0 à 100. La note 3 est neutre, 1–2 mécontents.
- **Taux de réponse** : parmi les questions ouvertes sur la période et déjà refermées (répondues, écartées ou expirées), la part qui a reçu une réponse. Les questions encore en attente ne comptent pas.
- L'onglet **All** additionne les enquêtes d'un même type. Un NPS et un CSAT ne s'additionnent pas.

### Les routes d'admin

Toutes demandent l'accès au back-office et le droit `list` sur `survey-responses`.

| Route | Rôle |
|---|---|
| `GET /admin/surveys/overview?survey=&from=&to=` | Le score, sa tendance, la répartition, les sujets. Par défaut les 90 derniers jours, deux ans au plus. |
| `GET /admin/surveys/comments?survey=&from=&to=&group=&all=&limit=&before=` | Les réponses, les plus récentes d'abord. `group` = `high`, `mid` ou `low`. `all=1` inclut les réponses sans commentaire. `limit` va jusqu'à 50 (30 par défaut). La réponse contient `nextBefore`, à repasser en `before` pour la page suivante, ou `null` en fin de liste. |
| `GET /admin/surveys/users/:id` | Tout ce qui a été demandé à une personne. |

---

## 6. Vie privée et maintenance

- Une réponse stocke : l'utilisateur, la note, le commentaire, le sujet, la langue, la plateforme et la version de l'app. Rien d'autre sur le téléphone.
- Les commentaires sont du texte libre écrit par les clients. Ils ne sortent du back-office que par l'export de la collection.
- `purge` vide la table sans confirmation. À réserver aux bases de test.
- Une minute après le démarrage, puis chaque minute, le serveur ferme les questions expirées et appelle `notify` pour celles qui viennent de s'ouvrir. Chaque question n'est notifiée qu'une fois, même avec plusieurs serveurs.

---

## 7. Retal

Configuration : `src/surveys.ts`.

- Une enquête, `appointment` (NPS) : une heure après qu'un rendez-vous est marqué terminé, qu'il ait été pris dans l'app (`BookingAppointment`) ou chez Salesforce (`Appointment`). Le sujet est le type de visite.
- Les tickets clôturés ne sont **pas** interrogés : Salesforce envoie déjà sa propre enquête pour eux.
- Seuls les résidents sont interrogés, au plus une fois tous les 30 jours.
- Pas de `notify` pour l'instant : la question attend la prochaine ouverture de l'app.
