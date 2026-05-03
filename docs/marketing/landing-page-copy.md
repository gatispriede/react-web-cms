# Landing page copy

Single source of truth for the marketing landing page text. The TSX in
`ui/client/components/Marketing/` imports constants from `copy.ts`, which
mirrors the strings here. Edit both when iterating copy — the markdown
is the human-readable reference, the `.ts` is what ships.

## Hero

- **Eyebrow:** Built for agencies and multi-tenant hosts
- **Headline:** Your team writes the brief. The CMS builds the pages.
- **Subhead:** An MCP-native CMS. Describe a page in plain English; modules,
  themes and copy land ready to publish. No ticket queue, no developer
  bottleneck.
- **Primary CTA:** Start free trial
- **Secondary CTA:** See how it compares to Contentful

### Animated demo lines (cycle in the hero card)

1. > Create a pricing page with three tiers and a comparison strip.
2. > Add a hero, testimonials grid, and a contact form to /about.
3. > Translate the homepage to German and Latvian.

## Comparison strip

Headline: **Why teams move from Contentful and Builder.io**

Three columns:

1. **MCP-native authoring** — Describe pages in English. The CMS picks
   modules, fills copy, applies the active theme. Contentful and Builder
   still hand you an empty canvas.
2. **Multi-tenant by default** — Per-feature, per-page, per-locale grants.
   Your agency clients log into the same admin and never see each other's
   content.
3. **No developer cost** — Stop paying $5k/mo for a developer to update
   copy. Authoring is the deploy.

## Features

1. **MCP-native authoring** — Connect any MCP-aware client (Claude Code,
   Cursor, Zed). Authoring is a chat, not a ticket.
2. **Scoped multi-tenant grants** — Roles per feature, per page, per locale.
   Agencies onboard clients in minutes, not weeks.
3. **Theme registry + live preview** — Editorial, Studio, Industrial, Paper,
   High-Contrast presets. Swap, fork, preview before publish.
4. **Image pipeline that respects you** — Sharp re-encoding, EXIF strip,
   bulk upload, URL import. No third-party CDN to wire up.
5. **Production caching baked in** — Per-feature versions, ISR, SWR,
   DataLoader. Sub-100ms TTFB on the public site without tuning.
6. **Six-area admin shell** — Build, Content, Configure, Release, Insights,
   Platform. Surfaces are scoped so editors don't see ops controls.

## Pricing

Headline: **Pricing that replaces a developer, not augments one**

### Solo — $129 / month

For a single brand or product site.

- Single site, unlimited pages
- All modules, all themes
- MCP authoring + admin
- Image pipeline + ISR caching
- Email support

CTA: **Start Solo trial**

### Agency — $749 / month — *Most popular*

For agencies and multi-tenant hosts.

- Up to 25 client sites
- Scoped multi-tenant grants
- Per-locale + per-feature roles
- Priority Slack support
- Bundle import / export
- White-label admin shell

CTA: **Start Agency trial**

Footnote: Need more than 25 sites? Talk to us about volume tiers.

## Final CTA

Headline: **Ship the next page in the time it took to file the ticket.**
Body: Free 14-day trial. No credit card. Bring your own MCP client or use
the built-in admin.
Button: Start your trial

## Footer (marketing)

- Product · Docs · Pricing · Contact
- Copyright line: (c) <year> CMS. All rights reserved.
