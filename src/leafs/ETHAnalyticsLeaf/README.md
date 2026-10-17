# ETHAnalyticsLeaf

Ce que les utilisateurs font dans l'app, et où ils vont. Les données sont lues par le back-office : page **Analytics**, panneau **App activity** sur la fiche d'un utilisateur, et carte **The app** sur le dashboard.

Le leaf a deux entrées, toutes deux désactivées par défaut :

| Entrée | Ce qu'elle apporte | Mise à jour de l'app ? |
|---|---|---|
| `track` | Chaque appel API d'un utilisateur connecté devient un événement `api`. On obtient les utilisateurs actifs, les visites, ce qu'ils font et la rétention. | Non |
| `ingest` | L'app envoie ses écrans, le temps passé sur chacun et les actions clés à `POST /analytics/events`. On obtient en plus les parcours, le temps par écran et les invités. | Oui |

Les événements sont regroupés en **visites** : 30 minutes de silence terminent une visite. Le leaf ne fonctionne qu'avec Postgres. Il crée deux tables, `analytics_events` et `analytics_sessions`, par le `sync` du projet, sans migration à écrire.

Sans `track` ni `ingest`, le leaf ne fait que posséder ses deux tables et répondre au back-office. Monter le hash du framework sur un projet ne change donc rien tant que ce projet ne l'active pas.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHAnalyticsLeaf from 'etherial/leafs/ETHAnalyticsLeaf/app'
import { analyticsConfig } from './analytics'

export default {
    // ... après eth_admin_leaf ...
    eth_analytics_leaf: {
        module: ETHAnalyticsLeaf,
        config: analyticsConfig,
    },
}
```

### src/analytics.ts

```ts
import type { ETHAnalyticsLeafConfig } from 'etherial/leafs/ETHAnalyticsLeaf/app'

export const analyticsConfig: ETHAnalyticsLeafConfig = {
    ingest: true,
    track: {
        guests: true,                                   // compte aussi les appels sans token (header x-installation-id)
        exclude: ['/healthcheck', '/externals/*'],
    },
    timezone: 'Asia/Riyadh',                            // où se coupent les jours
    excludeUser: (user) => user?.role !== UserRole.USER, // le staff qui teste l'app ne compte pas

    // Un appel API dit qui, pas sur quel téléphone : on prend le dernier appareil connu.
    identify: async (user) => {
        const device = await Device.findOne({ where: { user_id: user.id }, order: [['updated_at', 'DESC']] })
        return device && { installation_id: device.device, platform: device.platform, app_version: device.app_version }
    },

    labels: {
        screens: { HomeScreen: 'Home', AppointmentsNew: 'Book an appointment' },
        actions: { app_open: 'Opened the app', ticket_created: 'Raised a request' },
        api: { 'GET /users/me': 'Opened the app', 'POST /v2/appointments': 'Booked an appointment' },
    },

    funnels: [
        { name: 'Book an appointment', steps: ['screen:Appointments', 'screen:AppointmentsNew', 'action:appointment_booked'] },
    ],
}
```

Le leaf s'enregistre tout seul auprès d'`eth_admin_leaf` :
- il ajoute deux collections cachées du menu, `analytics-events` et `analytics-sessions` ;
- il déclare la feature `analytics` dans `/admin/schema`.

Le back-office affiche alors l'entrée **Analytics** dans le menu.

---

## 2. Options

| Option | Défaut | Rôle |
|---|---|---|
| `ingest` | off | `true` ou `{ maxBatch }` (100 par défaut, 500 au plus). Ouvre `POST /analytics/events`. |
| `track` | off | `true` ou `{ include, exclude, methods, guests }`. Compte les appels API. Le préfixe admin et la route d'ingestion ne sont jamais comptés. Une route publique appelée avec un token compte pour l'utilisateur du token. |
| `sessionTimeoutMinutes` | 30 | Durée de silence qui termine une visite. |
| `retentionDays` | 395 | Nombre de jours d'événements gardés (13 mois). `0` garde tout. |
| `timezone` | `UTC` | Fuseau qui découpe les jours, les semaines et la carte « heure × jour ». |
| `identify(user, req)` | — | Complète un appel API qui ne dit pas tout : appareil, plateforme, version. Le résultat est mis en cache. |
| `excludeUser(user)` | — | `true` sort la personne des chiffres. Sert typiquement pour le staff. |
| `users` | `users` / `User` | Collection et modèle des utilisateurs, et champs utilisés pour les nommer (`name`, `fallback`). |
| `labels` | — | Noms lisibles des écrans, des actions et des routes. Sans label, le back-office « humanise » le nom brut : `HomeNFAnnoucementScreen` devient « Home NF annoucement ». |
| `funnels` | — | Entonnoirs proposés tout faits dans le back-office. Chaque étape s'écrit `type:name`. |

---

## 3. Ce que l'app envoie

### `POST /analytics/events`

Avec ou sans `Authorization: Bearer <token>`. Un token valide nomme l'utilisateur ; sans token, c'est un invité.

```json
{
  "installation_id": "uuid stable par installation",
  "platform": "ios",
  "app_version": "1.2.9",
  "os_version": "17.5",
  "device_model": "iPhone 13",
  "locale": "en",
  "events": [
    { "type": "app",    "name": "app_open", "at": 1792046812311 },
    { "type": "screen", "name": "HomeScreen", "at": 1792046812400, "duration_ms": 80000 },
    { "type": "action", "name": "ticket_created", "screen": "RaiseANewTicket", "properties": { "category": "plumbing" }, "at": 1792046899000 }
  ]
}
```

- **`screen`** : envoyé **quand on quitte l'écran**. `at` est l'heure d'ouverture et `duration_ms` le temps passé dessus. Un écran arrivé en retard ne remplace pas un écran plus récent comme « dernier écran » de la visite.
- **`action`** : un moment clé, rattaché à l'écran affiché.
- **`app`** : `app_open` et `app_background`.
- Les `name` acceptent lettres, chiffres et `_ . : - / ( ) &`, sur 128 caractères au plus.
- Pour `properties` :
  - 20 clés au plus, 2 Ko au total ;
  - seuls les textes, nombres, booléens et `null` sont gardés ;
  - toute clé qui ressemble à un secret (`pass`, `token`, `otp`, `code`, `pin`, `card`, `iban`…) est jetée.
- Pour `at` : une date plus vieille que 2 jours, ou en avance de plus de 5 minutes, est remplacée par l'heure de réception.
- La réponse est toujours `202 { accepted }`, même si une partie du lot est refusée. Un téléphone ne renvoie donc jamais un lot à cause d'un seul événement invalide.
- Une même adresse est ralentie au-delà de 120 lots par minute (`429`). L'app garde alors ses événements et les renvoie plus tard.

### Headers sur les appels API (pour `track`)

Facultatifs, mais ils rattachent chaque appel au bon téléphone, invités compris :

```
x-installation-id   x-app-platform   x-app-version   x-os-version   x-device-model   x-app-locale
```

### Implémentation de référence (React Native / Expo)

Voir `retal-rn-expo/src/Services/analytics.ts`. Elle n'ajoute aucune dépendance native, seulement des modules Expo déjà présents :

- une file d'attente envoyée toutes les 10 s, dès 50 événements et au passage en arrière-plan. Hors ligne, les événements sont gardés (500 au plus) et renvoyés plus tard ;
- `analytics.screen(route)` est appelé dans `onReady` et `onStateChange` du `NavigationContainer` ;
- les actions viennent d'un middleware Redux sur les mutations RTK Query qui réussissent (`createTicket` → `ticket_created`, `createAppointmentV2` → `appointment_booked`…). Un seul endroit suffit pour tous les écrans ;
- `deviceHeaders()` est ajouté dans le `prepareHeaders` de l'API ;
- l'`installation_id` est le même identifiant que celui de l'enregistrement push. Une visite et une ligne de `Devices` correspondent donc.

---

## 4. Dans le back-office

| Où | Ce qu'on y voit |
|---|---|
| **Analytics › Overview** | Utilisateurs actifs (jour, 7 j, 30 j, stickiness), visites, temps par visite, nouveaux utilisateurs avec l'écart sur la période d'avant, courbe jour par jour, carte heure × jour, plateformes, versions, langues, écrans et actions les plus fréquents. |
| **Screens & actions** | Le tableau complet, avec le nombre de personnes, le temps passé, les erreurs des appels API et une tendance. |
| **Journeys** | Pour un écran : d'où l'on vient et où l'on va ensuite. Cliquer sur un voisin permet de suivre le chemin. |
| **Funnels** | Les entonnoirs de la config, ou un entonnoir composé à la volée. Le taux de passage est calculé étape par étape, dans l'ordre et au sein d'une même visite. |
| **Retention** | Les cohortes par semaine de première visite. |
| **In the app now** | Qui est dans l'app en ce moment (5 dernières minutes), sur quel écran, et le détail de sa visite. |
| **Fiche utilisateur › App activity** | Dernière visite, nombre de visites, temps passé, téléphone, 13 semaines de jours actifs, ses écrans et actions favoris, et chacune de ses visites étape par étape. |
| **Dashboard** | La carte « The app » sur 30 jours, avec le lien vers Analytics. |

**Droits** : donner le droit de lecture sur `Analytics events` à un rôle lui ouvre toute la page Analytics. La matrice des rôles le précise sur la ligne concernée.

Toutes les routes se trouvent sous `/admin/insights/*`, pas `/admin/analytics/*` : les bloqueurs de pub (liste EasyPrivacy) bloquent toute URL contenant `/analytics/event`.

| Route | Rôle |
|---|---|
| `overview` | Chiffres de la page Overview |
| `live` | Personnes dans l'app en ce moment |
| `events` | Tableau « Screens & actions » |
| `flows` | Parcours autour d'un écran |
| `funnel` | Entonnoirs |
| `retention` | Cohortes |
| `users/:id` | Activité d'un utilisateur (`?before=` pour les visites plus anciennes) |
| `sessions/:id` | Détail d'une visite |

---

## 5. Vie privée

- Seuls les noms d'écrans, d'actions et de routes sont stockés : jamais les corps de requête, et les routes sont gardées sous forme de patron (`/users/me/documents/:document_id`).
- Les `properties` qui ressemblent à des secrets sont jetées à l'entrée. Ne mettez jamais de donnée personnelle dans `properties`.
- Les événements de plus de `retentionDays` jours sont supprimés chaque jour.
- `excludeUser` permet de sortir le staff, ou toute personne qui le demande.
