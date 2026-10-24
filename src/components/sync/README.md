# components/sync

Envoyer nos enregistrements vers un système extérieur (un ticket vers Salesforce, un rendez-vous vers le CRM du client) quand **nous sommes maîtres** et que l'autre côté n'en reçoit qu'une copie.

La brique ne connaît aucun CRM et ne crée rien chez personne. Le projet écrit l'envoi : quoi créer ou mettre à jour là-bas, avec son propre client (jsforce…). La brique décide **quand** : après chaque création et chaque modification validées, avec des essais, un verrou et le suivi dans le back-office.

Rien n'est déclaré, rien n'est créé : ni table, ni minuterie, ni écran.

---

## 1. Par un leaf (le cas courant)

ETHBookingLeaf, ETHSurveyLeaf et ETHCaseLeaf ont une option `sync` :

```ts
sync: {
    label: 'Salesforce',
    send: async (record, { externalId, changes, attempt, remember }) => {
        const id = await ecrireChezEux(record, externalId)
        return { externalId: id }
    },
    link: (externalId) => `https://exemple.my.salesforce.com/${externalId}`,
},
```

- `record` : l'enregistrement relu en base, dans son dernier état.
- `externalId` : l'id rendu par le dernier envoi réussi ; `null` la première fois, donc **créer**, sinon **mettre à jour**.
- `changes` : les champs modifiés depuis le dernier envoi réussi (vide pour un premier envoi ou un **Resend**). L'état entier est toujours disponible.
- `attempt` : le numéro de l'essai.
- `remember(id)` : enregistre l'id de la copie tout de suite, avant la fin de `send`. Utile quand l'envoi crée la copie puis échoue plus loin : l'essai suivant mettra à jour au lieu de créer un doublon.
- `send` lève une erreur en cas d'échec. Il peut enregistrer l'enregistrement (l'id de la copie dans une colonne à lui) : cette écriture n'est pas renvoyée.

Le leaf choisit les écritures envoyées. Sans `sync`, il n'envoie rien.

## 2. Directement, depuis le code d'un projet

```ts
import { registerSync, startSync, registerSyncAdmin } from 'etherial/components/sync/index'

// beforeRun : avant que la base ne synchronise ses tables
registerSync('invoices', { model: 'Invoice', label: 'ERP', send, link })
// run
startSync()
// afterRun : les écrans du back-office
registerSyncAdmin()
```

`track` choisit les écritures envoyées : `{ fields }` (seulement ces champs), `{ ignore }` (pas ces champs seuls ; les dates de création et de mise à jour ne le sont jamais), `{ when }` (seulement les enregistrements acceptés, relus après le commit), ou `false` (seul le code envoie, par `enqueueSync(target, id, changes)`).

Une écriture avec `{ sync: false }` n'est pas envoyée, ni ce qui tourne dans `withoutSync(() => …)`, ni les mises à jour en masse (elles n'appellent pas les hooks).

---

## 3. Ce qui se passe

1. L'enregistrement est écrit. Après le commit, sa place dans la file (`external_syncs`) est créée ou mise à jour, et l'envoi est tenté tout de suite.
2. **Un seul envoi à la fois** par enregistrement, même avec plusieurs serveurs. Une modification qui arrive pendant un envoi est envoyée juste après, avec ses champs.
3. **Seul le dernier état part** : dix modifications rapprochées donnent un ou deux envois, pas dix.
4. **En cas d'échec**, l'erreur est gardée et l'envoi retenté à 1 min, 5 min, 30 min, 2 h puis 6 h. Ensuite l'enregistrement est **bloqué** : seule une nouvelle modification ou un **Resend** relance. Le staff qui a le droit d'agir sur les envois reçoit une notification du back-office.
5. Un serveur qui s'arrête pendant un envoi (un déploiement) le laisse repris par un autre après 5 minutes.
6. Un enregistrement supprimé chez nous est bloqué avec « The record no longer exists here » : la brique ne supprime rien là-bas.

## 4. Le back-office

Dans le groupe **System**, dès qu'une cible est déclarée :

- **Outgoing syncs** : chaque enregistrement envoyé, son état (Waiting, Sending, Sent, Retrying, Blocked), sa dernière erreur, les champs en attente, le prochain essai, le lien vers la copie et le bouton **Resend**.
- **Sync targets** : une ligne par cible avec son interrupteur **Paused**. En pause, les modifications s'accumulent et rien ne part ; à la reprise, la file repart d'elle-même.

## 5. Les tables

`external_syncs` (une ligne par enregistrement et par cible, gardée après succès pour l'id de la copie) et `external_sync_targets` (les pauses). Elles sont créées par le `sync` du projet, à la première cible déclarée.
