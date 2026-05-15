/**
 * W6a — Template registry.
 *
 * Keyed map of every shipped template. The MCP `email.preview` tool and
 * the admin preview pane both go through here so adding a template is a
 * one-line registration; no other surface changes.
 *
 * Template shape is intentionally loose (`unknown` input) — each caller
 * supplies its own typed input at the call site. The registry is the
 * lookup surface, not a type-checker for arbitrary callers.
 */

import {IEmailTheme} from './_shared/theme';
import {receiptTemplate} from './receipt';
import {orderConfirmationTemplate} from './order-confirmation';
import {shippedTemplate} from './shipped';
import {magicLinkTemplate} from './magic-link';
import {verifyEmailTemplate} from './verify-email';
import {passwordResetTemplate} from './password-reset';
import {accountWelcomeTemplate} from './account-welcome';
import {abandonedCartTemplate} from './abandoned-cart';
import {carReservationConfirmationTemplate} from './car-reservation-confirmation';
import {inquiryAcknowledgementTemplate} from './inquiry-acknowledgement';
import {scheduledPublishFailedTemplate} from './scheduled-publish-failed';
import {lowStockAlertTemplate} from './low-stock-alert';
import {savedSearchAlertTemplate} from './saved-search-alert';

export interface EmailTemplate<TInput = unknown> {
    id: string;
    subject: (input: TInput) => string;
    html: (input: TInput, theme: IEmailTheme) => string;
    text: (input: TInput) => string;
    requiredFields: readonly string[];
}

// Cast is safe — each template's input shape is checked at its own call
// site (OrderService finalize wire-up, magic-link send, etc.). The
// registry surface is intentionally generic.
const ALL: ReadonlyArray<EmailTemplate<any>> = [
    receiptTemplate as EmailTemplate<any>,
    orderConfirmationTemplate as EmailTemplate<any>,
    shippedTemplate as EmailTemplate<any>,
    magicLinkTemplate as EmailTemplate<any>,
    verifyEmailTemplate as EmailTemplate<any>,
    passwordResetTemplate as EmailTemplate<any>,
    accountWelcomeTemplate as EmailTemplate<any>,
    abandonedCartTemplate as EmailTemplate<any>,
    carReservationConfirmationTemplate as EmailTemplate<any>,
    inquiryAcknowledgementTemplate as EmailTemplate<any>,
    scheduledPublishFailedTemplate as EmailTemplate<any>,
    lowStockAlertTemplate as EmailTemplate<any>,
    savedSearchAlertTemplate as EmailTemplate<any>,
];

const BY_ID = new Map<string, EmailTemplate<any>>(ALL.map(t => [t.id, t]));

export function getTemplate(id: string): EmailTemplate<any> | undefined {
    return BY_ID.get(id);
}

export function listTemplates(): ReadonlyArray<{id: string; requiredFields: readonly string[]}> {
    return ALL.map(t => ({id: t.id, requiredFields: t.requiredFields}));
}

/**
 * Render a template against an input + theme. Returns the rendered
 * subject, HTML and plaintext together — what the preview pane needs
 * to mount + what the MCP tool serialises back to the AI caller.
 */
export interface RenderedEmail {
    templateId: string;
    subject: string;
    html: string;
    text: string;
}

export function renderTemplate(id: string, input: unknown, theme: IEmailTheme): RenderedEmail {
    const tpl = BY_ID.get(id);
    if (!tpl) {
        throw new Error(`Email template not found: ${id}`);
    }
    return {
        templateId: tpl.id,
        subject: tpl.subject(input),
        html: tpl.html(input, theme),
        text: tpl.text(input),
    };
}
