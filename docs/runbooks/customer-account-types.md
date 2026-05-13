# Customer account types — operator runbook

> Phase 1.E — client-account-settings-page.

This runbook explains how operators configure the customer-side
`/account/settings` surface: which tabs are exposed, what default
account type new sign-ups land on, and how the company-type
verification flow works.

## Per-tenant configuration

All controls live under **Admin → System → Customer account settings**
(`/admin/system/account-settings`). The pane is backed by three
`commerce.*` site flags:

| Flag                                   | Type                                   | Default | Effect |
|----------------------------------------|----------------------------------------|---------|--------|
| `commerce.accountSettingsEnabled`      | boolean                                | `true`  | Master switch — when off, `/account/settings` shows a "settings unavailable" page (still gated by `auth.clientLoginEnabled` upstream). |
| `commerce.defaultCustomerType`         | `'client' \| 'company' \| 'ask'`       | `'client'` | What the signup form pre-selects. `'ask'` shows a banner that forces the user to confirm before submitting. |
| `commerce.accountSettingsHiddenTabs`   | `string[]` of tab names                | `[]`    | Tabs to hide on the settings page. Useful when a tab is irrelevant for this tenant (e.g. hide `payment` on a catalogue-only site). |

Allowed tab names: `profile`, `security`, `addresses`, `payment`,
`notifications`, `privacy`, `language`.

## Type switching

A customer can flip their `customerType` from the Profile tab via the
type switcher radio.

- **client → company** — instant; reveals the company sub-form. No
  data loss.
- **company → client** — fires a confirmation modal warning that
  company data will be archived. The MCP `customer.type.set` tool
  requires `{ack: true}` on this direction. Audit-logged with
  `auditScope: 'customer'`.

Operators can flip a customer's type from the admin via the
`customer.type.set` MCP tool (same input shape — pass `ack: true`
when stepping down).

## VIES verification

When a company-type customer enters an EU VAT ID, the storefront
exposes a **Verify (VIES)** button next to the field. The verifier
returns one of three states:

- `true`  — VAT validated; badge shows green.
- `false` — VAT rejected by VIES; badge shows red.
- `null`  — VIES unreachable; badge shows yellow "pending". The
  storefront does NOT block checkout when VIES is down — per W8g
  recommendation, treat it as "pending verification" and re-check on
  a daily cadence.

The verdict caches on `company.viesVerified` + `company.viesVerifiedAt`
for 24h. Operators can force a re-check via the
`customer.company.viesRefresh` MCP tool.

## Multi-user companies

Out of scope for this jump — one `IUser` per company. The schema
reserves an `ICompanyAccount` expansion path that lets multiple
`IUser` rows link to one company entity (procurement scenarios:
one company, N buyers, one billing account). When that lands the
existing single-user companies migrate transparently.

## Backward compatibility

Legacy customer records with no `customerType` field are treated as
`'client'` implicitly. No migration is required — the discriminator
defaults at read time.

## Related references

- Spec: `docs/roadmap/storefront/client-account-settings-page.md`
- Architecture: `docs/architecture/customer-profile.md`
- Auth stack: `docs/runbooks/auth-stack-split.md`
- VIES verifier: see W8g multi-currency-and-tax docs
