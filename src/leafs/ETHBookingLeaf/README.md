# ETHBookingLeaf

La prise de rendez-vous sur notre propre agenda : le client réserve dans l'app, le staff gère tout dans le back-office, et le système du client (Salesforce…) ne reçoit qu'une copie si le projet le veut.

C'est le mode « ++ » : nous sommes maîtres des rendez-vous. Un projet où Salesforce reste maître (le mode relais, comme Retal et ses `Appointment__c`) n'utilise pas ce leaf : ce code reste propre au projet.

Le leaf apporte :

- **le moteur de créneaux** : chaque *scheduler* (une raison de rencontrer le client : remise des clés, visite de chantier…) ouvre des plages horaires certains jours, tenues par des employés ; les fermetures retirent des jours ou des heures ; le moteur en tire les créneaux libres, avec le délai de prévenance, l'horizon, la capacité de chaque employé et les quotas par client ;
- **la garantie anti-doublon** : un index unique en base rend impossible de réserver deux fois la même place, même avec deux requêtes simultanées ;
- **le back-office** : les collections Schedulers, Agents et Bookings, la page **Calendar**, le sélecteur de créneaux à la création d'un rendez-vous, l'action **Cancel Appointment** et les contrôles à l'enregistrement ;
- **les messages au client** par le `notify` du projet : confirmé, déplacé, annulé, et les rappels (la veille, puis peu avant) ;
- **le récapitulatif quotidien** au staff des rendez-vous passés restés « Scheduled » ;
- **l'envoi vers un système extérieur** (`sync`), si le projet le branche.

Le projet garde :

- **ses tables** : il étend les modèles de base du leaf (section 2) ;
- **à quoi appartient un scheduler** (`scope`, un projet immobilier) et **sur quoi porte un rendez-vous** (`subject`, un lot) ;
- **ses routes de l'app** : elles appellent les services du leaf (section 6) ;
- **le texte des messages** : `notify` reçoit l'événement et choisit le push, l'email, la langue.

---

## 1. Brancher le leaf

### Config.ts

Le leaf se place **avant** `eth_admin_leaf` : il déclare son back-office pendant son `run`, et l'admin installe son historique des modifications sur les collections déjà déclarées.

```ts
import ETHBookingLeaf from 'etherial/leafs/ETHBookingLeaf/app'
import { bookingConfig } from './booking'

export default {
    // ...
    eth_booking_leaf: {
        module: ETHBookingLeaf,
        config: bookingConfig,
    },
    eth_admin_leaf: { /* ... */ },
}
```

### src/booking.ts

```ts
import type { ETHBookingLeafConfig } from 'etherial/leafs/ETHBookingLeaf/app'
import { formatAppointmentTime } from 'etherial/leafs/ETHBookingLeaf/app'

export const bookingConfig: ETHBookingLeafConfig = {
    timezone: 'Asia/Dubai',
    weekend: [6, 0],                      // samedi et dimanche
    scope: { field: 'project_id', model: 'Project', collection: 'projects', displayField: 'name', label: 'Project' },
    subject: { field: 'unit_id', model: 'Unit', scopeField: 'project_id', collection: 'units', displayField: 'name', label: 'Unit' },
    notify: async ({ kind, appointment, timezone }) => {
        const when = formatAppointmentTime(appointment.starts_at, timezone)
        // un push, un email… dans la langue du client
    },
    reminders: { dayBefore: true, soon: true, soonHours: 2 },
    overdue: { hour: 8 },
}
```

---

## 2. Les tables

Le leaf fournit six modèles de base, sans `@Table`. Le projet les étend, choisit le nom des tables et ajoute ses clés étrangères et ses associations, comme pour ETHPulseLeaf :

| Base | Table habituelle | Ce que le projet ajoute |
|---|---|---|
| `BaseScheduler` | `schedulers` | la colonne du scope (`project_id`) et son association, `windows`, `blocks`, `appointments` |
| `BaseSchedulerWindow` | `scheduler_windows` | la FK `scheduler_id`, l'association `agents` (belongsToMany par `SchedulerWindowHost`) |
| `BaseSchedulerWindowHost` | `scheduler_window_hosts` | les FK `scheduler_window_id` et `agent_id` |
| `BaseSchedulerBlock` | `scheduler_blocks` | les FK `scheduler_id` et `agent_id` (une fermeture vaut pour tout le scheduler, ou pour un employé) |
| `BaseAgent` | `agents` | facultatif : `user_id` (le compte de l'employé), `holidays` |
| `BaseBookingAppointment` | `booking_appointments` | les FK `user_id`, `agent_id`, `scheduler_id`, la colonne du subject (`unit_id`) et les associations `user`, `agent`, `scheduler`, celle du subject |

Les noms de modèle par défaut sont `Scheduler`, `SchedulerWindow`, `SchedulerWindowHost`, `SchedulerBlock`, `Agent` et `BookingAppointment`. L'option `models` en change.

Deux règles sur `booking_appointments` :

- **l'index unique anti-doublon** est obligatoire, avec ce nom (le leaf le reconnaît dans l'erreur Postgres) :
  ```ts
  { name: 'booking_appointments_agent_slot_unique', unique: true,
    fields: ['agent_id', 'starts_at', 'slot_seat'], where: { status: 'scheduled' } }
  ```
- si la colonne du subject ne s'appelle pas `property_id`, le modèle ajoute un alias VIRTUAL `property_id` : le sélecteur de créneaux du back-office lit ce nom.

`starts_at` et `ends_at` sont des instants (`timestamptz`). Les heures d'ouverture (`start_minute`, `end_minute` : des minutes depuis minuit) se lisent dans le fuseau du scheduler, sinon celui du leaf.

Le leaf ajoute quatre colonnes facultatives, créées par le `sync` du projet : `schedulers.timezone`, `schedulers.weekend_days`, `booking_appointments.reminded_day_before_at` et `booking_appointments.reminded_soon_at`.

---

## 3. Les options

| Option | Par défaut | Rôle |
|---|---|---|
| `timezone` | `UTC` | Le fuseau des heures d'ouverture et de l'affichage. Un scheduler peut avoir le sien (`timezone`). |
| `weekend` | `[6, 0]` | Les jours sautés par un délai en jours ouvrés, en numéros `Date.getDay()` : `[6, 0]` samedi et dimanche, `[5, 6]` vendredi et samedi. Un scheduler peut avoir les siens (`weekend_days`). |
| `models` | voir section 2 | Les noms des modèles du projet. |
| `scope` | aucun | À quoi appartient un scheduler. Sans lui, chaque scheduler est ouvert à tous les clients. Voir ci-dessous. |
| `subject` | aucun | Sur quoi porte un rendez-vous. Voir ci-dessous. |
| `customers` | `User` / `users` / `email` | Le modèle des clients, sa collection dans le back-office et le champ qui les nomme. |
| `notify` | aucun | `({ kind, appointment, timezone }) => …`. Prévient le client. Tourne en arrière-plan : son échec ne fait jamais échouer l'enregistrement. |
| `reminders` | désactivés | `{ dayBefore?, soon?, soonHours? }`. Les rappels par `notify` (section 4). |
| `overdue` | désactivé | `{ hour? }`. Le récapitulatif quotidien au staff, à `hour` heure locale (8 par défaut). |
| `sync` | aucun | `{ send, link?, label? }`. Copie chaque rendez-vous dans un système extérieur (section 5). |
| `admin` | — | `{ group?, extend?, collections?, visitType? }`. Le groupe du menu (`Scheduling`), une fonction qui modifie une collection avant sa déclaration, les noms des collections et le type de visite affiché par le sélecteur (section 7). |

`scope` : `field` (la colonne sur les schedulers, `project_id`), `model`, `collection`, `displayField`, `secondaryField`, `label` (`Project`) et `helpText` (sous le champ, dans le back-office).

`subject` : `field` (la colonne sur les rendez-vous, `unit_id`), `model`, `scopeField` (la colonne du subject qui donne son scope : quels schedulers le gouvernent), `collection`, `displayField`, `secondaryField`, `label` (`Unit`) et `noScopeHint` (dit au staff quand un subject n'a pas de scope : « Run the Salesforce sync. »).

Deux fonctions, si la règle du projet ne tient pas dans une colonne :

- `scopeOf(subject)` : le scope du subject, à la place de la lecture de `scopeField` (un lot dont le projet se retrouve par une autre colonne) ;
- `closedReason(scheduler, subject)` : pourquoi ce scheduler ne prend pas encore ce subject (un lot pas prêt pour sa remise des clés), en une phrase pour le staff, ou `null`. Le formulaire du back-office refuse alors le rendez-vous sauf si « Book outside the rules » est coché, et le sélecteur de créneaux affiche la raison. Les routes de l'app du projet appellent `subjectClosedReason(scheduler, subject)` elles-mêmes.

**Sans `subject`, le back-office n'a pas de sélecteur de créneaux** : le widget partagé ne s'affiche qu'avec un `property_id`. Le staff saisit alors la date et l'employé à la main, et les contrôles à l'enregistrement s'appliquent quand même.

---

## 4. Les messages au client

`notify` reçoit `kind` :

| `kind` | Quand |
|---|---|
| `confirmed` | Un rendez-vous est créé, par le client ou par le staff. |
| `rescheduled` | Son heure change, qui que ce soit qui l'ait changée. |
| `cancelled` | Il est annulé. Une annulation par le client lui-même passe `{ notify: false }` à l'`update` : il le sait déjà. |
| `reminder_day_before` | 24 h avant, si `reminders.dayBefore`. |
| `reminder_soon` | `soonHours` h avant (2 par défaut), si `reminders.soon`. |

« Terminé » et « absent » ne disent rien de nouveau au client. Les mises à jour en masse (`Model.update` sans `individualHooks`) ne préviennent personne.

**Les rappels** : chaque minute, un seul serveur cherche les rendez-vous à venir pas encore rappelés. Chaque rappel part une fois, marqué en base avant l'envoi. Un rendez-vous pris après le moment du rappel ne le reçoit pas (pris une heure avant, il n'a ni le rappel de la veille ni celui de 2 h). Déplacé, il redevient un nouveau rendez-vous : ses rappels repartent.

À l'activation sur une base existante, seuls les rendez-vous des prochaines 24 h sont concernés, et seulement ceux pris avant le moment de leur rappel.

**Le récapitulatif** : une fois par jour, à `overdue.hour` heure locale, les membres du staff qui peuvent modifier les rendez-vous reçoivent une notification du back-office avec le nombre de rendez-vous passés encore « Scheduled », à marquer **Completed** ou **No Show**.

---

## 5. Envoyer les rendez-vous ailleurs (`sync`)

Sans `sync`, rien ne sort. Avec, le leaf appelle `send` après chaque création et chaque modification d'un rendez-vous, une fois la transaction validée. Le marquage des rappels ne déclenche pas d'envoi.

```ts
sync: {
    label: 'Salesforce',
    send: async (appointment, { externalId, changes }) => {
        // externalId : l'id rendu par le dernier envoi réussi, null la première fois
        const id = await ecrireChezEux(appointment, externalId)
        return { externalId: id }
    },
    link: (externalId) => `https://exemple.my.salesforce.com/${externalId}`,
},
```

`send` est du code du projet : le leaf ne connaît aucun CRM et ne crée rien chez personne. Les essais, l'erreur, le bouton **Resend** et la pause sont décrits dans `components/sync/README.md`.

---

## 6. Les routes

### Back-office (fournie)

`GET /admin/booking/slots` : les créneaux jour par jour jusqu'à l'horizon du scheduler, pour le sélecteur du back-office, avec les employés, le quota du client et la raison quand rien n'est réservable. Réservée au staff qui peut créer ou modifier un rendez-vous. Paramètres : le subject (`property_id`, ou le nom de sa colonne), `scheduler_id`, `user_id`, `exclude_appointment_id` (le rendez-vous qu'on déplace).

### App (dans le projet)

Le projet écrit les routes de l'app, avec ses URL et sa forme de réponse, et appelle les services :

| Service | Rôle |
|---|---|
| `resolveSchedulers(scope, { forMobile })` | Les schedulers ouverts pour ce scope. |
| `resolveSchedulerById(scope, id)` | Un scheduler, s'il est ouvert pour ce scope. |
| `getSlots(scheduler, { from, to, excludeAppointmentId })` | Les créneaux libres. |
| `availableHostsAt(scheduler, start)` puis `pickHost(ids, start)` | Les employés libres à cette heure, et le moins chargé. |
| `customerQuota(scheduler, userId, subjectId)` | Ce que le client peut encore réserver. |
| `createAppointmentInSeat(payload)` | Crée le rendez-vous dans une place libre ; `null` si tout est pris entre-temps. |
| `visitPeriodIssue(scheduler, start)` | Le scheduler accepte-t-il cette date. |
| `localDayRange(day, tz)` | Les bornes d'un jour local. |

Pour annuler ou déplacer, la route fait un `update` de l'instance : les messages et les rappels suivent.

---

## 7. Le back-office

Déclaré par le leaf, dans le groupe `admin.group` (`Scheduling`) :

- **Bookings** (`booking-appointments`) : liste, fiche, création avec le sélecteur de créneaux, modification et action **Cancel Appointment**. La suppression est refusée : on annule.
- **Schedulers** : règles, plages horaires (**Opening Hours**) et fermetures (**Closures & Holidays**) dans la même fiche. Une plage sans employé est refusée.
- **Agents** : capacité, congés, rendez-vous.
- **Calendar** : les rendez-vous et les fermetures sur une période (70 jours au plus), filtrables par scheduler et par employé.

Les droits sont ceux du back-office, collection par collection ; la page Calendar a son propre droit (`appointments-calendar`).

Le projet complète une collection avec `admin.extend` :

```ts
admin: {
    extend: (name, collection) => {
        if (name !== 'schedulers') return collection
        return { ...collection, actions: [...(collection.actions ?? []), 'booking:scheduler-import-projects'] }
    },
},
```

Une collection déjà déclarée par le projet sous le même nom n'est pas remplacée.

Un projet qui avait déjà ses collections garde leurs noms (les droits des rôles sont rangés par nom) avec `admin.collections` : `{ appointments: 'appointments' }`. Les clés : `schedulers`, `windows`, `blocks`, `agents`, `appointments`. Le nom des rendez-vous est aussi celui de leur cible de `sync`, et la page Calendar ouvre un rendez-vous dans cette collection.

`admin.visitType(scheduler)` remplace le `kind` affiché par le sélecteur à côté du nom du scheduler (« Handover in Salesforce »).

---

## 8. Projets

- **EmiratesOne** : mode « ++ ». Fuseau `Asia/Dubai`, week-end samedi-dimanche, scope `Project`, subject `Unit`. Pas de `sync` : rien n'est envoyé à Salesforce.
- **Retal** : mode relais (`Appointment__c` et Apex), n'utilise pas ce leaf.
