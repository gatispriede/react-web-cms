---
name: email-deliverability-hardening
description: Domain auth (SPF / DKIM / DMARC), Resend domain verification, bounce + complaint handling, suppression list, MX warmup, deliverability monitoring. Magic-link auth and order receipts live or die by this.
research: see _meta/research-findings-2026-05-12.md §2 (magic-link auth UX) — emphasises deliverability as the silent failure mode.
---

# Email deliverability hardening — pre-public-deploy

## Goal

Get email deliverability to production-grade before [client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md) goes public. Magic-link primary auth depends entirely on receipts landing in the inbox (not spam, not dropped).

Scope:

1. **DNS records** — SPF / DKIM (2048-bit) / DMARC quarantine→reject ramp-up, per send domain
2. **Resend domain verification** for the platform's transactional sender + per-site custom sender option
3. **MX / reverse-DNS / TLS** validation pre-send
4. **Bounce + complaint webhook handling** — Resend / Postmark webhook receiver writes to `EmailSuppression` collection
5. **Suppression list** — hard bounces + spam complaints + manual unsubscribes never get a second send
6. **Send-rate warmup** — gradual volume ramp on a fresh domain (1K / 5K / 25K / 100K daily over 4 weeks)
7. **List hygiene** — quarterly re-engagement / pruning workflow for marketing email (when it lands)
8. **Deliverability dashboard** — opens / clicks / bounces / spam-rate per template, alerting if rates drift
9. **Reply-to + List-Unsubscribe** headers on every send (one-click unsubscribe RFC 8058)
10. **Per-customer notification preferences** integration — see [customer-notification-preferences.md](customer-notification-preferences.md)

## Why now

- **Wave 6c signup gates on this.** Magic-link auth that lands in spam is worse than no magic-link at all (silent failure → support load + churn).
- **Receipt email is a product surface** ([storefront-receipt-emails.md](storefront-receipt-emails.md)) with 54% open / 14% CTR target. Deliverability rot drops those to single digits.
- Setting up SPF / DKIM / DMARC after volume has already hit recipient ISPs is harder + slower than doing it pre-launch.

## Design

### Sender identity model

Two-tier:

- **Platform default sender** — `noreply@cms.<platformdomain>` for all sites that don't configure their own. Authenticated via platform's own DNS records. Branded as the platform.
- **Per-site custom sender** — site flag `mailConfig.customSenderDomain`. Operator adds DNS records on their own domain; CMS verifies. Branded as the site.

Resend supports multiple sending domains via their API; one Resend account, N domains, per-message `From` selection.

### DNS records template

For a custom sender at `funisimo.pro`:

```
# SPF — authoritative list of allowed senders
funisimo.pro.   TXT   "v=spf1 include:_spf.resend.com -all"

# DKIM — signing key (Resend generates per domain)
resend._domainkey.funisimo.pro.   TXT   "v=DKIM1; k=rsa; p=<2048-bit-public-key>"

# DMARC — start at quarantine for 14 days, then reject; align with strict
_dmarc.funisimo.pro.   TXT   "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@funisimo.pro; ruf=mailto:dmarc@funisimo.pro; adkim=s; aspf=s; sp=quarantine"

# BIMI — optional brand-logo display (post-DMARC reject)
default._bimi.funisimo.pro.   TXT   "v=BIMI1; l=https://funisimo.pro/logo.svg"
```

Ramp: `p=none` → `p=quarantine; pct=25` (week 1) → `pct=50` (week 2) → `pct=100` (week 3) → `p=reject` (week 4 if zero unauthorised). Admin pane surfaces the recommended ramp + which step we're on.

### Admin pane

`/admin/system/email/deliverability` (extends existing email config pane):

- **Domain status** — green/yellow/red per record (SPF ✓ DKIM ✓ DMARC quarantine 25%)
- **Verification button** — re-runs Resend verification + DNS lookup
- **Send a test** — to operator's email, includes "view headers" link
- **Suppression list** — searchable, manual add / remove + bulk import
- **Recent activity** — last 100 sends with status (delivered / bounced / complained / opened)
- **Per-template metrics** — 7-day open rate / click rate / bounce rate / spam-rate per template
- **DMARC reports inbox** — operator-uploadable XML / aggregated view of aggregate reports (`rua=`) parsed into a readable table

### Bounce + complaint handling

Resend webhook endpoint at `/api/email/webhook`:

```ts
// services/features/Email/webhookHandler.ts
export async function handleWebhook(req, res) {
    const sig = req.headers['svix-signature'];
    const event = verifyAndParse(req.body, sig); // throws on bad sig
    switch (event.type) {
        case 'email.bounced':
            if (event.data.bounce_type === 'hard') {
                await suppression.add(event.data.to, {kind: 'hard-bounce', reason: event.data.diagnostic});
            }
            // soft bounces increment a counter; 5 in 30d → suppress
            break;
        case 'email.complained':
            await suppression.add(event.data.to, {kind: 'spam-complaint', reportedAt: new Date()});
            break;
        case 'email.delivered':
        case 'email.opened':
        case 'email.clicked':
            await emailLog.recordEvent(event.data.message_id, event.type);
            break;
    }
    res.status(200).end();
}
```

`EmailService.send()` checks `suppression.isSuppressed(to)` before delivery. Suppressed recipients log the send attempt + reason but no email is dispatched.

### Suppression list

```ts
// shared/types/IEmailSuppression.ts
interface IEmailSuppression {
    email: string;            // primary key (normalised)
    kind: 'hard-bounce' | 'spam-complaint' | 'manual-unsubscribe' | 'operator-block';
    reason?: string;
    addedAt: string;
    addedBy?: string;         // 'webhook:resend' | userId
}
```

Manual override at `/admin/system/email/suppression`: operator can remove from suppression after verifying with the recipient (e.g. they changed mailboxes; old address bounced for other reasons).

### One-click unsubscribe

Every email carries `List-Unsubscribe` headers + a one-click link:

```
List-Unsubscribe: <https://funisimo.pro/unsubscribe?token=xyz>, <mailto:unsubscribe@funisimo.pro?subject=unsubscribe-xyz>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

Token is single-use, 90-day TTL, hashed at rest. Clicking adds to suppression with `kind: 'manual-unsubscribe'`. RFC 8058 compliant — Gmail/Yahoo require this from 2024.

### Send-rate warmup

Per-domain rate limiter. New domains start at 1K/day; ramp daily:

```
Day 1-3:    1,000
Day 4-7:    5,000
Day 8-14:   25,000
Day 15-21:  100,000
Day 22+:    unrestricted
```

Backed off if bounce-rate > 2% or spam-rate > 0.1% (Gmail's published thresholds). Admin sees the warmup curve + can pause / override with audit trail.

### Deliverability dashboard

`/admin/marketing/deliverability`:

- Live counters (sends today / delivered / bounced / complained / opened / clicked)
- 30-day trend chart per metric
- Per-template breakdown
- DMARC aggregate report ingest (XML upload + auto-parse)
- Alerts on:
  - Bounce-rate > 1% in any 24h window
  - Spam-rate > 0.05% in any 24h window
  - DMARC pct > 0 with > 5% reject in aggregate reports
  - Domain verification regression (Resend reports record no longer valid)

Alerts route through existing Sonner toast pattern + `notifications` MCP tool.

## Files to touch

- `services/features/Email/EmailService.ts` — extend with suppression check + per-domain rate limiter
- `services/features/Email/suppression.ts` (new)
- `services/features/Email/webhookHandler.ts` (new) + API route `/api/email/webhook`
- `services/features/Email/warmupRateLimiter.ts` (new)
- `services/features/Email/dmarcReportParser.ts` (new)
- `services/features/Email/deliverabilityMetrics.ts` (new — aggregates from `EmailLog`)
- `shared/types/IEmailSuppression.ts` (new)
- `shared/types/IDmarcAggregateReport.ts` (new)
- `ui/admin/features/EmailDeliverability/` (new directory)
- `ui/admin/features/EmailDeliverability/DomainStatus.tsx` (new)
- `ui/admin/features/EmailDeliverability/SuppressionList.tsx` (new)
- `ui/admin/features/EmailDeliverability/MetricsDashboard.tsx` (new)
- `ui/admin/features/EmailDeliverability/EmailDeliverabilityAdminUILoader.ts` (new)
- `ui/admin/features/EmailDeliverability/EmailDeliverabilityViewModel.ts` (new)
- `ui/client/pages/api/email/webhook.ts` (new)
- `ui/client/pages/unsubscribe.tsx` (new — one-click unsubscribe landing)
- `services/features/Mcp/tools/emailDeliverability.ts` (new — `email_suppression_*`, `email_metrics_*`, `email_warmup_*`)
- `runbooks/email-deliverability.md` (new — operator runbook: set up DNS, verify with Resend, monitor)
- Tests: webhook signature verification, suppression check, warmup rate limiter, DMARC parser

## Starter code

Warmup rate limiter:

```ts
// services/features/Email/warmupRateLimiter.ts
import {Collection} from 'mongodb';

const RAMP = [
    {until: 3,  cap: 1_000},
    {until: 7,  cap: 5_000},
    {until: 14, cap: 25_000},
    {until: 21, cap: 100_000},
    {until: Infinity, cap: Infinity},
];

export class WarmupRateLimiter {
    constructor(private readonly counters: Collection, private readonly startDates: Collection) {}

    async canSend(domain: string): Promise<{ok: boolean; remaining: number; capToday: number}> {
        const start = await this.getOrSetStartDate(domain);
        const day = Math.floor((Date.now() - start) / 86_400_000);
        const cap = RAMP.find((r) => day <= r.until)!.cap;
        const today = todayIso();
        const counter = await this.counters.findOne({domain, day: today});
        const sent = counter?.count ?? 0;
        return {ok: sent < cap, remaining: Math.max(0, cap - sent), capToday: cap};
    }

    async recordSend(domain: string): Promise<void> {
        const today = todayIso();
        await this.counters.updateOne(
            {domain, day: today},
            {$inc: {count: 1}, $setOnInsert: {createdAt: new Date()}},
            {upsert: true},
        );
    }

    private async getOrSetStartDate(domain: string): Promise<number> {
        const existing = await this.startDates.findOne({domain});
        if (existing) return existing.start;
        await this.startDates.insertOne({domain, start: Date.now()});
        return Date.now();
    }
}
```

Webhook signature verification (Resend uses svix):

```ts
import {Webhook} from 'svix';

const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET!);

export function verifyAndParse(rawBody: string, headers: Record<string, string>): ResendWebhookEvent {
    return wh.verify(rawBody, headers) as ResendWebhookEvent;
}
```

## Acceptance

1. SPF + DKIM (2048-bit) + DMARC quarantine-25% records published on the platform's default sender domain + at least one customer custom-sender domain (funisimo.pro)
2. Domain verification UI shows green per record
3. Hard bounce / spam complaint via webhook auto-adds to suppression; subsequent sends to that recipient are blocked + logged
4. One-click `List-Unsubscribe` header on every send; clicking adds to suppression
5. Send-rate warmup enforces per-day cap; admin can see + override
6. Deliverability dashboard shows live counters + 30d trend + per-template breakdown + DMARC aggregate parse
7. Alerts fire (via Sonner toast + MCP notification) when bounce > 1% / spam > 0.05% / DMARC reject > 5%
8. Operator runbook covers DNS setup + Resend verification + warmup monitoring + post-launch ramp-up
9. MCP coverage: `email_deliverability_*` tools for suppression list management + metric queries + DNS verification + warmup config

## Effort

**L · ~6-8h AI.**

- Suppression service + webhook handler + signature verify: ~2h
- Warmup rate limiter + EmailService integration: ~1.5h
- DMARC aggregate report parser: ~1h
- Admin dashboard pane + per-template metrics: ~2h
- Unsubscribe landing page + List-Unsubscribe header wiring: ~30min
- Runbook + tests: ~1h

DNS setup itself is wall-clock (5-10 min per domain + propagation wait, not in the AI budget).

## Dependencies

- [storefront-receipt-emails.md](storefront-receipt-emails.md) — templates exist + log entries already write
- Existing `EmailService` + `mailConfig` (shipped)
- Resend account + webhook secret (operator wall-clock)
- DNS access on each custom-sender domain (operator wall-clock)

## Open questions

- **[OPERATOR DECISION]** Resend tier — Free (3K/mo, ok for POC) vs Pro ($20/mo, 50K/mo). Recommend: Pro at launch given magic-link primary auth.
- **[OPERATOR DECISION]** BIMI (brand-logo in inbox) — costly (VMC certificate ~$1k/yr); defer until brand recognition justifies it. Recommend: defer.
- **[OPERATOR DECISION]** Postmark as fallback ESP — single-provider lock-in is a risk. Multi-ESP support is L extra. Recommend: defer until Resend incident actually bites.

## Out of scope

- Marketing email campaigns (subscriber lists, drip campaigns, segmentation) — separate item; different deliverability profile
- Inbound email parsing (replies-to-receipts) — separate item if inbound becomes a flow
- SMS / push notification deliverability — separate channels
- Self-hosted SMTP (Postfix / Mailcow) — adds ops burden; stick with ESP
