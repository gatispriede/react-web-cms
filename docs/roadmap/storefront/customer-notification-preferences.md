---
name: customer-notification-preferences
description: Per-customer notification preference center — email category opt-in / opt-out, in-app notification settings, channel routing (email / in-app / future SMS / future push), unsubscribe + resubscribe flow. The half of receipt-emails the signup item touched but didn't fully spec.
research: see _meta/research-findings-2026-05-12.md §2 (account dashboard hierarchy) + §1 (notification UX).
---

# Customer notification preferences

## Goal

A customer-controlled preference center for notifications across all channels. Today notifications are best-effort: receipts go to whoever bought, saved-search alerts go to whoever saved, no one can opt out short of cancelling their account.

Scope:

1. **Per-category opt-in/out** — transactional (mandatory, can't disable except by deleting account) / order updates / saved-search alerts / wishlist alerts / marketing (default off)
2. **Channel routing** — email (default), in-app inbox (default), future SMS (stub), future push (stub)
3. **Unsubscribe + resubscribe flow** — one-click from email + preference-center toggle
4. **Operator-side broadcast respects preferences** — sending a "system" announcement only routes to customers with marketing opt-in
5. **Audit-tracked preference changes** — operator can debug "why didn't customer X receive Y email"
6. **In-app inbox** — sibling channel to email; customer sees notifications at `/account/inbox` with read / unread state

## Why now

- [client-signup-and-anonymous-checkout.md](client-signup-and-anonymous-checkout.md) mentions notification prefs but doesn't spec them.
- [storefront-faceted-filter-system.md](storefront-faceted-filter-system.md) saved-search alerts need a channel + cadence pref.
- [storefront-receipt-emails.md](storefront-receipt-emails.md) needs an opt-out trigger that's better than the global suppression list (which is bounce-driven).
- [email-deliverability-hardening.md](email-deliverability-hardening.md) one-click unsubscribe writes to this preference center, not just the deliverability suppression.
- Lacking a preference center forces customers to "delete account or live with the spam" — bad UX + signal to ESPs that we're spammy.

## Design

### Categories

```ts
// shared/types/INotificationPreferences.ts
export type NotificationCategory =
    | 'transactional'        // receipts, order status, magic-link auth — mandatory
    | 'order-updates'        // shipping, delivery, refund — opt-out allowed
    | 'saved-search-alerts'  // new cars matching saved search — opt-out allowed
    | 'wishlist-alerts'      // price drop, back-in-stock — opt-out allowed
    | 'marketing'            // newsletters, campaigns — default off, opt-in required
    | 'product-announcements';// new feature, platform updates — default off in EU

export type NotificationChannel = 'email' | 'in-app' | 'sms' | 'push';

export interface INotificationPreferences {
    byCategoryChannel: Record<NotificationCategory, Record<NotificationChannel, boolean>>;
    digestCadence?: {
        savedSearch?: 'instant' | 'daily' | 'weekly';
        wishlist?: 'instant' | 'daily' | 'weekly';
        marketing?: 'daily' | 'weekly' | 'monthly';
    };
    quietHours?: {
        start: string;     // 'HH:mm'
        end: string;
        timezone: string;  // IANA
    };
    updatedAt: string;
}
```

Defaults per jurisdiction (resolved at signup from IP):

| Category | EU default | US default | Always overridable? |
|---|---|---|---|
| transactional | email + in-app on | email + in-app on | NO — must delete account |
| order-updates | email + in-app on | email + in-app on | YES |
| saved-search-alerts | email + in-app on | email + in-app on | YES |
| wishlist-alerts | email + in-app on | email + in-app on | YES |
| marketing | all off | all off | YES (explicit opt-in required either way) |
| product-announcements | all off | email on | YES |

SMS + push are off everywhere v1 (channels not implemented; preserved as enum slots).

### Send-time check

Every `EmailService.sendTemplated()` call passes a `category: NotificationCategory`. Pre-send:

```ts
async function send(input: SendInput) {
    if (input.category !== 'transactional') {
        const prefs = await prefService.getForRecipient(input.to);
        if (!prefs?.byCategoryChannel[input.category]?.email) {
            // skip — log to EmailLog as 'suppressed-by-preference'
            await emailLog.skipped({...input, reason: 'category-opt-out'});
            return;
        }
        if (isInQuietHours(prefs.quietHours, new Date())) {
            // schedule for after quiet hours instead of dropping
            await queueAfterQuiet(input, prefs.quietHours);
            return;
        }
    }
    // …actual send
}
```

In-app inbox always receives a copy of every notification regardless of email opt-out (channels are independent). Customers who opt-out of email but log in occasionally still see their order updates.

### In-app inbox

`/account/inbox` (new). Customer sees a chronological list of notifications:

- Bell icon in account dashboard header with unread count
- Each entry: timestamp + category badge + title + body preview + actions ("View order" / "View listing" / mark read / delete)
- Filter by category + read/unread state
- Bulk mark-as-read
- 90-day retention; older auto-archived to a separate "Archive" view

Backed by `Notifications` collection:

```ts
interface INotification {
    id: string;
    customerId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    actionUrl?: string;
    actionLabel?: string;
    metadata?: Record<string, unknown>;  // template-specific
    deliveredChannels: NotificationChannel[];  // which channels actually delivered
    readAt?: string;
    archivedAt?: string;
    createdAt: string;
}
```

Real-time updates via existing Presence feature's WebSocket channel (already shipped).

### Preference center UI

`/account/settings/notifications` — matrix view:

```
Category                 Email  In-app  SMS    Push
─────────────────────────────────────────────────────
Transactional            ✓ ✗   ✓ ✗    —       —
                         (locked — required for service)

Order updates            ✓     ✓      —       —
Saved-search alerts      ✓     ✓      —       —
  Cadence:               [Instant ▾]
Wishlist alerts          ✓     ✓      —       —
  Cadence:               [Daily   ▾]
Marketing                ☐     ☐      —       —
  Cadence:               [Weekly  ▾]
Product announcements    ☐     ☐      —       —

Quiet hours              [22:00] to [08:00]  Timezone: Europe/Riga
─────────────────────────────────────────────────────
                                              [Save]
```

SMS + Push columns greyed out v1 with "Coming soon" tooltip.

### Unsubscribe + resubscribe

Email footer links:

- **Unsubscribe from this** — sets that single category to off
- **Manage preferences** — deep-link to `/account/settings/notifications?token=<one-time>` (works for guest-order recipients without an account by binding the token to `guestEmail`)
- **Unsubscribe from all** — one-click; sets every non-transactional category to off across all channels

One-click compliance (Gmail / Yahoo 2024 rules): the `List-Unsubscribe` header (set per [email-deliverability-hardening.md](email-deliverability-hardening.md)) writes a global "marketing off" preference. Bouncing customers stay subscribed to transactional.

Resubscribe: any future preference-center action re-enables; suppression-list precedence (hard bounces / spam complaints from deliverability item) still wins.

### Guest-recipient preferences

Customers without accounts (guest checkout) get a preference scoped to `guestEmail`. Stored separately in `GuestNotificationPreferences` keyed by email hash. Merged into a `User.preferences` on signup upgrade.

### Operator broadcast

`/admin/marketing/broadcast` (new — out-of-scope of THIS item; flagged for future). When operator sends a system announcement, the broadcast pipeline reads each customer's `product-announcements` preference. Estimate of recipient count shown before send.

### Audit

Every preference change writes to `Audit` with kind `customer.preferences.change`, before/after JSON, who changed it (customer self, operator support). Operator can answer "why didn't customer X get the email" by inspecting the audit trail + per-recipient `EmailLog` entries.

## Files to touch

- `shared/types/INotificationPreferences.ts` (new)
- `shared/types/INotification.ts` (new)
- `services/features/NotificationPreferences/NotificationPreferencesService.ts` (new)
- `services/features/NotificationPreferences/NotificationPreferencesServiceLoader.ts` (new)
- `services/features/NotificationPreferences/digestCadenceWorker.ts` (new — collapses instant queue into daily/weekly digests per cadence)
- `services/features/NotificationPreferences/quietHoursQueue.ts` (new — defers sends past quiet hours)
- `services/features/Email/EmailService.ts` (extend) — preference check + skipped logging
- `services/features/Email/templates/_shared/footer.ts` (extend) — unsubscribe + manage-preferences links per category
- `services/features/Notifications/NotificationsService.ts` (new — in-app inbox writes)
- `services/features/Notifications/NotificationsServiceLoader.ts` (new)
- `ui/client/features/CustomerAccount/NotificationPreferences.tsx` (new)
- `ui/client/features/CustomerAccount/InboxPage.tsx` (new — `/account/inbox`)
- `ui/client/features/CustomerAccount/InboxBellIcon.tsx` (new — unread counter in dashboard header)
- `ui/client/pages/unsubscribe.tsx` (extend per [email-deliverability-hardening.md](email-deliverability-hardening.md)) — accept category param for granular unsubscribe
- `services/features/Mcp/tools/notifications.ts` (new — `notification_pref_get`, `notification_pref_set`, `notification_send`, `notification_list`, `notification_markRead`)
- Tests: send-time preference check, quiet-hours queue, digest cadence, in-app + email parallel delivery, unsubscribe flow, guest→customer pref merge on upgrade

## Starter code

Send-time check helper:

```ts
// services/features/Email/sendWithPreference.ts
export async function sendWithPreference(
    email: EmailService,
    prefs: NotificationPreferencesService,
    log: EmailLog,
    input: SendInput & {category: NotificationCategory},
): Promise<{ok: boolean; reason?: string}> {
    if (input.category === 'transactional') {
        // Always send; transactional is mandatory
        await email.send(input);
        return {ok: true};
    }
    const p = await prefs.getForRecipient(input.to);
    if (!p?.byCategoryChannel[input.category]?.email) {
        await log.skipped({...input, reason: 'category-opt-out'});
        return {ok: false, reason: 'opted-out'};
    }
    if (p.quietHours && isInQuietHours(p.quietHours, new Date())) {
        await prefs.queueAfterQuiet(input, p.quietHours);
        return {ok: true, reason: 'queued-past-quiet'};
    }
    await email.send(input);
    return {ok: true};
}
```

Inbox real-time update via Presence channel:

```ts
// services/features/Notifications/NotificationsService.ts
async create(input: CreateNotificationInput): Promise<string> {
    const id = guid();
    const doc: INotification = {
        id,
        customerId: input.customerId,
        category: input.category,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.metadata,
        deliveredChannels: [],
        createdAt: nowIso(),
    };
    await this.notificationsDB.insertOne(doc);
    // push to in-app subscribers via Presence
    this.presence.broadcast(`customer:${input.customerId}:notifications`, {type: 'new', notification: doc});
    return id;
}
```

## Acceptance

1. New customer signup defaults notifications per jurisdiction matrix
2. Preference center matrix renders + saves; transactional category is locked
3. Quiet hours defer sends; deferred messages deliver after the window
4. Digest cadence collapses N instant alerts into one daily / weekly summary
5. Email footer unsubscribe link sets the category to off + redirects to preference center
6. One-click `List-Unsubscribe` from email = all marketing off across channels
7. In-app inbox at `/account/inbox` shows real-time new notifications via Presence channel
8. Bell icon in dashboard header shows unread count
9. Guest-recipient preferences upgrade-merge into customer record on signup
10. Operator can query "why didn't customer X get email Y" via audit + EmailLog
11. MCP coverage: `notification_*` tools for pref CRUD + send + list + markRead

## Effort

**L · ~6-7h AI.**

- Schema + service + defaults per jurisdiction: ~1h
- Preference center UI: ~1.5h
- In-app inbox + bell + Presence real-time: ~1.5h
- Send-time check + quiet-hours queue + digest worker: ~1.5h
- Email footer + unsubscribe landing: ~30 min
- Audit hooks + MCP tools + tests: ~1h

## Dependencies

- [client-signup-and-anonymous-checkout.md](client-signup-and-anonymous-checkout.md) — customer accounts + `IUser`
- [storefront-receipt-emails.md](storefront-receipt-emails.md) — templates pass `category` arg
- [email-deliverability-hardening.md](email-deliverability-hardening.md) — `List-Unsubscribe` header writes here
- Existing `Presence` feature (shipped) — real-time inbox updates
- Existing `Audit` feature (shipped)

## Open questions

- **[OPERATOR DECISION]** Jurisdiction detection — IP geo at signup (recommended) or self-declared in profile? Recommend: IP at signup, customer can override in profile.
- **[OPERATOR DECISION]** Quiet hours opt-in — site-wide default on or off? Recommend: off by default; opt-in via preference center.
- **[OPERATOR DECISION]** SMS + push channels — show as "Coming soon" with disabled toggles (recommended) or hide entirely until shipped? Recommend: show greyed out; sets expectation + reduces "where's SMS?" support.
- **[OPERATOR DECISION]** Marketing broadcast pane — file as a separate roadmap item or fold into this? Recommend: separate; this item ships the preference center, not the send-side.

## Out of scope

- SMS channel implementation (Twilio / Vonage) — separate item
- Push notification channel (web push / mobile) — separate item
- Marketing broadcast / send-side UI for operators — separate item
- Segmentation / cohort-targeted notifications (e.g. "all customers who bought a BMW in 2024") — separate item; needs an analytics-backed audience builder
- A/B testing of notification copy — separate item
- Browser-side notification banner (in-page floater for new inbox entry without page reload) — fold into in-app inbox real-time work
