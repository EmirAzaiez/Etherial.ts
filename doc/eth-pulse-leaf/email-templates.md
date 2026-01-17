# ETHPulseLeaf - Email Templates

ETHPulseLeaf uses **EJS** (Embedded JavaScript) for email templates. You have access to a beautifully styled base transactional template and can create your own custom templates.

---

## Template Architecture

```
ETHPulseLeaf/
└── templates/
    ├── base/
    │   └── transactional.ejs   # Base template (header, footer, styles)
    └── presets/
        ├── password_reset.ejs
        ├── email_verification.ejs
        └── welcome.ejs
```

---

## Branding Configuration

In your `Config.ts`, customize the email branding:

```typescript
templates: {
    // Logo displayed in header
    logoUrl: 'https://yourapp.com/logo.png',
    
    // Gradient colors (header + buttons)
    primaryColor: '#6366F1',
    secondaryColor: '#818CF8',
    
    // Your company name
    companyName: 'YourApp',
    
    // Copyright text
    footerText: '© 2026 YourApp. All rights reserved.',
    
    // Social media links (optional)
    socialLinks: {
        twitter: 'https://twitter.com/yourapp',
        instagram: 'https://instagram.com/yourapp',
        facebook: 'https://facebook.com/yourapp',
        linkedin: 'https://linkedin.com/company/yourapp',
    },
    
    // Path to your custom templates (optional)
    customTemplatesPath: './src/templates/emails',
}
```

---

## Sending Transactional Emails

The base transactional template is fully responsive and compatible with all email clients.

```typescript
await etherial.eth_pulse_leaf.email().sendTransactional(
    'user@example.com',
    'Welcome to YourApp!',
    {
        // Title displayed in the colored header
        title: 'Welcome!',
        
        // Gmail preview text (optional)
        preheader: 'Your account is ready to use',
        
        // Greeting line
        greeting: 'Hi John,',
        
        // Main content (HTML allowed)
        body: `
            <p>Thanks for signing up! We're thrilled to have you.</p>
            <p>Get started by exploring your <strong>dashboard</strong>.</p>
        `,
        
        // CTA button (optional)
        buttonText: 'Go to Dashboard',
        buttonUrl: 'https://yourapp.com/dashboard',
        
        // Additional content after button (optional)
        additionalContent: '<p>Need help? Check our <a href="#">documentation</a>.</p>',
        
        // Footer note (optional)
        footer: 'Need help? Just reply to this email!',
    }
)
```

### TransactionalContent Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Title in the gradient header |
| `preheader` | No | Gmail preview text (hidden in email) |
| `greeting` | No | Greeting line (e.g., "Hi John,") |
| `body` | **Yes** | Main content (HTML allowed) |
| `buttonText` | No | CTA button text |
| `buttonUrl` | No | CTA button URL |
| `additionalContent` | No | Content after the button |
| `footer` | No | Note before corporate footer |

---

## Preset Templates

### Password Reset

```typescript
await etherial.eth_pulse_leaf.email().sendPasswordReset(
    'user@example.com',
    'https://yourapp.com/reset?token=abc123',
    'John',        // userName (optional)
    '1 hour'       // expiresIn (optional)
)
```

### Email Verification

```typescript
await etherial.eth_pulse_leaf.email().sendEmailVerification(
    'user@example.com',
    'https://yourapp.com/verify?token=xyz',
    '123456',      // verificationCode (optional)
    'John'         // userName (optional)
)
```

### Welcome

```typescript
await etherial.eth_pulse_leaf.email().sendWelcome(
    'user@example.com',
    'https://yourapp.com/dashboard',
    'John',
    ['Create your first project', 'Invite your team', 'Explore templates']
)
```

---

## Creating Custom Templates

### 1. Create the template file

```bash
mkdir -p src/templates/emails
```

Create `src/templates/emails/order_confirmation.ejs`:

```ejs
<%# Order Confirmation Template %>
<%- include('../../../leafs/ETHPulseLeaf/templates/base/transactional.ejs', {
    title: 'Order Confirmed! 🎉',
    preheader: `Your order #${data.orderNumber} has been confirmed`,
    greeting: `Hi ${data.customerName || 'there'},`,
    body: `
        <p>Great news! Your order has been confirmed and is being prepared.</p>
        
        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">Order Number</p>
            <p style="margin: 5px 0 0; font-size: 20px; font-weight: 700; color: #1e293b;">
                #${data.orderNumber}
            </p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
            <% data.items.forEach(item => { %>
            <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <%= item.name %>
                </td>
                <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">
                    <%= item.price %>
                </td>
            </tr>
            <% }) %>
            <tr>
                <td style="padding: 15px 0; font-weight: 700;">Total</td>
                <td style="padding: 15px 0; font-weight: 700; text-align: right;">
                    <%= data.total %>
                </td>
            </tr>
        </table>
    `,
    buttonText: 'Track Order',
    buttonUrl: data.trackingUrl,
    footer: 'Questions? Reply to this email or contact our support team.',
    config: config
}) %>
```

### 2. Configure the path

```typescript
templates: {
    customTemplatesPath: './src/templates/emails',
    // ... other options
}
```

### 3. Use the template

```typescript
await etherial.eth_pulse_leaf.email().sendFromTemplate(
    'order_confirmation',
    {
        to: 'customer@example.com',
        subject: 'Order #12345 Confirmed',
        data: {
            orderNumber: '12345',
            customerName: 'John',
            items: [
                { name: 'Pro Plan (Monthly)', price: '$29.00' },
                { name: 'Extra Storage', price: '$9.99' },
            ],
            total: '$38.99',
            trackingUrl: 'https://yourapp.com/orders/12345',
        }
    }
)
```

---

## Available Template Variables

In your EJS templates, you have access to:

| Variable | Description |
|----------|-------------|
| `data.*` | All data passed in `options.data` |
| `config.logoUrl` | Logo URL |
| `config.primaryColor` | Primary color |
| `config.secondaryColor` | Secondary color |
| `config.companyName` | Company name |
| `config.footerText` | Footer text |
| `config.socialLinks.*` | Social media links |

---

## Best Practices

1. **Always extend the base template** to maintain consistent styling
2. **Use `<%- %>` for HTML** (unescaped) and `<%= %>` for text
3. **Test on multiple clients** (Gmail, Outlook, Apple Mail)
4. **Host images on a reliable CDN**
5. **Provide a text fallback** for clients without HTML support
