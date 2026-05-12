# Storefront — Waves 5-8

Public-facing program: design system overhaul, customer accounts, third-party inventory ingest, accessibility gating.

| Item | Wave | Size | Status |
|---|---|---|---|
| [first-class-themes.md](first-class-themes.md) | 5 | XL | Active — 8 first-class themes (editorial / agency / commerce / local-business / restaurant / saas-landing / event / portfolio) |
| [storefront-receipt-emails.md](storefront-receipt-emails.md) | 6a | M | Active — receipt + transactional emails as a product surface |
| [storefront-faceted-filter-system.md](storefront-faceted-filter-system.md) | 6b | L | Active — reusable faceted filter for `/cars` + `/products` |
| [client-signup-and-anonymous-checkout.md](client-signup-and-anonymous-checkout.md) | 6c | M-L | Active — delayed account creation, magic-link primary, Mixpanel attribution |
| [ss-com-cars-integration.md](ss-com-cars-integration.md) | 7 | L | Active — ss.com cars as `IWarehouseAdapter`; reservation, not D2C checkout |
| [seo-program.md](seo-program.md) | 6 (cross-cut) | L | Active — site-wide SEO discipline: robots.txt, dynamic sitemap, OG images, canonical + hreflang, schema.org injection, redirects, indexability gating |
| [customer-notification-preferences.md](customer-notification-preferences.md) | 6 (post-signup) | L | Active — per-category opt-in/out, in-app inbox, quiet hours, digest cadence, RFC 8058 one-click unsubscribe |
| [multi-currency-and-tax.md](multi-currency-and-tax.md) | 6-7 | L | Active — multi-currency pricing, daily ECB FX, VAT regime resolver, Stripe Tax + VIES B2B validation |
| [accessibility-wcag22-audit.md](accessibility-wcag22-audit.md) | 8a | L | Pre-public-deploy blocker — WCAG 2.2 AA across all public surfaces |
| [gdpr-privacy-consent.md](gdpr-privacy-consent.md) | 8b | XL | Pre-public-deploy blocker — consent banner, DNT/GPC, data export, delete-account cascade, PII redaction, retention TTLs, privacy policy |
| [email-deliverability-hardening.md](email-deliverability-hardening.md) | 8c | L | Pre-public-deploy blocker — SPF/DKIM/DMARC, Resend domain verify, bounce/complaint webhook, suppression list, send-rate warmup, deliverability dashboard |

Cross-references:
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
- Modules needed: [../_meta/new-modules-catalogue.md](../_meta/new-modules-catalogue.md)
- MCP coverage: [../_meta/mcp-coverage-storefront-program.md](../_meta/mcp-coverage-storefront-program.md)
- Research: [../_meta/research-findings-2026-05-12.md](../_meta/research-findings-2026-05-12.md)
