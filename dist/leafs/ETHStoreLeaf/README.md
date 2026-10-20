# ETHStoreLeaf

L'app sur l'App Store et Google Play, lue dans le back-office (page **Stores**). **Tous les chiffres viennent des rapports des stores**, lus avec les clés de chaque store. Il y a une seule exception : la note publique d'Apple. L'API d'Apple ne la donne pas, alors le leaf la lit sur la page publique, avec le seul identifiant de l'app.

| | App Store | Google Play |
| --- | --- | --- |
| Téléchargements, re-téléchargements, mises à jour, par pays | Rapports de ventes | Fichiers `installs` du bucket |
| Désinstallations | Rapports analytics ¹ | Fichiers `installs` |
| Appareils actifs | — | Fichiers `installs` |
| Impressions | Rapports analytics | — |
| Vues de la fiche, téléchargements depuis la fiche | Rapports analytics | Fichiers `store_performance` |
| D'où viennent les téléchargements | Rapports analytics | Fichiers `store_performance` |
| Sessions, durée, appareils par jour | Rapports analytics ¹ | — |
| Crashs | Rapports analytics ¹ | Fichiers `crashes` |
| Gels (ANR) | — | Fichiers `crashes` |
| Note | Page publique | Fichiers `ratings` (moyenne de toutes les notes) |
| Avis écrits et réponses | API des avis | Fichiers `reviews` |
| Nom, version | API App Store Connect | Play Developer Reporting API ² |

¹ Seulement les personnes qui partagent leurs données avec les développeurs. Ces chiffres sont donc plus bas que les vrais, et la page le dit.
² Facultatif : sans cette API, la page affiche le reste, sans nom ni version.

Le serveur lit les stores toutes les `syncEveryHours` heures (6 par défaut). À chaque lecture, il relit les 7 derniers jours, parce qu'un store publie un jour en retard ou le corrige. La première fois, il remonte `backfillDays` jours en arrière (90 par défaut).

Le leaf ne fonctionne qu'avec Postgres. Il crée trois tables par le `sync` du projet : `store_daily_stats`, `store_reviews` et `store_statuses`.

> Si le `sync` du projet n'est pas en mode `alter`, les colonnes ajoutées après la création d'une table ne sont pas créées. Sur une base où le leaf a déjà tourné, il faut supprimer `store_daily_stats` et `store_statuses` (la prochaine lecture les remplit à nouveau).

Sans `apple` ni `google`, le leaf ne fait rien. Monter le hash du framework sur un projet ne change donc rien tant que ce projet ne le liste pas.

---

## 1. Brancher le leaf

### Config.ts

```ts
import ETHStoreLeaf from 'etherial/leafs/ETHStoreLeaf/app'
import { storesConfig } from './stores'

export default {
    // ... après eth_admin_leaf ...
    eth_store_leaf: {
        module: ETHStoreLeaf,
        config: storesConfig(),
    },
}
```

Le leaf se déclare au back-office dans `afterRun`. Il doit donc être listé **après** `eth_admin_leaf`. Ajouter `'stores'` à un groupe de `navigation` pour le placer dans le menu (par exemple `Insights`).

### src/stores.ts

```ts
import type { ETHStoreLeafConfig } from 'etherial/leafs/ETHStoreLeaf/app'

// Une fonction, pas une constante : les variables sont lues une fois `.env` chargé.
export function storesConfig(): ETHStoreLeafConfig {
    return {
        timezone: 'Asia/Riyadh',
        apple: {
            bundleId: 'sa.com.retal.app',
            appId: '6477343500',              // facultatif : retrouvé par le bundleId sinon
            countries: ['sa'],                // les vitrines dont la note publique compte
            issuerId: process.env.APPLE_STORE_ISSUER_ID,
            keyId: process.env.APPLE_STORE_KEY_ID,
            privateKey: process.env.APPLE_STORE_PRIVATE_KEY,
            vendorNumber: process.env.APPLE_STORE_VENDOR_NUMBER,
        },
        google: {
            packageName: 'sa.com.retal.app',
            bucket: process.env.GOOGLE_PLAY_BUCKET,
            serviceAccount: process.env.GOOGLE_PLAY_SERVICE_ACCOUNT,
        },
    }
}
```

**Les clés ne viennent que de l'environnement.** Elles ne doivent jamais apparaître dans le code ni dans un commit. Le back-office ne les reçoit jamais : il voit seulement le nom des clés qui manquent.

---

## 2. Les options

| Option | Défaut | Rôle |
| --- | --- | --- |
| `timezone` | `UTC` | Où se coupent les jours des rapports et de la note. |
| `syncEveryHours` | `6` | Un store est relu au plus tôt après ce délai. |
| `backfillDays` | `90` | Jusqu'où remonter la première fois (730 au plus ; Apple ne garde ses ventes qu'un an). L'augmenter plus tard relit seulement les jours manquants. |
| `apple` | — | Voir ci-dessous. Sans clés, seulement la note publique. |
| `google` | — | Voir ci-dessous. Sans clés, rien. |

### App Store (`apple`)

| Clé | Où la trouver |
| --- | --- |
| `bundleId` | L'identifiant de l'app (`com.exemple.app`). Suffit pour la note publique. |
| `appId` | Facultatif : l'« Apple ID » numérique de la fiche App Store Connect. |
| `issuerId`, `keyId`, `privateKey` | App Store Connect › Users and Access › Integrations › App Store Connect API › **Team Keys**. Créer une clé avec le rôle **Admin**. La page donne l'Issuer ID et le Key ID. Le fichier `.p8` ne se télécharge **qu'une fois**. |
| `vendorNumber` | App Store Connect › Payments and Financial Reports, en haut à gauche. |
| `countries` | Les vitrines dont la note publique compte (`['sa']`). La note affichée est la moyenne pondérée par le nombre de notes. |

**Pourquoi Admin.** Une clé Sales lit les ventes, mais seule une clé Admin peut demander à Apple ses rapports analytics : vues de la fiche, sources, sessions, suppressions, crashs.

`privateKey` accepte le contenu du `.p8` avec de vrais retours à la ligne, avec des `\n` (pratique dans un `.env`), ou seulement le corps en base64.

**Les ventes.** Apple publie le rapport d'un jour le lendemain, vers 8 h heure du Pacifique. Les catégories lues sont :

- les types 1, 1F, 1T et F1 : premiers téléchargements ;
- les types 3, 3F, 3T et F3 : re-téléchargements ;
- les types 7, 7F, 7T et F7 : mises à jour.

Les achats intégrés ne sont pas comptés.

**Les rapports analytics.** À la première lecture, le leaf demande deux choses à Apple :

- les rapports quotidiens (`ONGOING`) ;
- l'historique (`ONE_TIME_SNAPSHOT`).

Apple met **un à deux jours** à préparer les premiers. En attendant, la carte du store l'indique (en bleu, ce n'est pas une erreur). Ensuite, chaque jour arrive avec deux ou trois jours de retard.

Le leaf lit les rapports *Standard* : *App Store Discovery and Engagement*, *App Store Downloads*, *App Store Installation and Deletion*, *App Sessions* et *App Crashes*. Il ne lit pas les *Detailed*, qui écartent les petits chiffres. Si Apple ne publie plus les rapports quotidiens parce que personne ne les lit, le leaf les redemande.

**Les avis.** Ils sont lus par l'API, avec leur réponse. Chaque lecture relit les 14 derniers jours d'avis, pour prendre les modifications et les réponses récentes.

### Google Play (`google`)

| Clé | Où la trouver |
| --- | --- |
| `packageName` | L'identifiant de l'app. |
| `serviceAccount` | Un compte de service Google Cloud (fichier JSON de clé), en JSON ou en base64. |
| `bucket` | Play Console › Download reports › Statistics › « Copy Cloud Storage URI » (`gs://pubsite_prod_rev_…`). Le chemin après le nom est ignoré. |

Le compte de service doit être invité dans Play Console › Users and permissions, avec la permission **View app information and download bulk reports**. Il faut parfois attendre jusqu'à 24 h avant que le bucket l'accepte.

Pour le nom et la version de l'app, il faut activer la **Google Play Developer Reporting API** dans le projet Google Cloud du compte de service. C'est facultatif.

Google publie ses fichiers mensuels avec un à deux jours de retard. Ce qu'on en lit :

| Fichier | Chiffre | Colonne |
| --- | --- | --- |
| `stats/installs/…_overview.csv`, `…_country.csv` | Téléchargements | Daily User Installs |
| | Re-téléchargements | Install events, moins les premiers téléchargements |
| | Mises à jour | Update events, ou à défaut Daily Device Upgrades |
| | Désinstallations | Daily User Uninstalls |
| | Appareils actifs | Active Device Installs |
| `stats/ratings/…_overview.csv` | Note | Total Average Rating |
| `stats/crashes/…_overview.csv` | Crashs, gels | Daily Crashes, Daily ANRs |
| `stats/store_performance/…_country.csv` | Visiteurs, téléchargements depuis la fiche | Store listing visitors, Store listing acquisitions |
| `stats/store_performance/…_traffic_source.csv` | D'où viennent les téléchargements | Traffic source |
| `reviews/reviews_…_<YYYYMM>.csv` | Avis écrits et réponses | — |

Une note sans texte n'est pas un avis : elle compte seulement dans la note.

---

## 3. Le back-office

La page **Stores** montre :

- **une carte par store** : icône, nom, version, note et sa variation, avis et part des avis qui ont une réponse, heure de la dernière lecture, date du dernier rapport ;
  - s'il y a eu une erreur, son message ;
  - si Apple prépare encore ses rapports, un message en bleu ;
  - sinon, les clés qui manquent ;
- **les totaux** de la période (téléchargements, re-téléchargements, mises à jour, désinstallations, appareils actifs), comparés à la période d'avant ;
- **un graphique** jour par jour (semaine par semaine au-delà de trois mois), empilé par store, pour chaque chiffre ;
- **la fiche du store** : impressions, vues, téléchargements depuis la fiche, et la conversion ;
- **les sources** des premiers téléchargements ;
- **l'usage** : sessions, durée moyenne, appareils par jour, crashs, gels ;
- **les pays** et **la note dans le temps** ;
- **les avis** : filtres par store, par étoiles et par réponse, répartition des étoiles, réponse sous chaque avis.

« Sync now » lit les stores tout de suite. La page se rafraîchit tant que la lecture continue.

L'accès suit la permission `list` de la collection cachée `store-stats`. Cette collection donne aussi les lignes brutes, pour un export (icône tableau en haut de la page).

### Les routes d'admin

| Route | Rôle |
| --- | --- |
| `GET /admin/stores/overview?from=&to=` | Ce que lit la page (30 derniers jours par défaut, deux ans au plus). |
| `GET /admin/stores/reviews?from=&to=&store=&stars=&replied=yes\|no&page=` | Les avis écrits, du plus récent au plus ancien, 20 par page. `stars` vaut un nombre de 1 à 5. |
| `POST /admin/stores/sync { store? }` | Lit les stores. Répond `done`, `running` (encore en cours après 20 s, la lecture continue) ou `busy` (une autre lecture tourne déjà). |

### Les commandes

- `sync` lit les stores tout de suite.
- `purge` vide les trois tables. À réserver aux bases de test.

Le code du projet peut aussi appeler `etherial.eth_store_leaf.sync()`.

---

## 4. Maintenance

- **Plusieurs serveurs.** Une seule lecture tourne à la fois, grâce au verrou `eth_store.sync`. Une lecture interrompue par un arrêt est considérée comme morte au bout de 30 minutes.
- **Clé révoquée ou permissions retirées.** L'erreur s'affiche sur la carte du store. La lecture suivante réessaie.
- **Clé Apple qui n'est pas Admin.** Les ventes et les avis passent, mais Apple refuse la demande des rapports analytics : l'erreur le dit sur la carte.
- **À vérifier avec les premières vraies clés.** Le code suit la documentation des stores, mais quatre points restent à confirmer sur des données réelles :
  - les noms exacts des rapports analytics d'Apple ;
  - la présence des fichiers `_overview` des notes et des crashs côté Google ;
  - les libellés des sources de trafic ;
  - le format de l'identifiant d'avis dans le lien Play Console.

---

## 5. Retal

`src/stores.ts` lit les variables d'environnement suivantes :

- `APPLE_STORE_ISSUER_ID`, `APPLE_STORE_KEY_ID`, `APPLE_STORE_PRIVATE_KEY` (clé **Admin**), `APPLE_STORE_VENDOR_NUMBER` ;
- `GOOGLE_PLAY_BUCKET`, `GOOGLE_PLAY_SERVICE_ACCOUNT`.

Tant qu'elles manquent, la page montre seulement la note publique d'Apple.
