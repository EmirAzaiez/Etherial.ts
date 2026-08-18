# ETHPaymentLeaf

Leaf de paiement unifié pour Etherial. Supporte **Stripe** et **PayPal** avec une API identique.
Fonctionne pour les applications **mobile** (SDK natifs) et **web** (checkout hébergé).

---

## Table des matières

1. [Installation & Configuration](#1-installation--configuration)
2. [Créer les models](#2-créer-les-models)
3. [Setup dans app.ts](#3-setup-dans-appts)
4. [Usage Web (Checkout hébergé)](#4-usage-web-checkout-hébergé)
5. [Usage Mobile (SDK natifs)](#5-usage-mobile-sdk-natifs)
6. [Subscriptions](#6-subscriptions)
7. [Payment Methods](#7-payment-methods)
8. [Webhooks](#8-webhooks)
9. [API Reference](#9-api-reference)
10. [Providers supportés](#10-providers-supportés)
11. [Exemples réalistes — Qarmee](#11-exemples-réalistes--qarmee-location-de-voitures)

---

## 1. Installation & Configuration

### Config.ts

```typescript
import EthPaymentLeaf, { ETHPaymentLeafConfig } from './ETHPaymentLeaf/app'

// Augmentation de type pour etherial.eth_payment_leaf
declare module 'etherial' {
    interface Etherial {
        eth_payment_leaf: EthPaymentLeaf
    }
}

export default {
    // ... autres modules ...

    eth_payment_leaf: {
        module: EthPaymentLeaf,
        config: {
            // Provider par défaut utilisé quand aucun n'est spécifié
            default_provider: 'stripe',

            providers: {
                // ✅ Stripe — activé
                stripe: {
                    enabled: true,
                    config: {
                        secret_key: process.env.STRIPE_SECRET_KEY,
                        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,  // requis pour mobile
                        api_version: '2024-12-18.acacia',                     // optionnel
                    },
                    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
                },

                // ✅ PayPal — activé
                paypal: {
                    enabled: true,
                    config: {
                        client_id: process.env.PAYPAL_CLIENT_ID,
                        client_secret: process.env.PAYPAL_CLIENT_SECRET,
                        mode: 'sandbox',  // 'sandbox' | 'live'
                        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
                    },
                    webhook_secret: process.env.PAYPAL_WEBHOOK_ID,
                },

                // ❌ Provider configuré mais désactivé — ne sera pas initialisé
                // apple_pay: {
                //     enabled: false,
                //     config: { ... },
                // },
            },

            // Routes à activer — listez seulement celles dont vous avez besoin
            routes: {
                payments: [
                    // Web
                    'createCheckout',
                    'getPayment',
                    'createSubscription',
                    'getSubscription',
                    'cancelSubscription',
                    'resumeSubscription',
                    'refundPayment',
                    'setupPaymentMethod',
                    'listPaymentMethods',
                    'deletePaymentMethod',
                    'webhook',
                    // Mobile
                    'initMobilePayment',
                    'initMobileSubscription',
                    'confirmMobilePayment',
                ],
            },
        } satisfies ETHPaymentLeafConfig,
    },
}
```

### .env

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
```

> **Note:** Un provider avec `enabled: false` ne sera pas initialisé au démarrage.
> Vous pouvez configurer des providers sans les activer — pratique pour préparer
> un basculement sans downtime.

---

## 2. Créer les models

Les models sont des **base classes** à étendre dans votre projet. Cela vous permet
d'ajouter des relations avec votre `User`, des champs custom, des hooks Sequelize, etc.

### src/models/Payment.ts

```typescript
import { Table, Column, ForeignKey, BelongsTo, AllowNull, Index } from 'etherial/components/database/provider'
import { BasePayment } from '../ETHPaymentLeaf/models/Payment'
import { User } from './User'

@Table({ timestamps: true, tableName: 'payments', freezeTableName: true })
export class Payment extends BasePayment {
    @ForeignKey(() => User)
    @AllowNull(true)
    @Index
    @Column
    declare user_id: number

    @BelongsTo(() => User, 'user_id')
    user: User

    // Ajoutez vos champs custom ici
    // @Column
    // order_id: number
}
```

### src/models/Subscription.ts

```typescript
import { Table, Column, ForeignKey, BelongsTo, AllowNull, Index } from 'etherial/components/database/provider'
import { BaseSubscription } from '../ETHPaymentLeaf/models/Subscription'
import { User } from './User'

@Table({ timestamps: true, tableName: 'subscriptions', freezeTableName: true })
export class Subscription extends BaseSubscription {
    @ForeignKey(() => User)
    @AllowNull(true)
    @Index
    @Column
    declare user_id: number

    @BelongsTo(() => User, 'user_id')
    user: User
}
```

### src/models/PaymentCustomer.ts

```typescript
import { Table, Column, ForeignKey, BelongsTo, AllowNull, Index } from 'etherial/components/database/provider'
import { BasePaymentCustomer } from '../ETHPaymentLeaf/models/Customer'
import { User } from './User'

@Table({
    timestamps: true,
    tableName: 'payment_customers',
    freezeTableName: true,
    indexes: [{ unique: true, fields: ['user_id', 'provider'], name: 'unique_user_provider' }],
})
export class PaymentCustomer extends BasePaymentCustomer {
    @ForeignKey(() => User)
    declare user_id: number

    @BelongsTo(() => User, 'user_id')
    user: User
}
```

> Le leaf retrouve automatiquement vos models concrets via `sequelize.models` au runtime.
> Tant que vos classes s'appellent `Payment`, `Subscription`, et `PaymentCustomer`,
> tout fonctionne automatiquement.

---

## 3. Setup dans app.ts

Les callbacks webhook se configurent dans `app.ts`, exactement comme
`setCustomAuthentificationChecker` — pas dans la config.

```typescript
// src/app.ts
import etherial, { Etherial } from 'etherial'

export default class App {
    etherial_module_name = 'app'

    beforeRun({ http }: Etherial) {
        http.app.use(cors())
        http.app.use(methodOverride())
        http.app.use(bodyParser.json({
            verify: (req: any, _res, buf) => {
                req.rawBody = buf  // Requis pour la vérification Stripe
            },
        }))
    }

    run({ http, database, reactive }: Etherial) {
        // Auth checker
        etherial.http_security.setCustomAuthentificationChecker(({ user_id }) => {
            return User.findOne({ where: { id: user_id } })
        })

        // ==================== Payment Webhooks ====================

        // Appelé quand un paiement réussit (checkout web ou mobile)
        etherial.eth_payment_leaf.onPaymentCompleted(async (payment, localPayment) => {
            console.log(`Payment ${localPayment.id} completed: ${payment.amount.amount} ${payment.amount.currency}`)

            // Exemple : mettre à jour une commande
            // await Order.update({ status: 'paid' }, { where: { payment_id: localPayment.id } })

            // Exemple : envoyer un email de confirmation
            // const user = await User.findByPk(localPayment.user_id)
            // await EmailHelper.sendPaymentConfirmation(user.email, localPayment)
        })

        // Appelé quand une subscription change de statut
        etherial.eth_payment_leaf.onSubscriptionUpdated(async (subscription, localSubscription) => {
            console.log(`Subscription ${localSubscription.id} updated: ${subscription.status}`)

            // Exemple : activer/désactiver des features premium
            // const user = await User.findByPk(localSubscription.user_id)
            // await user.update({ is_premium: subscription.status === 'active' })
        })

        // Appelé quand un paiement échoue
        etherial.eth_payment_leaf.onPaymentFailed(async (payment, localPayment) => {
            console.log(`Payment failed: ${payment.id}`)
            // Notifier l'utilisateur, relancer le paiement, etc.
        })

        // Appelé quand un remboursement est créé
        etherial.eth_payment_leaf.onRefundCreated(async (refund, localPayment) => {
            console.log(`Refund ${refund.id} for payment ${localPayment?.id}`)
        })

        // ... reste du setup ...
    }
}
```

---

## 4. Usage Web (Checkout hébergé)

Le flow web utilise les pages de paiement hébergées par le provider (Stripe Checkout, PayPal Orders).
L'utilisateur est redirigé vers le provider, paie, puis revient sur votre site.

### Flow

```
Client (navigateur)                    API                         Provider
       |                                |                              |
       |-- POST /payments/checkout ---->|                              |
       |                                |-- createCheckout() --------->|
       |                                |<-- checkout_url -------------|
       |<-- { checkout_url } -----------|                              |
       |                                                               |
       |-- redirect vers checkout_url -------------------------------->|
       |                          (paiement sur la page du provider)   |
       |<-- redirect vers success_url --------------------------------|
       |                                                               |
       |                                |<-- webhook (payment.succeeded)|
       |                                |-- onPaymentCompleted() ----->|
```

### Exemple frontend (React)

```typescript
// Créer un checkout
const response = await fetch('/payments/checkout', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        provider: 'stripe',  // optionnel, utilise le default_provider
        line_items: [{
            name: 'Location voiture - BMW Série 3',
            description: '3 jours de location',
            quantity: 1,
            amount: 15000,      // 150.00 EUR (en centimes)
            currency: 'eur',
        }],
        success_url: 'https://monsite.com/paiement/succes?session={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://monsite.com/paiement/annule',
        metadata: { rental_id: '42' },
    }),
})

const { checkout_url } = await response.json()
window.location.href = checkout_url  // Redirection vers Stripe/PayPal
```

---

## 5. Usage Mobile (SDK natifs)

Le flow mobile utilise les SDKs natifs (Stripe SDK, PayPal SDK) côté app.
Le serveur crée un intent/order, le SDK mobile gère le paiement, puis on confirme.

### Flow Stripe Mobile

```
App Mobile                         API                          Stripe
     |                               |                             |
     |-- POST /payments/mobile/init ->|                             |
     |                               |-- PaymentIntent.create() -->|
     |                               |<-- client_secret + key -----|
     |<-- { client_secret, ... } -----|                             |
     |                                                              |
     |-- Stripe SDK (PaymentSheet) -------------------------------->|
     |<-- SDK confirms payment ------------------------------------ |
     |                                                              |
     |                               |<-- webhook (succeeded) ------|
     |                               |-- onPaymentCompleted() ----->|
```

### Flow PayPal Mobile

```
App Mobile                         API                          PayPal
     |                               |                             |
     |-- POST /payments/mobile/init ->|                             |
     |                               |-- Create Order ------------>|
     |                               |<-- order_id + client_id ----|
     |<-- { order_id, ... } ----------|                             |
     |                                                              |
     |-- PayPal SDK (approve) ------------------------------------->|
     |<-- SDK approve -------------------------------------------- |
     |                                                              |
     |-- POST /payments/mobile/confirm ->|                          |
     |                               |-- Capture Order ----------->|
     |                               |<-- COMPLETED ---------------|
     |<-- { success: true } ----------|                             |
```

### Exemple React Native (Stripe)

```typescript
import { useStripe } from '@stripe/stripe-react-native'

const { initPaymentSheet, presentPaymentSheet } = useStripe()

// 1. Initialiser le paiement côté serveur
const response = await api.post('/payments/mobile/init', {
    provider: 'stripe',
    amount: 15000,          // 150.00 EUR
    currency: 'eur',
    idempotency_key: `rental_${rentalId}_${Date.now()}`,  // optionnel, évite les doublons
    metadata: { rental_id: rentalId },
})

const { client_secret, ephemeral_key, customer_id, publishable_key } = response.data

// 2. Configurer le PaymentSheet
await initPaymentSheet({
    merchantDisplayName: 'Qarmee',
    customerId: customer_id,
    customerEphemeralKeySecret: ephemeral_key,
    paymentIntentClientSecret: client_secret,
    allowsDelayedPaymentMethods: false,
})

// 3. Afficher le sheet
const { error } = await presentPaymentSheet()
if (!error) {
    // Paiement réussi ! Le webhook confirmera côté serveur.
}
```

### Exemple React Native (PayPal)

```typescript
import { PayPalButtons } from '@paypal/react-native-checkout'

// 1. Initialiser côté serveur
const response = await api.post('/payments/mobile/init', {
    provider: 'paypal',
    amount: 15000,
    currency: 'eur',
})

const { order_id, paypal_client_id, environment } = response.data

// 2. Afficher le bouton PayPal
<PayPalButtons
    clientId={paypal_client_id}
    orderId={order_id}
    environment={environment}
    onApprove={async () => {
        // 3. IMPORTANT : capturer le paiement (obligatoire pour PayPal)
        const confirm = await api.post('/payments/mobile/confirm', {
            provider: 'paypal',
            payment_id: order_id,
        })
        if (confirm.data.success) {
            // Paiement réussi !
        }
    }}
/>
```

---

## 6. Subscriptions

### Créer une subscription (web)

```typescript
const response = await api.post('/payments/subscriptions', {
    provider: 'stripe',
    price_id: 'price_xxxxxxxx',         // ID du prix Stripe/PayPal
    plan_name: 'premium',               // Nom interne pour votre logique
    trial_days: 14,                     // Période d'essai (optionnel)
    success_url: 'https://monsite.com/premium/success',  // Stripe checkout
    cancel_url: 'https://monsite.com/premium/cancel',
    metadata: { source: 'upgrade_page' },
})

// Si checkout_url est retourné → rediriger l'utilisateur
if (response.data.checkout_url) {
    window.location.href = response.data.checkout_url
}
```

### Créer une subscription (mobile)

```typescript
const response = await api.post('/payments/mobile/subscription', {
    provider: 'stripe',
    price_id: 'price_xxxxxxxx',
    trial_days: 7,
    idempotency_key: `sub_${userId}_premium`,
})

// Utiliser le client_secret avec le Stripe SDK
```

### Consulter / Annuler / Reprendre

```typescript
// Consulter
const sub = await api.get('/payments/subscriptions/1')
// → { status, days_remaining, is_active, is_trialing, can_resume, ... }

// Annuler (à la fin de la période)
await api.delete('/payments/subscriptions/1')

// Annuler immédiatement
await api.delete('/payments/subscriptions/1?immediate=true')

// Reprendre (si annulé mais pas encore expiré)
await api.post('/payments/subscriptions/1/resume')
```

---

## 7. Payment Methods

### Sauvegarder une carte

```typescript
// 1. Créer une session de setup
const setup = await api.post('/payments/methods/setup', {
    provider: 'stripe',
    success_url: 'https://monsite.com/methodes/success',
    cancel_url: 'https://monsite.com/methodes/cancel',
})

// 2. Rediriger vers la page de setup
window.location.href = setup.data.setup_url
```

### Lister les méthodes sauvegardées

```typescript
const methods = await api.get('/payments/methods?provider=stripe')
// → [{ id, type: 'card', card: { brand: 'visa', last4: '4242', ... }, is_default }]
```

### Supprimer une méthode

```typescript
await api.delete('/payments/methods/pm_xxxxx?provider=stripe')
```

---

## 8. Webhooks

### Configuration côté provider

**Stripe:**
1. Dashboard → Developers → Webhooks → Add endpoint
2. URL : `https://votre-api.com/payments/webhooks/stripe`
3. Events : `payment_intent.succeeded`, `checkout.session.completed`, `customer.subscription.*`, `charge.refunded`

**PayPal:**
1. Developer Dashboard → Webhooks → Add webhook
2. URL : `https://votre-api.com/payments/webhooks/paypal`
3. Events : `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.*`, `BILLING.SUBSCRIPTION.*`

### rawBody (requis pour Stripe)

Le middleware `bodyParser.json` dans `app.ts` doit sauvegarder le body brut :

```typescript
http.app.use(bodyParser.json({
    verify: (req: any, _res, buf) => {
        req.rawBody = buf
    },
}))
```

C'est déjà en place si vous avez suivi la section [Setup dans app.ts](#3-setup-dans-appts).

---

## 9. API Reference

### Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/payments/checkout` | Oui | Créer un checkout (web) |
| `GET` | `/payments/:id` | Oui | Détails d'un paiement |
| `POST` | `/payments/subscriptions` | Oui | Créer une subscription |
| `GET` | `/payments/subscriptions/:id` | Oui | Détails d'une subscription |
| `DELETE` | `/payments/subscriptions/:id` | Oui | Annuler une subscription |
| `POST` | `/payments/subscriptions/:id/resume` | Oui | Reprendre une subscription |
| `POST` | `/payments/:id/refund` | Oui | Rembourser un paiement |
| `POST` | `/payments/methods/setup` | Oui | Setup d'une méthode de paiement |
| `GET` | `/payments/methods` | Oui | Lister les méthodes sauvegardées |
| `DELETE` | `/payments/methods/:id` | Oui | Supprimer une méthode |
| `POST` | `/payments/webhooks/:provider` | Non | Webhook du provider |
| `POST` | `/payments/mobile/init` | Oui | Initialiser paiement mobile |
| `POST` | `/payments/mobile/subscription` | Oui | Initialiser subscription mobile |
| `POST` | `/payments/mobile/confirm` | Oui | Confirmer paiement mobile |

### Programmatic API (depuis le code serveur)

```typescript
import etherial from 'etherial'

const leaf = etherial.eth_payment_leaf

// Providers
leaf.getEnabledProviders()                           // ['stripe', 'paypal']
leaf.isProviderEnabled('stripe')                     // true
leaf.getProviderOrThrow('stripe')                    // PaymentProvider instance

// Customers
await leaf.getOrCreateCustomer(userId, email, name, 'stripe')
await leaf.createCustomer({ email, name }, 'stripe')
await leaf.getCustomer(customerId, 'stripe')

// Payments
await leaf.createCheckout({ ... }, 'stripe')
await leaf.getPayment(paymentId, 'stripe')
await leaf.refund({ payment_id, amount, reason }, 'stripe')

// Subscriptions
await leaf.createSubscription({ ... }, 'stripe')
await leaf.getSubscription(subscriptionId, 'stripe')
await leaf.cancelSubscription(subscriptionId, immediate, 'stripe')
await leaf.resumeSubscription(subscriptionId, 'stripe')

// Mobile
await leaf.initMobilePayment({ amount, currency, metadata }, userId, email, name, 'stripe')
await leaf.initMobileSubscription({ price_id }, userId, email, name, 'stripe')
await leaf.confirmMobilePayment(paymentId, 'paypal')

// Payment Methods
await leaf.setupPaymentMethod({ customer_id, success_url, cancel_url }, 'stripe')
await leaf.listPaymentMethods(customerId, 'stripe')

// Webhook callbacks (dans app.ts)
leaf.onPaymentCompleted(async (payment, localPayment) => { ... })
leaf.onSubscriptionUpdated(async (subscription, localSubscription) => { ... })
leaf.onPaymentFailed(async (payment, localPayment) => { ... })
leaf.onRefundCreated(async (refund, localPayment) => { ... })
```

---

## 10. Providers supportés

### Stripe

Support complet de toutes les fonctionnalités.

```typescript
leaf.getProviderOrThrow('stripe').supports('listPayments')         // true
leaf.getProviderOrThrow('stripe').supports('listSubscriptions')    // true
leaf.getProviderOrThrow('stripe').supports('getCustomer')          // true
```

### PayPal

Support partiel — certaines fonctionnalités ne sont pas disponibles via l'API PayPal.
Utilisez `supports()` pour vérifier avant d'appeler :

```typescript
const paypal = leaf.getProviderOrThrow('paypal')

paypal.supports('listPayments')           // false — pas de list orders par customer
paypal.supports('listSubscriptions')      // false — pas de list par customer
paypal.supports('listPaymentMethods')     // false — vault limité
paypal.supports('getCustomer')            // false — pas de customer API
paypal.supports('setDefaultPaymentMethod') // false — géré par votre DB
```

### Currencies supportées

Le système gère automatiquement les conversions pour :
- **Devises standard** (2 décimales) : EUR, USD, GBP, CAD, etc.
- **Devises zero-decimal** (0 décimales) : JPY, KRW, VND, CLP, etc.
- **Devises 3 décimales** : KWD, BHD, OMR, JOD, IQD, TND, LYD

### Idempotency

Passez `idempotency_key` dans les requêtes mobile pour éviter les paiements en double :

```typescript
// Stripe utilise l'en-tête Idempotency-Key
// PayPal utilise l'en-tête PayPal-Request-Id
await api.post('/payments/mobile/init', {
    provider: 'stripe',
    amount: 15000,
    currency: 'eur',
    idempotency_key: `rental_${rentalId}_${Date.now()}`,
})
```

---

## 11. Exemples réalistes — Qarmee (Location de voitures)

Voici comment configurer les callbacks webhook dans le contexte d'une marketplace de location de voitures.

### Setup complet dans app.ts

```typescript
// src/app.ts
import etherial, { Etherial } from 'etherial'
import { User } from './models/User'
import { CarRentalRequest, CarRentalRequestStatus } from './models/CarRentalRequest'
import { CarRentalPayment, PaymentMethod, PaymentType, PaymentStatus } from './models/CarRentalPayment'
import { Car } from './models/Car'
import { Notification } from './models/Notification'
import { FeePolicy } from './models/FeePolicy'

export default class App {
    etherial_module_name = 'app'

    // ...

    run({ http, database, reactive }: Etherial) {
        etherial.http_security.setCustomAuthentificationChecker(({ user_id }) => {
            return User.findOne({ where: { id: user_id } })
        })

        // ==================== Payment Webhooks ====================

        /**
         * onPaymentCompleted — Un paiement par carte a été confirmé par Stripe/PayPal
         *
         * C'est le callback principal : il fait le lien entre le paiement du provider
         * et la location dans votre base de données.
         *
         * Flow : Locataire paie → Stripe confirme → ce callback s'exécute
         */
        etherial.eth_payment_leaf.onPaymentCompleted(async (providerPayment, localPayment) => {
            // 1. Retrouver la location associée via les metadata
            const rentalId = providerPayment.metadata?.rental_request_id
                || localPayment.metadata?.rental_request_id

            if (!rentalId) {
                console.warn(`[Payment] Payment ${localPayment.id} completed but no rental_request_id in metadata`)
                return
            }

            const rental = await CarRentalRequest.findByPk(rentalId, {
                include: [{ model: Car }],
            })

            if (!rental) {
                console.error(`[Payment] Rental #${rentalId} not found for payment ${localPayment.id}`)
                return
            }

            // 2. Récupérer la FeePolicy pour calculer la commission
            const feePolicy = rental.fee_id
                ? await FeePolicy.findByPk(rental.fee_id)
                : null

            const feeAmount = feePolicy
                ? Math.min(
                    Math.max(
                        (rental.total_price * Number(feePolicy.percentage)) / 100 + Number(feePolicy.fixed_amount),
                        Number(feePolicy.min_fee || 0)
                    ),
                    Number(feePolicy.max_fee || Infinity)
                )
                : 0

            // 3. Créer le CarRentalPayment local
            await CarRentalPayment.create({
                provider_payment_id: providerPayment.id,
                type: PaymentType.PAYMENT,
                method: PaymentMethod.CARD,
                status: PaymentStatus.PAID,
                currency: providerPayment.amount.currency,
                full_amount: rental.total_price,
                fee_amount: feeAmount,
                rental_request_id: rental.id,
                sender_id: rental.renter_id,
            })

            // 4. Mettre à jour le statut de la location → ACCEPTED
            //    (le paiement valide la demande, le propriétaire peut maintenant lancer l'inspection)
            if (rental.status === CarRentalRequestStatus.PENDING_DECISION) {
                await rental.update({
                    status: CarRentalRequestStatus.ACCEPTED,
                    status_updated_by_id: rental.renter_id,
                })
            }

            // 5. Notifier le propriétaire
            await Notification.create({
                title: `Paiement reçu pour la location #${rental.id} — ${rental.total_price}€`,
                location: 'CarRentalRequest',
                location_id: rental.id,
                location_title: 'Paiement confirmé',
                created_for_user_id: rental.car.owner_id,
                created_by_user_id: rental.renter_id,
            })

            console.log(`[Payment] Rental #${rental.id} — payment ${providerPayment.id} completed (${rental.total_price}€, fee: ${feeAmount}€)`)
        })

        /**
         * onPaymentFailed — Le paiement par carte a échoué (fonds insuffisants, carte expirée, etc.)
         *
         * Flow : Locataire tente de payer → Stripe refuse → ce callback s'exécute
         */
        etherial.eth_payment_leaf.onPaymentFailed(async (providerPayment, localPayment) => {
            const rentalId = providerPayment.metadata?.rental_request_id
                || localPayment?.metadata?.rental_request_id

            if (!rentalId) return

            const rental = await CarRentalRequest.findByPk(rentalId)
            if (!rental) return

            // Créer un enregistrement de paiement échoué pour le suivi
            await CarRentalPayment.create({
                provider_payment_id: providerPayment.id,
                type: PaymentType.PAYMENT,
                method: PaymentMethod.CARD,
                status: PaymentStatus.FAILED,
                currency: providerPayment.amount.currency,
                full_amount: rental.total_price,
                fee_amount: 0,
                rental_request_id: rental.id,
                sender_id: rental.renter_id,
            })

            // Notifier le locataire pour qu'il réessaie
            await Notification.create({
                title: `Votre paiement pour la location #${rental.id} a échoué. Veuillez vérifier votre carte et réessayer.`,
                location: 'CarRentalRequest',
                location_id: rental.id,
                location_title: 'Échec du paiement',
                created_for_user_id: rental.renter_id,
            })

            console.log(`[Payment] Rental #${rental.id} — payment FAILED (${providerPayment.id})`)
        })

        /**
         * onRefundCreated — Un remboursement a été effectué (annulation, litige résolu)
         *
         * Flow : Admin rembourse via Stripe dashboard → webhook → ce callback
         *    ou : Locataire annule → CancellationPolicy → refund API → webhook → ce callback
         */
        etherial.eth_payment_leaf.onRefundCreated(async (refund, localPayment) => {
            if (!localPayment) return

            const rentalId = localPayment.metadata?.rental_request_id
            if (!rentalId) return

            const rental = await CarRentalRequest.findByPk(rentalId, {
                include: [{ model: Car }],
            })
            if (!rental) return

            // Retrouver le CarRentalPayment original via le provider_payment_id
            const originalPayment = await CarRentalPayment.findOne({
                where: {
                    provider_payment_id: refund.payment_id,
                    rental_request_id: rental.id,
                    type: PaymentType.PAYMENT,
                },
            })

            if (originalPayment) {
                // Créer l'enregistrement de remboursement
                await CarRentalPayment.create({
                    provider_payment_id: refund.id,
                    type: PaymentType.REFUND,
                    related_payment_id: originalPayment.id,
                    method: PaymentMethod.CARD,
                    status: PaymentStatus.REFUNDED,
                    currency: refund.amount.currency,
                    full_amount: refund.amount.amount / 100, // Convertir depuis centimes
                    fee_amount: originalPayment.fee_amount,  // Les frais Qarmee sont aussi remboursés
                    rental_request_id: rental.id,
                    sender_id: rental.renter_id,
                })
            }

            // Mettre à jour la location si pas déjà annulée
            if (rental.status !== CarRentalRequestStatus.CANCELED) {
                await rental.update({
                    status: CarRentalRequestStatus.CANCELED,
                })
            }

            // Notifier les deux parties
            await Notification.bulkCreate([
                {
                    title: `Remboursement de ${(refund.amount.amount / 100).toFixed(2)}€ effectué pour la location #${rental.id}.`,
                    location: 'CarRentalRequest',
                    location_id: rental.id,
                    location_title: 'Remboursement',
                    created_for_user_id: rental.renter_id,
                },
                {
                    title: `La location #${rental.id} a été remboursée (${(refund.amount.amount / 100).toFixed(2)}€).`,
                    location: 'CarRentalRequest',
                    location_id: rental.id,
                    location_title: 'Remboursement',
                    created_for_user_id: rental.car.owner_id,
                },
            ])

            console.log(`[Payment] Rental #${rental.id} — refund ${refund.id} (${refund.amount.amount / 100}€)`)
        })

        /**
         * onSubscriptionUpdated — Changement de statut d'un abonnement premium
         *
         * Utile si vous proposez un plan premium pour les propriétaires
         * (mise en avant des annonces, statistiques avancées, etc.)
         */
        etherial.eth_payment_leaf.onSubscriptionUpdated(async (providerSub, localSub) => {
            const userId = localSub.user_id
            if (!userId) return

            const user = await User.findByPk(userId)
            if (!user) return

            if (providerSub.status === 'active' || providerSub.status === 'trialing') {
                // Activer les features premium
                await user.update({ role: 'premium_owner' } as any)

                await Notification.create({
                    title: 'Votre abonnement Premium est actif ! Profitez de vos avantages.',
                    location: 'Subscription',
                    location_id: localSub.id,
                    location_title: 'Abonnement Premium',
                    created_for_user_id: userId,
                })
            } else if (providerSub.status === 'canceled' || providerSub.status === 'unpaid') {
                // Désactiver le premium
                await user.update({ role: 'user' } as any)

                await Notification.create({
                    title: 'Votre abonnement Premium a expiré. Réabonnez-vous pour retrouver vos avantages.',
                    location: 'Subscription',
                    location_id: localSub.id,
                    location_title: 'Abonnement expiré',
                    created_for_user_id: userId,
                })
            }

            console.log(`[Subscription] User #${userId} — status: ${providerSub.status}`)
        })

        // ... reste du setup ...
    }
}
```

### Exemple de metadata côté mobile

Pour que les callbacks retrouvent la location, passez `rental_request_id` dans les metadata :

```typescript
// React Native — Initier un paiement pour une location
const response = await api.post('/payments/mobile/init', {
    provider: 'stripe',
    amount: rental.total_price * 100,  // Convertir en centimes
    currency: 'eur',
    idempotency_key: `rental_${rental.id}_payment`,
    metadata: {
        rental_request_id: rental.id.toString(),
        car_id: rental.car_id.toString(),
        renter_id: currentUser.id.toString(),
    },
})
```

### Schéma du flow complet

```
Locataire                    API                      Stripe              Base de données
    |                         |                          |                      |
    |-- Demande location ---->|                          |                      |
    |                         |-- CarRentalRequest.create() ------------------>|
    |                         |      status: PENDING_DECISION                  |
    |                         |                          |                      |
    |-- Payer (mobile) ------>|                          |                      |
    |                         |-- PaymentIntent -------->|                      |
    |<-- client_secret -------|<-------------------------|                      |
    |                         |                          |                      |
    |-- Stripe SDK ---------->|                          |                      |
    |                         |<-- webhook succeeded ----|                      |
    |                         |                          |                      |
    |                    onPaymentCompleted()             |                      |
    |                         |-- CarRentalPayment.create() ------------------>|
    |                         |      status: PAID, method: CARD                |
    |                         |-- rental.update(ACCEPTED) -------------------->|
    |                         |-- Notification → propriétaire --------------->|
    |                         |                          |                      |
    |                    [Inspection avant location]      |                      |
    |                         |                          |                      |
    |                    [Location en cours]              |                      |
    |                         |                          |                      |
    |-- Annulation ---------->|                          |                      |
    |                         |-- CancellationPolicy --> refund % calculé      |
    |                         |-- leaf.refund() -------->|                      |
    |                         |<-- webhook refunded -----|                      |
    |                    onRefundCreated()                |                      |
    |                         |-- CarRentalPayment.create(REFUND) ------------>|
    |                         |-- rental.update(CANCELED) -------------------->|
    |                         |-- Notification → locataire + propriétaire ---->|
```
