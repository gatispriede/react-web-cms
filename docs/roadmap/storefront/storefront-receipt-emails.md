---
name: storefront-receipt-emails
description: Treat order-confirmation + magic-link receipt emails as a product surface. Visual progress timeline, dated next-step milestones, one focused CTA, mobile-first markup. 54% open rate, 14% CTR — highest-engagement touchpoint.
research: see research-findings-2026-05-12.md §2 Receipt email UX
---

# Receipt emails as a product surface

## Goal

Build receipt + transactional email templates that treat email as a **product surface, not a transactional afterthought**. Per the Baymard / Klaviyo data:

- **54% open rate, 14% CTR** — highest-engagement touchpoint we'll ever have
- **60% open on mobile** — mobile-first markup mandatory
- Visual progress timeline (Ordered → Verifying → Scheduling → Delivery) is the **biggest anxiety reducer** for high-AOV (cars, furniture)

## Why now

- Pairs with [client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md) — anonymous checkout uses the receipt email as the account-creation upsell vehicle (one-click "save details").
- Pairs with [ss-com-cars-integration](ss-com-cars-integration.md) — car reservation flow is high-AOV; the email is the trust anchor between online reservation and in-person handover.
- Reusable across every transactional surface: magic-link, password reset, order-confirmation, inquiry-acknowledgement, scheduled-publish-failure.

## Design

### Templates as TypeScript modules

`services/features/Email/templates/<name>.ts` — each template exports:

```ts
export interface ReceiptTemplate<TInput> {
    id: string;
    subject: (input: TInput) => string;
    html: (input: TInput, theme: IThemeTokens) => string;
    text: (input: TInput) => string;          // plaintext fallback
    requiredFields: (keyof TInput)[];
}
```

The HTML is generated via a small template helper (avoid pulling in a heavy MJML / React-Email dep day-1; we can adopt later). Layout primitives shared across templates:

```ts
// services/features/Email/templates/_shared/layout.ts
export function emailShell({title, theme, body}: ShellInput): string {
    return `<!doctype html>
<html lang="${theme.lang}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>${escape(title)}</title>
    <style>${emailCss(theme)}</style>
</head>
<body style="background:${theme.colorBgLayout};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
            <table role="presentation" width="600" class="email-container">
                ${body}
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
```

CSS inlined via a small build helper (no external service). Mobile-first: 600 px max-width, single-column, ≥16 px body type, no horizontal scroll at 320 px.

### Templates to ship

| Template | Trigger | Visual progress? |
|---|---|---|
| `magicLink` | request → email link | No (just CTA + 15-min expiry note) |
| `verifyEmail` | signup or change-email | No |
| `passwordReset` | request | No |
| `orderConfirmation` | order finalize (paid + guest receipt) | **Yes** — Ordered → Confirmed → Scheduling → Delivered |
| `carReservationConfirmation` | ss.com car deposit | **Yes** — Reserved → Verification → Pickup scheduled → Handover complete |
| `inquiryAcknowledgement` | contact form submit | No (one CTA: "expected response within 24h") |
| `scheduledPublishFailed` | release scheduler failure | Operator-targeted — no visual progress |
| `lowStockAlert` | inventory threshold (operator-targeted) | No |
| `savedSearchAlert` | saved search delta found | List preview + filter URL CTA |

### Visual progress timeline pattern

For order-style templates, a 4-step horizontal stepper rendered in email-safe HTML:

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td align="center" valign="top" width="25%">
            <div class="step-dot step-done">●</div>
            <div class="step-label">Reserved</div>
            <div class="step-date">Today, 14:32</div>
        </td>
        <td align="center" valign="top" width="25%">
            <div class="step-dot step-active">●</div>
            <div class="step-label">Verifying</div>
            <div class="step-date">Within 24 hours</div>
        </td>
        <td align="center" valign="top" width="25%">
            <div class="step-dot step-pending">○</div>
            <div class="step-label">Pickup scheduled</div>
            <div class="step-date">By Friday</div>
        </td>
        <td align="center" valign="top" width="25%">
            <div class="step-dot step-pending">○</div>
            <div class="step-label">Handover</div>
            <div class="step-date">In Riga</div>
        </td>
    </tr>
</table>
```

CSS uses Outlook-safe constructs (no flexbox, table-based layout, `mso-` conditionals where needed).

### Theme integration

Every template reads from the active theme's tokens (`theme.colorAccent`, `theme.fontFamilyBody`, `theme.colorBgLayout`, etc.). Each [first-class theme](first-class-themes.md) ships a `theme.email.json` token subset with email-safe values (no `var(--*)`, all resolved to hex).

### Sending — reuse existing `EmailService`

`services/features/Email/EmailService.ts` already wraps SMTP / Resend / Disabled providers. Add:

```ts
async sendTemplated<T>(templateId: string, to: string, input: T): Promise<void> {
    const template = templateRegistry.get<T>(templateId);
    const theme = await this.themes.getActive();
    await this.send({
        to,
        subject: template.subject(input),
        html: template.html(input, theme.emailTokens),
        text: template.text(input),
    });
}
```

Audit trail: each send writes to `EmailLog` collection (recipient hash, template id, timestamp, success flag) for ops debugging — but **not** the body content (avoid PII storage).

### Plaintext fallback

Every template ships a plaintext rendition. Plaintext is the source of truth for content (HTML is rendering); if the two drift, the plaintext "wins" for spec.

### Testing — visual baselines

Use **maizzle** or hand-rolled fixture rendering: render each template against fixture inputs into `tests/email-baselines/<templateId>.html`. Commit. Reviewer can preview by opening in a browser. Optional: integrate Litmus or Email on Acid for cross-client rendering tests — paid services, defer until shipping to real users.

## Files to touch

- `services/features/Email/templates/` (new directory)
- `services/features/Email/templates/_shared/layout.ts` (new) — email shell + CSS helpers
- `services/features/Email/templates/_shared/components.ts` (new) — button, divider, progress-stepper
- `services/features/Email/templates/{magicLink,verifyEmail,passwordReset,orderConfirmation,carReservationConfirmation,inquiryAcknowledgement,scheduledPublishFailed,lowStockAlert,savedSearchAlert}.ts` (new)
- `services/features/Email/templates/registry.ts` (new) — keyed lookup
- `services/features/Email/EmailService.ts` — add `sendTemplated()`
- `services/infra/EmailLog.ts` (new) — audit write
- `shared/types/ITheme.ts` — add `emailTokens` subset
- `ui/admin/features/Email/EmailTemplatePreview.tsx` (new) — admin pane to preview each template against fixture data
- `tests/email-baselines/*.html` (new) — committed renderings
- `services/features/Mcp/tools/email.ts` — add `email_sendTemplated` MCP tool for testing

## Starter code

`orderConfirmation` skeleton:

```ts
// services/features/Email/templates/orderConfirmation.ts
import {emailShell, button, divider, progressStepper} from './_shared/layout';
import type {IOrder, IThemeTokens} from '@interfaces/...';

export interface OrderConfirmationInput {
    order: IOrder;
    customerName: string;
    nextStepDate: string;   // e.g. 'Within 24 hours'
    accountUpgradeUrl?: string;  // present only for guest orders
    orderViewUrl: string;
}

export const orderConfirmation = {
    id: 'orderConfirmation',
    subject: (input: OrderConfirmationInput) => `Order ${input.order.orderNumber} confirmed`,
    html: (input: OrderConfirmationInput, theme: IThemeTokens) => emailShell({
        title: `Order ${input.order.orderNumber} confirmed`,
        theme,
        body: `
            <tr><td class="email-pad">
                <h1 style="font-family:${theme.fontFamilyDisplay};color:${theme.colorInk};">Hi ${escape(input.customerName)},</h1>
                <p>We've got your order. Here's where it is:</p>
                ${progressStepper([
                    {label: 'Ordered',    state: 'done',    date: formatTime(input.order.createdAt)},
                    {label: 'Confirmed',  state: 'active',  date: input.nextStepDate},
                    {label: 'Scheduling', state: 'pending', date: 'Within 3 days'},
                    {label: 'Delivered',  state: 'pending', date: '—'},
                ], theme)}
                ${button({label: 'View order', href: input.orderViewUrl}, theme)}
                ${divider(theme)}
                ${orderSummaryTable(input.order, theme)}
                ${input.accountUpgradeUrl ? upgradePrompt(input.accountUpgradeUrl, theme) : ''}
                ${supportBlock(theme)}
            </td></tr>
        `,
    }),
    text: (input) => `Hi ${input.customerName},\n\nWe've got your order ${input.order.orderNumber}.\n\nView: ${input.orderViewUrl}\n\nTotal: ${formatPrice(input.order.total, input.order.currency)}\n`,
    requiredFields: ['order', 'customerName', 'nextStepDate', 'orderViewUrl'],
};
```

## Acceptance

1. Every template renders against fixture data into a `tests/email-baselines/<id>.html` file committed to the repo
2. Manual visual review in Gmail (web + iOS) + Apple Mail + Outlook (web) for each template — checklist documented
3. Mobile rendering at 320 px width verified (Litmus or manual narrow-window)
4. Plaintext fallback present + content-equivalent
5. Visual progress timeline renders correctly in all major email clients (table-based, no flexbox)
6. `EmailService.sendTemplated()` writes to `EmailLog` (recipient hash + template id + timestamp + success — no body)
7. Per-theme tokens consumed; default theme renders correctly; switching theme changes email visuals on next send
8. Order confirmation includes the "save details" upgrade CTA when `input.accountUpgradeUrl` is present (anonymous-checkout case)
9. MCP `email_sendTemplated` tool works against the registry
10. Smoke e2e: trigger order finalize → assert email captured + template id + recipient + subject (using a test email transport that writes to a fixture file rather than sending)

## Effort

**M · ~3 hours AI.**

- Layout helpers + progress stepper + button + divider: ~30 min
- Template registry + sendTemplated: ~15 min
- 9 templates: ~10-15 min each = ~2 hours
- EmailLog + audit: ~15 min
- Admin preview pane: ~20 min
- Tests + baselines: ~30 min

## Dependencies

- Existing `EmailService` + `mailConfig` (already shipped)
- [first-class-themes](first-class-themes.md) for `emailTokens` subset; can ship templates with the default theme first and re-token later

## Open questions

- **[OPERATOR DECISION]** Use a heavier template framework (React Email, MJML) or stay with the hand-rolled approach? Hand-rolled is fine for ~10 templates; switch when we hit 20+ or need component reuse across templates more aggressively. Recommend: stay hand-rolled for now.
- **[OPERATOR DECISION]** Litmus / Email on Acid for cross-client visual tests — paid, ~$80-200/mo. Defer until first real customers? Recommend: defer.

## Out of scope

- Marketing email (campaigns / newsletter). Different deliverability profile, different sender reputation handling. File as a separate item.
- A/B testing of templates — separate item.
- Real-time / live-updating receipts (e.g. WebSocket-backed order status). Email is for delivery confirmation; status flow lives in `/account/orders/<id>`.
