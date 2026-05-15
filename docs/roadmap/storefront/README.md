# Storefront — active items

Public-facing program: theme design pass, PC-parts dropshipping integration, pre-public-deploy gates.

## Active items

| Item | Wave | Size | Status |
|---|---|---|---|
| [first-class-themes.md](first-class-themes.md) | 5 | XL (multi-week) | 3 of 8 themes shipped (`editorial`, `restaurant`, `event`). **Remaining: `local-business`, `saas-landing`, `portfolio`, `agency`, `commerce`.** Each needs Stitch frames + per-module SCSS pass. |
| [pc-parts-dropshipping-integration.md](pc-parts-dropshipping-integration.md) | 7 | XL (~5-7 days AI) | Replaces deleted ss-com-cars spec. EU/UK distributor adapter (TD SYNNEX first; Ingram Micro / Asbis as alternates). No inventory — every order forwards to distributor. Operator partner-account onboarding ≈ 1-2 weeks wall-clock. |
| [accessibility-wcag22-audit.md](accessibility-wcag22-audit.md) | 8a | L (manual passes) | Automated parts shipped (axe-core / Pa11y / Lighthouse a11y gate). **Remaining: operator manual screen-reader passes (NVDA + VoiceOver + JAWS) × every theme × both modes.** Pre-public-deploy blocker. |
| [gdpr-privacy-consent.md](gdpr-privacy-consent.md) | 8b | M (remaining slice) | Consent banner + DNT/GPC + data export + delete-account cascade shipped. **Remaining: operator legal review on `/privacy` + `/terms`, server-side Mongo retention TTL indexes, themed `/privacy/cookies` + `/privacy/preferences` editor surfaces, cookie-coverage CI script.** |
| [email-deliverability-hardening.md](email-deliverability-hardening.md) | 8c | S (operator-action) | Code shipped. **Operator: DNS records (SPF + DKIM + DMARC) + Resend domain verification.** Runbook `docs/runbooks/email-deliverability-setup.md`. |

## Shipped — see [../shipped.md](../shipped.md)

Recent storefront ships:
- W6a receipt + transactional emails (9 templates)
- W6b faceted filter system
- W6c client signup + magic-link + marketing attribution + anonymous checkout
- W8b GDPR consent / cookie / DNT-GPC slice + data-rights API + `/account/settings?tab=privacy`
- W8g multi-currency + tax + ECB FX + VIES + Stripe Tax
- W8f customer notification preferences + RFC 8058 unsubscribe
- W8h SEO program (robots / sitemap / canonical / hreflang / JSON-LD / redirects / preflight / OG)
- W7a cars-vertical modules (now obsolete pending pc-parts-dropshipping cleanup)
- Commerce + auth track: auth-split, Product module + checkoutEnabled, products-as-composable-page, checkout-as-composable-page, client-account-settings + customerType, product-display-templates + 5 built-ins

Cross-references:
- Standards: [../_meta/project-standards-additions-2026-05-12.md](../_meta/project-standards-additions-2026-05-12.md)
- Modules catalogue: [../_meta/new-modules-catalogue.md](../_meta/new-modules-catalogue.md)
- MCP coverage: [../_meta/mcp-coverage-storefront-program.md](../_meta/mcp-coverage-storefront-program.md)
- Research: [../_meta/research-findings-2026-05-12.md](../_meta/research-findings-2026-05-12.md)
