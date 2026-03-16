export interface InvoiceCompanyInfo {
    name?: string;
    address?: string;
    tax_id?: string;
    logo_url?: string;
}
export interface InvoiceData {
    invoice_number: string;
    date: Date;
    customer_email: string;
    customer_name?: string;
    amount: number;
    currency: string;
    payment_method?: string;
    provider: string;
    status: string;
    metadata?: Record<string, any>;
    company?: InvoiceCompanyInfo;
    locale?: 'fr' | 'en';
}
export interface CreditNoteData {
    credit_note_number: string;
    date: Date;
    original_invoice_number?: string;
    customer_email: string;
    customer_name?: string;
    amount: number;
    currency: string;
    reason?: string;
    provider: string;
    company?: InvoiceCompanyInfo;
    locale?: 'fr' | 'en';
}
export declare function generateInvoice(data: InvoiceData, customTemplatePath?: string): Promise<Buffer>;
export declare function generateCreditNote(data: CreditNoteData, customTemplatePath?: string): Promise<Buffer>;
