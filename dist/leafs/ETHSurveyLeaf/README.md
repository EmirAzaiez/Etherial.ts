# ETHSurveyLeaf

Des enquêtes de satisfaction posées dans l'app, écrites et lues dans le back-office.

Une enquête s'écrit dans le back-office (page **Surveys**, bouton **New survey**) :

- **ses questions** : la première est une note qui donne le score de l'enquête (NPS de 0 à 10, ou satisfaction de 1 à 5). Jusqu'à neuf autres peuvent suivre : une note, un choix unique, plusieurs choix ou une réponse écrite. Chaque texte s'écrit dans les langues du projet ;
- **quand elle est posée** : après quel événement du projet (un rendez-vous terminé, un ticket clôturé), éventuellement limité à certaines valeurs (les rendez-vous de certains schedulers, les tickets de certains types) ;
- le délai avant la question, et le nombre de jours pendant lesquels elle reste ouverte.

Le projet, lui, ne déclare que les **événements** possibles, dans son code (section 3).

Le cycle d'une question :

1. Un **événement** a lieu : un rendez-vous passe à « terminé », depuis le back-office, l'app ou une synchro Salesforce. Le leaf cherche l'enquête active de cet événement : celle limitée à cette valeur (ce scheduler), sinon celle posée après tous. Le code du projet peut aussi appeler `invite()`.
2. La question **s'ouvre** après le délai de l'enquête. Par exemple, une heure après la visite.
3. L'app demande s'il y a une enquête en attente (`GET /surveys/pending`), pose ses questions une à une, puis envoie les réponses ou un « pas maintenant ».
4. Sans réponse, la question **expire** après le nombre de jours de l'enquête.
5. Le back-office lit le score, le taux de réponse, la tendance, le détail de chaque question et les réponses écrites : page **Surveys**, et panneau **Surveys** sur la fiche d'un utilisateur.

Le leaf ne fonctionne qu'avec Postgres. Il crée deux tables, `survey_forms` (les enquêtes) et `survey_responses` (les questions posées et leurs réponses), par le `sync` du projet, sans migration à écrire.

Tant qu'aucune enquête n'est créée dans le back-office, le leaf ne pose aucune question.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHSurveyLeaf from 'etherial/leafs/ETHSurveyLeaf/app'
import { surveysConfig } from './surveys'

export default {
    eth_survey_leaf: {
        module: ETHSurveyLeaf,
        config: surveysConfig,
    },
    // ...
}
```

Le leaf déclare son formulaire au back-office dans `beforeRun`, avant que l'admin installe son historique des modifications. Sa place dans la config n'a pas d'importance.

### src/surveys.ts

```ts
import type { ETHSurveyLeafConfig } from 'etherial/leafs/ETHSurveyLeaf/app'

export const surveysConfig: ETHSurveyLeafConfig = {
    locales: ['en', 'ar'],        // les langues des questions, la langue par défaut en premier
    timezone: 'Asia/Riyadh',      // où se coupent les jours et les semaines des rapports
    cooldownDays: 30,             // une question par mois au plus, toutes enquêtes confondues
    excludeUser: (user) => user?.role !== UserRole.USER,   // le staff n'est jamais interrogé

    events: [
        {
            key: 'booking_completed',
            label: 'A booking is completed',
            model: 'BookingAppointment',
            when: (row, previous) => row.status === 'completed' && previous('status') !== 'completed',
            user: (row) => row.user_id,
            subject: async (row) => (await Scheduler.findByPk(row.scheduler_id))?.label,
            target: {
                label: 'Scheduler',
                value: (row) => row.scheduler_id,
                options: async () => (await Scheduler.findAll()).map((s) => ({ value: String(s.id), label: s.label })),
            },
        },
    ],
}
```

---

## 2. Les options

| Option | Par défaut | Rôle |
|---|---|---|
| `events` | `[]` | Ce après quoi une enquête peut être posée (section 3). Deux événements ne peuvent pas partager la même `key` : le serveur refuse de démarrer. Sans événement, les enquêtes ne sont posées que par `invite()`. |
| `locales` | `[defaultLocale]` | Les langues dans lesquelles le back-office fait écrire les textes. Le texte de la langue par défaut est obligatoire, les autres facultatifs. |
| `defaultLocale` | la première de `locales`, sinon `en` | La langue utilisée quand l'app n'en donne pas, ou quand un texte n'existe pas dans la langue demandée. |
| `cooldownDays` | `30` | Pendant ce nombre de jours après une invitation, la personne n'est plus invitée, quelle que soit l'enquête. `0` désactive la règle. |
| `timezone` | `UTC` | Le fuseau où se coupent les jours et les semaines des rapports. |
| `excludeUser` | aucun | `(user) => boolean`. Renvoie `true` pour ne jamais interroger quelqu'un : staff, comptes de test. |
| `notify` | aucun | `(invitation, survey) => void`. Appelé une fois, quand la question s'ouvre, pour prévenir la personne (un push, par exemple). `survey` vaut `{ key, title, kind, event }`. Sans lui, l'app trouve la question la prochaine fois qu'elle en demande une. |
| `users` | voir ci-dessous | Comment retrouver et nommer les utilisateurs. |

`users` : `collection` (la collection du back-office, `users` par défaut), `model` (le modèle Sequelize, `User`), `name` (les champs joints pour nommer quelqu'un, `['first_name', 'last_name']`), `fallback` (utilisés si le nom est vide, `['email', 'phone_number', 'phone']`).

---

## 3. Les événements

Un événement écoute les hooks d'un modèle Sequelize. Une modification compte donc d'où qu'elle vienne : back-office, app, synchro Salesforce, script.

| Champ | Rôle |
|---|---|
| `key` | Identifiant stable, enregistré sur les enquêtes. Ne plus le changer une fois des enquêtes créées. |
| `label` | Ce que le back-office affiche : « A booking is completed ». |
| `description` | Une phrase de plus, sous le choix. |
| `model` | Le nom du modèle Sequelize : `BookingAppointment`. |
| `on` | `create`, `update` (par défaut) ou `both`. |
| `when(row, previous)` | Renvoie `true` si cette modification est l'événement. `previous('status')` est la valeur avant la modification (`undefined` sur une nouvelle ligne). |
| `user(row)` | L'id de l'utilisateur interrogé. Peut être asynchrone. |
| `subject(row)` | Le sujet de la réponse : « Handover visit ». Peut être asynchrone. |
| `target` | Facultatif. Ce à quoi une enquête peut être limitée : `label` (« Scheduler »), `value(row)` (la valeur de la ligne : l'id du scheduler) `options()` (les valeurs proposées dans le back-office, `{ value, label, hint? }`) et, si ces valeurs sont les ids d'une collection du back-office, `collection` (`'schedulers'`) : la fiche d'un scheduler montre alors l'enquête posée après lui, avec un lien pour en écrire une. |

**Une seule enquête par événement.** Le back-office refuse deux enquêtes actives qui se chevauchent : deux enquêtes posées après tous les rendez-vous, ou deux enquêtes qui visent le même scheduler. Une enquête limitée à un scheduler passe avant celle posée après tous.

**Tester le passage, pas l'état.** `when` doit comparer avec `previous` : `row.status === 'completed' && previous('status') !== 'completed'`. Sinon, chaque nouvelle sauvegarde d'un rendez-vous terminé relancerait l'invitation. Le leaf la refuserait (même ligne, donc `already_asked`), mais après des requêtes pour rien.

**Le sujet doit rester générique.** Le back-office calcule un score par sujet. Mettez-y un type de visite ou un projet, jamais une date ni un identifiant : la date figure déjà sur chaque réponse, et un sujet par ligne donne un tableau illisible.

**Les transactions sont respectées.** Si la modification a lieu dans une transaction, l'invitation n'est créée qu'après le commit (`afterCommit`). Une transaction annulée n'invite personne.

**Une erreur ne bloque jamais la sauvegarde.** Si `when`, `user`, `subject` ou `target.value` lève une erreur, elle est journalisée et la modification du projet passe quand même.

### Inviter depuis le code

```ts
const result = await etherial.eth_survey_leaf.invite({
    survey: 'after_a_handover',   // la clé de l'enquête, affichée sur sa fiche dans le back-office
    user_id: 42,
    subject: { type: 'ticket', id: 1234, label: 'Maintenance' },
    at: new Date(),   // quand l'événement a eu lieu (par défaut : maintenant)
})
// { invited: true, id } ou { invited: false, reason }
```

Raisons d'un refus : `unknown_survey`, `inactive` (l'enquête est désactivée), `excluded` (`excludeUser`), `cooldown`, `already_asked` (même enquête, même `subject.type` et même `subject.id` déjà posés à cette personne ; un événement utilise le nom du modèle et l'id de la ligne), `no_user`.

---

## 4. Les enquêtes dans le back-office

La collection `survey-forms` est cachée du menu : on y arrive par la page **Surveys** (**New survey**, **Edit**), ou par la fiche d'un élément visé quand l'événement donne sa `collection` (**Create a survey for this scheduler** ouvre le formulaire déjà rempli). Ce qu'une enquête vise se règle sur l'enquête seulement : la fiche de l'élément le montre sans le modifier.

Les noms des valeurs visées sont relus dans `options()` à chaque enregistrement : un scheduler renommé l'est aussi sur l'enquête au prochain enregistrement.

À l'enregistrement, le serveur vérifie :

- entre 1 et 10 questions. La première est une note (0–10 ou 1–5), toujours obligatoire ;
- chaque texte existe dans la langue par défaut ;
- un choix a entre 2 et 12 options ;
- l'enquête ne chevauche pas une autre enquête active du même événement ;
- une fois des réponses reçues, l'échelle de la première question ne change plus, et une question ne change plus de type. On peut en revanche reformuler, ajouter ou retirer des questions et des options : les réponses sont rangées par identifiant de question et d'option, qui ne changent jamais.

La **clé** d'une enquête vient de son titre, à la création, et ne change plus : chaque réponse la garde. Une enquête déjà posée ne se supprime pas : on la désactive. Désactivée, elle n'est plus posée, et les questions qui attendaient ne s'affichent plus.

Pour écrire les enquêtes, un rôle a besoin des droits `create` / `update` sur `survey-forms`. Pour lire les résultats, il a besoin du droit `list` sur `survey-responses`. Le super admin a toujours les deux.

---

## 5. Le contrat avec l'app

Les trois routes demandent un utilisateur connecté (le token habituel). Une personne ne voit et ne modifie que ses propres questions.

| Route | Réponse |
|---|---|
| `GET /surveys/pending` | `data: null`, ou l'enquête ouverte la plus ancienne (voir ci-dessous). Les textes arrivent déjà dans la langue de l'app. |
| `POST /surveys/:id/answer` | Corps `{ answers: { <id de question>: valeur } }`. Renvoie `{ id, status: 'answered' }`. |
| `POST /surveys/:id/dismiss` | « Pas maintenant » : la question est fermée et ne revient pas. Renvoie `{ id, status }`. |

```jsonc
{
    "id": 12,
    "survey": "after_a_handover",
    "kind": "nps",
    "scale": { "min": 0, "max": 10 },
    "subject_label": "Handover visit",
    "locale": "en",
    "questions": [
        { "id": "q1", "type": "nps", "label": "How likely…?", "required": true, "scale": { "min": 0, "max": 10 }, "low_label": "Not likely", "high_label": "Very likely" },
        { "id": "q2", "type": "choice", "label": "What did you like most?", "required": false, "options": [{ "id": "o1", "label": "The team" }, { "id": "o2", "label": "The timing" }] },
        { "id": "q3", "type": "text", "label": "Anything to add?", "required": false }
    ],
    // Pour les versions de l'app d'avant les questions multiples :
    "question": "How likely…?", "comment_prompt": "Anything to add?", "low_label": "Not likely", "high_label": "Very likely"
}
```

Les valeurs des réponses : un entier dans l'échelle pour une note, l'id de l'option pour `choice`, une liste d'ids pour `multiple`, un texte pour `text`. Une question facultative peut être omise.

Une app plus ancienne envoie encore `{ score, comment? }` : le score répond à la première question, le commentaire à la première question écrite, et les questions qu'elle n'a pas affichées ne sont pas exigées.

Codes d'erreur de `answer` :

- `404 not_found` : la question n'existe pas, ou n'est pas à cette personne ;
- `410 closed` : la question a été écartée ou a expiré entre-temps, ou l'enquête a été désactivée ;
- `422` : une question obligatoire manque, une note sort de l'échelle, ou une option n'existe pas.

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
- n'afficher l'enquête que sur un écran principal (le premier écran d'un onglet), jamais par-dessus un formulaire ;
- **ne jamais afficher une enquête sortie d'un cache hors-ligne** : elle a peut-être déjà reçu une réponse ;
- poser les questions une à une, et n'envoyer les réponses qu'à la dernière ;
- toucher en dehors du panneau le range jusqu'au prochain lancement de l'app ; « Pas maintenant » appelle `dismiss` ;
- sur `404` ou `410`, fermer sans message ; sur une erreur réseau, garder le panneau ouvert et proposer de réessayer.

L'app n'a besoin d'aucune nouvelle dépendance native, mais les questions multiples n'apparaissent qu'avec une nouvelle version de l'app (build store ou OTA).

---

## 6. Les résultats

Le leaf déclare la fonctionnalité `surveys` au back-office, qui affiche alors :

- **La page Surveys** (`/surveys`). Un onglet par enquête, active ou non. Elle montre le score de la période, comparé à la période précédente de même durée. Elle montre aussi le taux de réponse, les promoteurs / passifs / détracteurs, l'évolution semaine par semaine et la répartition des notes. Suivent le score par sujet, le détail des autres questions et les réponses, filtrables par groupe et paginées. L'enquête et la période sont dans l'adresse : une vue se partage par lien.
- **Le panneau Surveys** sur la fiche d'un utilisateur : tout ce qui lui a été demandé, avec ses réponses, ses « pas maintenant » et les questions expirées.
- **La collection `survey-responses`**, cachée du menu. Elle sert aux exports et aux permissions.

### Le calcul des scores

- **NPS** : % de promoteurs (9–10) moins % de détracteurs (0–6), de −100 à 100. Les notes 7–8 sont passives.
- **CSAT** : % de satisfaits (4–5), de 0 à 100. La note 3 est neutre, 1–2 mécontents.
- **Taux de réponse** : parmi les questions ouvertes sur la période et déjà refermées (répondues, écartées ou expirées), la part qui a reçu une réponse. Les questions encore en attente ne comptent pas.
- L'onglet **All** additionne les enquêtes d'un même type. Un NPS et un CSAT ne s'additionnent pas. Le détail des autres questions ne s'affiche que pour une enquête à la fois.

### Les routes d'admin

Toutes demandent l'accès au back-office et le droit `list` sur `survey-responses`, sauf `targets`, qui demande le droit d'écrire une enquête.

| Route | Rôle |
|---|---|
| `GET /admin/surveys` | Les enquêtes, actives ou non, avec leurs questions et leur événement. |
| `GET /admin/surveys/targets?event=` | Les valeurs auxquelles une enquête de cet événement peut être limitée. |
| `GET /admin/surveys/overview?survey=&from=&to=` | Le score, sa tendance, la répartition, les sujets et, pour une seule enquête, le détail des autres questions. Par défaut les 90 derniers jours, deux ans au plus. |
| `GET /admin/surveys/comments?survey=&from=&to=&group=&all=&limit=&before=` | Les réponses, les plus récentes d'abord, avec toutes leurs réponses. `group` = `high`, `mid` ou `low`. `all=1` inclut les réponses sans commentaire. `limit` va jusqu'à 50 (30 par défaut). La réponse contient `nextBefore`, à repasser en `before` pour la page suivante, ou `null` en fin de liste. |
| `GET /admin/surveys/users/:id` | Tout ce qui a été demandé à une personne. |

---

## 7. Vie privée et maintenance

- Une réponse stocke : l'utilisateur, les réponses, le sujet, la langue, la plateforme et la version de l'app. Rien d'autre sur le téléphone.
- Les réponses écrites sont du texte libre écrit par les clients. Elles ne sortent du back-office que par l'export de la collection.
- `purge` vide la table des réponses sans confirmation (les enquêtes restent). À réserver aux bases de test.
- Une minute après le démarrage, puis chaque minute, le serveur ferme les questions expirées et appelle `notify` pour celles qui viennent de s'ouvrir. Chaque question n'est notifiée qu'une fois, même avec plusieurs serveurs.

---

## 8. Retal

Configuration : `src/surveys.ts`. Trois événements :

- `booking_completed` : un rendez-vous pris dans l'app (`BookingAppointment`) est terminé. Limitable par **scheduler** ;
- `appointment_completed` : un rendez-vous Salesforce (`Appointment`) est terminé. Limitable par **type de visite** ;
- `ticket_closed` : un ticket est clôturé. Limitable par **type de ticket**. Attention : Salesforce envoie déjà sa propre enquête à la clôture d'un ticket.

Seuls les résidents sont interrogés, au plus une fois tous les 30 jours. Pas de `notify` pour l'instant : la question attend la prochaine ouverture de l'app.
