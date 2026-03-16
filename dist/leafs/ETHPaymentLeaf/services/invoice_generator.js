var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// @ts-ignore - puppeteer is an optional peer dependency
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { formatMoney, CURRENCY_SYMBOLS } from '../providers/base.js';
function buildTemplateData(data, type) {
    const locale = data.locale || 'fr';
    const currencySymbol = CURRENCY_SYMBOLS[data.currency] || data.currency.toUpperCase();
    const formattedAmount = formatMoney({ amount: data.amount, currency: data.currency });
    const formattedDate = data.date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    return Object.assign(Object.assign({}, data), { type,
        currencySymbol,
        formattedAmount,
        formattedDate,
        locale, palette: {
            primary: '#169DAF',
            text: '#153242',
            muted: '#859299',
            bg: '#f8fafb',
            border: '#e2e8f0',
        } });
}
function renderPDF(htmlContent) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        try {
            const page = yield browser.newPage();
            yield page.setViewport({ width: 793, height: 1122, deviceScaleFactor: 2 });
            yield page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
            yield page.evaluateHandle('document.fonts.ready');
            const pdfBuffer = yield page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            yield browser.close();
        }
    });
}
const DEFAULT_INVOICE_TEMPLATE = path.join(__dirname, '../templates/invoice.ejs');
const DEFAULT_CREDIT_NOTE_TEMPLATE = path.join(__dirname, '../templates/credit_note.ejs');
export function generateInvoice(data, customTemplatePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = fs.readFileSync(customTemplatePath || DEFAULT_INVOICE_TEMPLATE, 'utf-8');
        const templateData = buildTemplateData(data, 'invoice');
        const html = ejs.render(template, templateData);
        return renderPDF(html);
    });
}
export function generateCreditNote(data, customTemplatePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = fs.readFileSync(customTemplatePath || DEFAULT_CREDIT_NOTE_TEMPLATE, 'utf-8');
        const templateData = buildTemplateData(data, 'credit_note');
        const html = ejs.render(template, templateData);
        return renderPDF(html);
    });
}
