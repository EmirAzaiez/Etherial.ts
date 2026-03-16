/**
 * Zero-decimal currencies (no cents/subunits)
 */
export const ZERO_DECIMAL_CURRENCIES = ['jpy', 'krw', 'clp', 'vnd', 'bif', 'djf', 'gnf', 'kmf', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'];
/**
 * Three-decimal currencies (1/1000 instead of 1/100)
 */
export const THREE_DECIMAL_CURRENCIES = ['kwd', 'bhd', 'omr', 'jod', 'iqd', 'tnd', 'lyd'];
/**
 * Currency symbols for display
 */
export const CURRENCY_SYMBOLS = {
    usd: '$',
    eur: '€',
    gbp: '£',
    cad: 'CA$',
    aud: 'A$',
    chf: 'CHF',
    jpy: '¥',
    cny: '¥',
    inr: '₹',
    krw: '₩',
    sgd: 'S$',
    hkd: 'HK$',
    nzd: 'NZ$',
    sek: 'kr',
    nok: 'kr',
    dkk: 'kr',
    pln: 'zł',
    czk: 'Kč',
    huf: 'Ft',
    ron: 'lei',
    rub: '₽',
    try: '₺',
    brl: 'R$',
    mxn: 'MX$',
    zar: 'R',
    thb: '฿',
    myr: 'RM',
    idr: 'Rp',
    php: '₱',
    twd: 'NT$',
    // MENA
    aed: 'د.إ',
    sar: '﷼',
    qar: '﷼',
    kwd: 'د.ك',
    bhd: '.د.ب',
    omr: '﷼',
    jod: 'د.ا',
    lbp: 'ل.ل',
    iqd: 'ع.د',
    mad: 'د.م.',
    tnd: 'د.ت',
    dzd: 'د.ج',
    lyd: 'ل.د',
    ils: '₪',
    egp: 'E£',
    pkr: '₨',
    bdt: '৳'
};
/**
 * Format money amount for display
 */
export function formatMoney(money) {
    const symbol = CURRENCY_SYMBOLS[money.currency] || money.currency.toUpperCase();
    let displayAmount;
    if (ZERO_DECIMAL_CURRENCIES.includes(money.currency)) {
        displayAmount = money.amount.toLocaleString();
    }
    else if (THREE_DECIMAL_CURRENCIES.includes(money.currency)) {
        displayAmount = (money.amount / 1000).toFixed(3);
    }
    else {
        displayAmount = (money.amount / 100).toFixed(2);
    }
    return `${symbol}${displayAmount}`;
}
/**
 * Convert display amount to smallest unit
 */
export function toSmallestUnit(amount, currency) {
    if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
        return Math.round(amount);
    }
    else if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
        return Math.round(amount * 1000);
    }
    else {
        return Math.round(amount * 100);
    }
}
/**
 * Convert smallest unit to display amount
 */
export function toDisplayAmount(amount, currency) {
    if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
        return amount;
    }
    else if (THREE_DECIMAL_CURRENCIES.includes(currency)) {
        return amount / 1000;
    }
    else {
        return amount / 100;
    }
}
/**
 * Registry of available payment providers
 */
export const PaymentProviders = new Map();
/**
 * Register a payment provider
 * @example
 * registerProvider('stripe', StripeProvider)
 * registerProvider('paypal', PayPalProvider)
 */
export function registerProvider(name, provider) {
    PaymentProviders.set(name.toLowerCase(), provider);
}
/**
 * Get a payment provider by name
 */
export function getProvider(name) {
    return PaymentProviders.get(name.toLowerCase());
}
