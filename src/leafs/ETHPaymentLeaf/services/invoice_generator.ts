// @ts-ignore - puppeteer is an optional peer dependency
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'
import ejs from 'ejs'
import { formatMoney, CURRENCY_SYMBOLS } from '../providers/base.js'

export interface InvoiceCompanyInfo {
    name?: string
    address?: string
    tax_id?: string
    logo_url?: string
}

export interface InvoiceData {
    invoice_number: string
    date: Date
    customer_email: string
    customer_name?: string
    amount: number
    currency: string
    payment_method?: string
    provider: string
    status: string
    metadata?: Record<string, any>
    company?: InvoiceCompanyInfo
    locale?: 'fr' | 'en'
}

export interface CreditNoteData {
    credit_note_number: string
    date: Date
    original_invoice_number?: string
    customer_email: string
    customer_name?: string
    amount: number
    currency: string
    reason?: string
    provider: string
    company?: InvoiceCompanyInfo
    locale?: 'fr' | 'en'
}

function buildTemplateData(data: InvoiceData | CreditNoteData, type: 'invoice' | 'credit_note') {
    const locale = data.locale || 'fr'
    const currencySymbol = CURRENCY_SYMBOLS[data.currency] || data.currency.toUpperCase()
    const formattedAmount = formatMoney({ amount: data.amount, currency: data.currency })
    const formattedDate = data.date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })

    return {
        ...data,
        type,
        currencySymbol,
        formattedAmount,
        formattedDate,
        locale,
        palette: {
            primary: '#169DAF',
            text: '#153242',
            muted: '#859299',
            bg: '#f8fafb',
            border: '#e2e8f0',
        },
    }
}

async function renderPDF(htmlContent: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
        const page = await browser.newPage()
        await page.setViewport({ width: 793, height: 1122, deviceScaleFactor: 2 })
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30_000 })
        await page.evaluateHandle('document.fonts.ready')

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        })

        return Buffer.from(pdfBuffer)
    } finally {
        await browser.close()
    }
}

const DEFAULT_INVOICE_TEMPLATE = path.join(__dirname, '../templates/invoice.ejs')
const DEFAULT_CREDIT_NOTE_TEMPLATE = path.join(__dirname, '../templates/credit_note.ejs')

export async function generateInvoice(data: InvoiceData, customTemplatePath?: string): Promise<Buffer> {
    const template = fs.readFileSync(customTemplatePath || DEFAULT_INVOICE_TEMPLATE, 'utf-8')
    const templateData = buildTemplateData(data, 'invoice')
    const html = ejs.render(template, templateData)
    return renderPDF(html)
}

export async function generateCreditNote(data: CreditNoteData, customTemplatePath?: string): Promise<Buffer> {
    const template = fs.readFileSync(customTemplatePath || DEFAULT_CREDIT_NOTE_TEMPLATE, 'utf-8')
    const templateData = buildTemplateData(data, 'credit_note')
    const html = ejs.render(template, templateData)
    return renderPDF(html)
}
