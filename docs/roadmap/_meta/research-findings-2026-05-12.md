# Research findings — UX, design tokens, marketplaces (2026-05-12)

Consolidated source-of-truth for design + UX decisions across the storefront program. Cite this doc, don't re-research the same questions.

Four research streams ran in parallel: CMS admin UX, checkout + auth UX, used-car marketplace UX, theme design + tokens. Findings below are mapped to the roadmap items that consume them.

---

## 1. CMS admin UX — what 2025-2026 leaders actually ship

### Inline / contextual editing

**Pattern leader:** **Sanity Presentation tool + stega Content Source Maps.** Click any rendered string in a preview iframe → jump to the exact field in the studio. Storyblok ships `_editable` markers + StoryblokBridge (click-to-select highlights block, opens sidebar editor). Gutenberg sets the bar for truly inline typing.

**Empirical reality:** Sidebar-on-click is the dominant model. Full inline-typing is harder, rarer, and brittle. Most CMSes have stopped chasing it.

**Apply to our roadmap:** Ship sidebar-on-click first. Use content-source-map data attributes (`data-edit-target="<schemaPath>"`) so rendered DOM elements know their schema path. **This is the visible payoff of the MCP-driven authoring story** — AI generates a draft, operator clicks to refine.

Sources: [Sanity Visual Editing](https://www.sanity.io/docs/visual-editing/introduction-to-visual-editing), [Storyblok Visual Editor](https://www.storyblok.com/docs/concepts/visual-editor).

### Command palette

**Pattern leader:** Linear (gold standard), Notion, Sanity. Libraries: **cmdk (Vercel)** and **kbar** are the two viable React choices.

**Conventions:**
- `⌘K` to open palette (conflicts with browser "insert link" — pick this anyway, every modern app does)
- `⌘S` save / `⌘↵` publish / `?` open shortcut cheatsheet / `/` inline-search inside lists
- Every menu action gets a kbar entry with its shortcut displayed
- Group by context (Document / Site / Navigation / People)

Sources: [Maggie Appleton — Command K Bars](https://maggieappleton.com/command-bar), [kbar repo](https://github.com/timc1/kbar), [cmdk](https://cmdk.paco.me/).

### Empty states + onboarding

**Pattern leader:** Shopify Polaris (26+ designed empty states across the lifecycle), Basecamp/Dropbox/Evernote (seed workspace with starter docs), Directus (built-in first-run wizard).

**Apply:** Every empty list view = onboarding slot. Illustration + one primary CTA + one "import sample data" link. First login seeds a sample page + sample post + sample product so the operator never sees blank-canvas paralysis.

Sources: [UserOnboard — Empty States](https://www.useronboard.com/onboarding-ux-patterns/empty-states/), [Polaris UI Kit](https://www.figma.com/community/file/1554895871000783188/polaris-ui-kit-community).

### Drag-reorder

**Pattern leader:** **dnd-kit** — WCAG 2.1 AA compliant. KeyboardSensor (arrow keys + space/enter + escape-to-cancel) + TouchSensor with configurable activation delay (200-250ms) + tolerance. Live-region announcements via the `accessibility` prop.

**Apply:** Drop `react-beautiful-dnd` if still used anywhere. Standardise on `@dnd-kit/sortable`. Visible drag handles with `touch-action: none` (so the rest of the row scrolls).

Sources: [dnd-kit Accessibility](https://docs.dndkit.com/guides/accessibility).

### Toasts + optimistic UI

**Pattern leader:** **Sonner.** Used by OpenAI, Adobe, Sonos, default in shadcn/ui. `toast.promise` maps 1:1 onto optimistic mutation lifecycle (loading → success/error in a single transitioning toast). Pairs with React 19 `useOptimistic` + `startTransition`.

**Apply:** Standardise on Sonner. Wrap every network call in `toast.promise`. Always offer **Undo** on destructive optimistic ops (8-10s window). Centralise messages in a `notify*()` helper for i18n.

Sources: [Sonner](https://github.com/emilkowalski/sonner), [LogRocket React toasts 2025](https://blog.logrocket.com/react-toast-libraries-compared-2025/).

### Content Releases (2025 differentiator)

**Pattern leader:** **Sanity Content Releases** (shipped Spring 2025). Group N documents into one release, preview the whole site at that release's "perspective," validate, publish/schedule atomically, roll back. Beats per-entry scheduling.

**Apply:** First-class `Release` object in the schema, not just per-page schedule. Patch-based revision history with named edit events ("published", "edited", "release X"). Always show "what will go live" preview before confirm.

Sources: [Sanity Content Releases](https://www.sanity.io/content-releases), [Sanity Spring Release 2025](https://www.hexdigital.com/news/the-biggest-release-in-sanity-history-spring-release-2025).

### Permissions UX

**Pattern leader:** **Notion 3.0** — four tiers (Full / Edit / Comment / View) at workspace + page level, teamspaces as primary grant unit. Webflow — role presets (Designer, Marketer, Content Editor, Reviewer) + per-CMS-collection grants.

**Apply:** **4 named tiers, not action checkboxes.** Role presets by job. Grant at collection/section boundary, not per-block. Groups as default assignment unit; individual overrides with explicit "overrides inherited" indicator.

Sources: [Notion permissions help](https://www.notion.com/help/sharing-and-permissions), [Notion 3.0 granular permissions](https://notioners.com/notion-30-the-era-of-custom-agents-and-granular-permissions).

### Mobile authoring

**Reality check:** No major headless CMS ships real mobile authoring. Sanity, Contentful, Strapi all rely on responsive web. Contentful explicitly markets "mobile CMS" as content delivery, not authoring.

**Apply:** This is a real differentiation slot for our project. Minimum viable mobile authoring = phone-optimised post composer + photo capture → image module + schedule/publish toggle + approve-from-phone for reviewer roles. Defer full page-builder to tablet (split-pane preview).

---

## 2. Auth + checkout UX

### Anonymous / guest checkout — the data

- **26% of cart abandonment** is caused by forced account creation (Baymard)
- **37% of users actively dislike it** (Baymard)
- **62% of sites bury the guest option; 60% of users struggle to find it** (Baymard)
- Full checkout UX optimisation lifts conversion ~35% — **guest checkout is the single biggest lever**
- Shop Pay (implicit account, one-tap reuse) lifts conversion up to **50% vs guest**, 18% on first-time mobile carts, 5% just from being present (Shopify 2023 study)

**Pattern winner — "delayed account creation":** Let user complete as guest with name + email + address + payment. On the confirmation page or in the receipt email, offer "Set a password to save these details — one click." You already have everything; only the password is new.

Sources: [Baymard — Delayed Account Creation](https://baymard.com/blog/delayed-account-creation), [Baymard — Mobile Checkout](https://baymard.com/blog/mobile-checkout), [Shopify — Shop Pay conversion data](https://www.shopify.com/blog/shop-pay-checkout).

### Magic-link auth

- **TTL: 10-15 min.** Single-use. CSPRNG-generated. Hash at rest (Redis with TTL is ideal). Never `Math.random()`.
- **Notion eliminated passwords entirely in 2019** — account takeover attempts dropped **89%**.
- **Cross-device problem is real** — email clients on mobile pre-fetch links and burn tokens. Mitigation: land on a "Click to sign in" confirmation page in the new browser (don't auto-consume). Bind to coarse fingerprint (IP /24 + device class + cookie set when link was requested).
- **Resend cooldown 60s.** "Didn't get it?" link after 30s surfacing a support email. Don't leak account existence ("If this email is registered, we sent a link").
- **Password coexistence:** Magic link as primary, password optional. Don't force users to pick at signup.

Sources: [Baytech — Magic Links UX/Security 2025](https://www.baytechconsulting.com/blog/magic-links-ux-security-and-growth-impacts-for-saas-platforms-2025), [WorkOS — Magic Links Guide](https://workos.com/blog/a-guide-to-magic-links), [Gupta Deepak — Magic Link Security](https://guptadeepak.com/mastering-magic-link-security-a-deep-dive-for-developers/).

### OAuth UX

- **"Continue with X"** is the safe unified verb (works for both signup + login; Google/Apple/Facebook all permit it)
- **Google requires its button at least as prominent** as competing providers (branding guidelines)
- **Apple requires Sign-in-with-Apple equal prominence on iOS** if any other social login is offered (App Store rules)
- **Order:** Apple → Google → Facebook on iOS; Google → Apple → Facebook on web/Android. Re-order by returning-user history when available.
- **Account-linking on conflict:** If user signs up with Google then tries email/magic-link with same address, link automatically (after email ownership proof). Surface "You signed up with Google — continue with Google?" rather than creating duplicates.

Sources: [Google Branding Guidelines](https://developers.google.com/identity/branding-guidelines), [Facebook Login](https://developers.facebook.com/docs/facebook-login/web/login-button).

### Marketing attribution — model to copy

**Mixpanel's model** (steal this):
- `initial_utm_*` on user profile = **first-touch, permanent**
- UTM as super properties on each event = **last-touch, updates on new touch**
- Auto-merge anonymous → identified sessions on signup/login

GA4 is session-scoped + user-scoped first-touch — less flexible. Mixpanel wins for attribution depth.

**Apply:** Store `firstTouchUtm` (immutable) + `lastTouchUtm` (overwritten) on user record. Also write UTM as event properties on every conversion event for clean multi-touch later. Critical: on anonymous → registered transition, merge attribution from session cookie onto user.

Sources: [Mixpanel — Traffic Attribution](https://help.mixpanel.com/hc/en-us/articles/360001337103-Last-Touch-UTM-Tags), [Mixpanel — Attribution Multi-touch](https://docs.mixpanel.com/docs/features/attribution).

### Receipt email UX (high-AOV)

- **54% open rate, 14% CTR** — highest-engagement message you'll ever send
- **60% open on mobile** — mobile-first design mandatory
- Tone: reassuring + premium + consultative. Not playful, not salesy
- Structure: reassuring headline → order number → **visual progress timeline** (Ordered → Verifying → Scheduling → Delivery) → dated next-step milestones → order summary → **one** focused CTA → support block

The visual progress timeline is the biggest anxiety reducer for high-AOV (cars, furniture).

Sources: [Klaviyo — Order Confirmation](https://www.klaviyo.com/blog/order-confirmation-email-tips-examples), [Braze — Order Confirmation Best Practices](https://www.braze.com/resources/articles/order-confirmation-email).

### Account dashboard

**Baymard finding:** Users are **task-oriented and infrequent** — they don't learn your nav. Flat is better than nested. Max 5-6 cards on dashboard home.

Hierarchy that works:
1. Recent order status (front and center)
2. Orders (full history with reorder)
3. Profile (name, contact, password)
4. Addresses
5. Payment methods
6. Wishlist / browsing history
7. Notification preferences
8. Settings → Privacy → **Delete account** (bottom of settings, destructive styling, password re-entry to confirm)

Sources: [Baymard — Account Dashboard Design Examples](https://baymard.com/ecommerce-design-examples/58-account-dashboard).

---

## 3. Used-car marketplaces — what works, what doesn't

### ss.com facts

- ss.lv rebranded to **ss.com in 2023** after VID (Latvian tax authority) halted the operator. Both domains serve the same content.
- **No public API, no documented RSS, no partner program.** Integration must be HTML scraping with respect for robots.txt + Latvian Personal Data Protection Law. Apify scraper deprecated.
- **URL structure is enumerable**: `https://www.ss.com/{lang}/transport/cars/{brand}/{model}/{deal-type}/` and `https://www.ss.com/msg/{lang}/transport/cars/{brand}/{model}/{ad-id}.html`. Path-segment based, scrapable.
- Languages: LV / EN / RU (EN/RU partial). Currency: EUR everywhere (format `21 990 €`).
- Mobile m.ss.com subdomain exists separately from desktop.
- Filters exposed: make / model / year / price / engine cc / fuel / gearbox / body / drive / color / condition / region (Riga + 25 districts) / deal type.
- **Top user complaint: no multi-select on make/model.** That's the immediate UX win.
- Listing cards are **dense table rows** (not cards). Detail pages: image gallery (3-10 photos, inconsistent quality) → spec table → free-text description → seller phone + message form. **No reserve / no checkout — pure C2C/B2C classified.**

### Western full-storefront marketplaces — what we learned from failures

| Platform | Status | Lesson |
|---|---|---|
| Carvana (US) | Profitable since 2024 | $100 refundable 7-day pre-order; full digital flow (finance, trade-in, delivery, 7-day/400-mi return). Weak spot: title + registration paperwork. **Works only in US scale + captive financing.** |
| Cazoo (UK) | **Collapsed May 2024.** £260M debt, $1.2B losses across 2022-23 | High CAC, used-car price collapse, capital intensity of inventory + reconditioning, lost to Auto Trader (lead-gen). Brand revived April 2025 by MOTORS **as a dealer marketplace, not D2C**. |
| Vroom (US) | Shut e-commerce arm late 2023 | Same capital-intensity failure mode as Cazoo. |
| AutoTrader/CarGurus/Cars.com | Profitable | **Stop at contact form.** Revenue = subscription/lead fees from dealers. Refuse to own inventory because it cannibalises paying customers + destroys SaaS margins. |

**Critical conclusion: end-to-end D2C used-car retail does not scale to profitability outside the US.** Do not attempt Carvana-style for our build.

Auto Trader's COO: "Cars are fundamentally different — people research online, then want to see in person."

### Account model for used-car platforms

| Platform | Account to buy? | Model |
|---|---|---|
| Carvana | Required | First-party retailer |
| CarMax | Required for online | First-party retailer |
| AutoTrader / CarGurus / Cars.com | **No** | Marketplace (dealer handoff) |

**Verdict:** Marketplaces don't force accounts because they don't process payment — they hand off to dealers. For our ss.com integration: **marketplace-style anonymous inquiry → account only at reservation/deposit point.**

### Filter UX patterns specific to cars

- **Layout:** Persistent left sidebar (desktop); full-screen drawer with sticky "Show X results" CTA (mobile).
- **Facet order** (data-driven from Auto Trader / CarGurus / Carvana): Price → Make/Model → Year → Mileage → Body → Location/Distance → Fuel/Transmission/Drive → Color/Features.
- **Range sliders with min/max text inputs** for price, mileage, year. Discrete year, continuous price/mileage.
- **Multi-select** on make/model (the #1 ss.com complaint to fix). Cascading: select Make → Model list filters; allow N makes + N models simultaneously.
- **Live result counts** on each facet; grey out zero-result options. Real-time on desktop, deferred-apply on mobile.
- **Pinned applied-filter chips** at top with one-click removal + "Clear all".
- **Saved searches + email/push alerts** — buying cycle is weeks, not minutes. Table stakes.
- **Map view** for Latvia: lower priority than region multi-select + radius slider from postal code (country is small enough).

Sources: [Baymard — ecommerce filter UI](https://baymard.com/learn/ecommerce-filter-ui), [Cars Commerce — VDP playbook](https://www.carscommerce.inc/website-playbook-chapter-4/).

### Listing detail page (VDP) anatomy

Above-the-fold (no scroll): hero image + title (Year + Make + Model + Trim) + price + monthly-payment estimate + key spec strip (mileage / fuel / gearbox / body / drive) + primary CTA + photo count.

- Photo gallery: **15-20+ photos minimum**, consistent shot order. Photo quantity itself is a trust signal; <8 correlates with lower conversion.
- Trust strip near CTA: history report, VIN, inspection date, accident-free badge, owner count, dealer rating.
- **CTA hierarchy: one primary + 2-3 secondary.** Baymard: reducing CTA count on VDP lifted conversion **+16%**.
- Sticky mobile footer bar with Call / WhatsApp / Message.

### Mobile car shopping

- **70-75% of car-shopping traffic is mobile.** Average shopper spends 33% of research time on mobile.
- Industry digital conversion ~5.7%, but **61% of mobile shoppers convert via phone call** after a search.
- **Click-to-call must be first-class.**
- Leads contacted within 5 min are **21× more likely to convert**; >5 min cuts conversion 80%.

### EU VAT specifics

- **Margin scheme (Directive 2006/112/EC Art. 311-332):** dealers reselling used cars from private sellers charge VAT only on margin, not full price. Invoice must state "margin scheme" and **may not show VAT separately** — buyer cannot reclaim. Dominant regime for Latvian used-car dealers.
- **Cross-border (LV-resident buying from EE/LT/DE):** "Used" per EU VAT = >6 months old AND >6000 km. Otherwise it's a "new means of transport" — VAT due in buyer's country regardless of seller status. Gotcha for low-mileage near-new imports.
- **UX implication:** surface VAT regime as a **listing-level fact** ("Margin scheme — VAT included, not reclaimable" vs "VAT 21% — reclaimable for businesses"). Buyers across EE/LT/LV triangle care about this for resale and corporate purchases.

Sources: [Your Europe — VAT cars](https://europa.eu/youreurope/citizens/vehicles/cars/vat-buying-selling-cars/index_en.htm).

---

## 4. Theme design + design tokens (2026)

### Theme catalogue patterns

| Platform | Theme count | Grouping |
|---|---|---|
| Wix | ~800+ (AI-adapted) | Industry + style |
| Squarespace | ~150 curated | Industry + style |
| Webflow | ~2000+ (Made in Webflow + Cloneables) | Use-case + industry |
| Framer | ~600+ marketplace | Category (Portfolio / SaaS / Agency / Store / Personal) |

Per-template doc on all four: preview, demo URL, "what's included" (pages list), suitable industries, designer credit, feature list. Webflow + Framer also expose CMS-collection structure.

**Apply to roadmap:** **Ship 8 themes, not 5.** Gaps in our original 5:
- **Portfolio / Personal** — #1 category on Framer marketplace, distinct from "agency" (team vs individual)
- **Restaurant / Hospitality** — local-business is too generic; restaurants need menu + reservations + gallery
- Overlap risk: **agency vs SaaS-landing**. Differentiate hard — agency = case-study-led storytelling; SaaS = product-screenshot-led + feature grid + pricing table built-in. Different module sets, not just different colors.

**Final lineup:** Editorial, Agency, Commerce, Local-business, SaaS-landing, Event, **Portfolio**, **Restaurant**. Each ships light + dark, three header variants, three footer variants, full motion token set, mobile baseline 375 px, WCAG 2.2 AA verified.

### Design-token architecture (2026 winner)

**Tailwind v4 `@theme` + CSS custom properties** is winning the niche. Vanilla Extract + Sass tokens losing ground; Open Props hobby-only. Reason: CSS-first config, OKLCH colors, `color-mix()` opacity, AI-tool friendly.

**Hierarchy (3 layers):**
- Primitive — `--blue-500`, `--space-4`, `--font-serif`
- Semantic — `--color-surface`, `--color-accent`, `--space-section`, `--font-display`
- Component — `--btn-primary-bg`, `--card-padding`

**Only the semantic layer overrides per theme.** Primitives stay shared.

**Override strategy:** single file with `[data-theme="editorial"]` selector blocks. Cascade-layer scoping cleaner than file-per-theme.

**Dark mode:** **each theme ships both modes via `light-dark()` CSS function or `[data-mode]`.** Theme = identity (typography, layout, motion). Mode = brightness. Independent axes.

Sources: [Tailwind v4 release](https://tailwindcss.com/blog/tailwindcss-v4), [Wawandco multi-portal theming](https://wawand.co/blog/posts/managing-multiple-portals-with-tailwind/).

### Stitch (Google) — reality check

- Built on Gemini 2.5, free, Google Labs
- Exports clean HTML+Tailwind or JSX, Figma round-trip
- **Reality: 70-90% structurally correct, NOT componentized**, no design tokens auto-applied, no animation export, no brand-guideline awareness
- **Treat Stitch output as a structural draft.** Lift the markup, throw away its inline classes, re-skin against our token system. Don't ship Stitch's classes.

Sources: [Google Stitch review (Index.dev)](https://www.index.dev/blog/google-stitch-ai-review-for-ui-designers), [Stitch → AI Studio workflow](https://www.mindstudio.ai/blog/google-stitch-to-ai-studio-design-to-code-workflow).

### Animation patterns 2025-2026

**Modern stack:**
- CSS `scroll-timeline` + `view-timeline` for fade-in / parallax / sticky-shrink (Chromium-safe, Firefox flag, wrap in `@supports`)
- `animation-trigger` (Chrome 145, late 2025) replaces most IntersectionObserver fade-in code
- View Transitions API for route-to-route morphing (now multi-page in Chrome)
- Motion One for declarative JS animations; Framer Motion only when React-state-driven choreography needed
- Strict `prefers-reduced-motion`: use a duration-scalar token that drops to 0

**Motion token system** (Carbon / Material 3 standard):

```css
--motion-duration-fast: 150ms;        /* button states */
--motion-duration-base: 250ms;        /* card / modal */
--motion-duration-slow: 400ms;        /* page section */
--motion-duration-deliberate: 700ms;  /* hero / page transition */
--motion-ease-standard: cubic-bezier(.4,0,.2,1);
--motion-ease-entrance: cubic-bezier(0,0,.2,1);
--motion-ease-exit:     cubic-bezier(.4,0,1,1);
--motion-ease-emphasized: cubic-bezier(.2,0,0,1);
--motion-distance-sm: 8px;
--motion-distance-md: 24px;
--motion-distance-lg: 64px;
--motion-stagger: 60ms;
--motion-scalar: 1; /* drops to 0 under prefers-reduced-motion */
```

Sources: [MDN scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations), [Carbon Motion](https://carbondesignsystem.com/elements/motion/overview/), [Material 3 motion tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs).

### Header behavior by theme

Pick one per theme:
- **Sticky-static** — short pages, local-business, restaurant
- **Shrink-on-scroll** — commerce, SaaS, agency (Nike/Airbnb pattern)
- **Hide-on-down / show-on-up (Headroom)** — editorial, long-form (Medium pattern)
- **Slim utility bar** — content-heavy editorial

Mobile: drawer + sticky compact bar; ≤50 px height. Mega-menu only for commerce/SaaS with >12 top-level routes. Use `IntersectionObserver` (not scroll listeners) for direction detection.

### Footer taxonomy

- **Minimal / utility** → editorial, SaaS-landing (1 row, legal + social)
- **Multi-column (3-4 cols)** → SaaS, agency, local-business
- **Brand-led XXL** → commerce, event (video bg, oversized wordmark, sign-off)
- **Link-farm / fat** → commerce with deep catalog only

### Logo placement per theme

- **Editorial:** centered wordmark, full-width masthead, hairline below (NYT / Atlantic)
- **Agency:** top-left wordmark or oversized mark, minimal mark on scroll
- **Commerce:** top-left logo, top-center on luxury (Hermès), small mark on shrink
- **SaaS landing:** top-left icon+wordmark lockup, swap to icon-only on shrink
- **Local-business:** top-left full logo, phone/CTA top-right
- **Event:** centered, hero-integrated, often part of the typographic composition

Always ship three variants per theme: **full lockup, icon, monochrome.**

### Accessibility minimums

- **Target WCAG 2.2 AA.** Legally required in EU per EAA / EN 301 549, US ADA Title II deadline **April 2026.**
- **Per-theme checklist:** 4.5:1 text contrast both modes (run APCA preview), visible 2 px focus ring on accent surface, all motion gated on `prefers-reduced-motion`, **44×44 px touch targets**, no info conveyed by color alone.
- WCAG 3 still draft (174 outcomes, March 2026), Recommendation projected 2028-2030 — design for it but don't gate on it.

Sources: [WCAG 2.2 spec](https://www.w3.org/TR/WCAG22/), [WCAG 3 2026 status](https://web-accessibility-checker.com/en/blog/wcag-3-0-guide-2026-changes-prepare).

### Mobile-first baseline

- **Design at 375 px** (iPhone SE still ~5% of traffic)
- Test floor at 320 px
- Foldables: ~400 px cover / 600-768 px unfolded — watch the "foldable gap" (600-834 px), don't let it fall back to mobile layout
- **Container queries** for module-level adaptation; reserve media queries for major layout switches
- Fluid typography via `clamp()`

Sources: [Framer 2026 responsive guide](https://www.framer.com/blog/responsive-breakpoints/), [CSSence breakpoints 2026](https://cssence.com/2026/breakpoints/).

---

## What this changes in the roadmap (summary)

| Roadmap item | Material change |
|---|---|
| first-class-themes | Theme count 5 → **8** (add Portfolio + Restaurant). Token architecture = 3-layer (primitive/semantic/component) with `[data-theme]` blocks. Motion-token system codified. Stitch output is structural draft only. light-dark() for mode. |
| admin-dark-mode-audit | `cssVar: true` is step 1 (already noted). Add light-dark() migration path so per-theme SCSS and admin dark mode use same primitive. |
| ss-com-cars-integration | **Reservation, not full checkout** (Cazoo failure). Marketplace-style anonymous inquiry → account at deposit point. Acquisition path: HTML scrape with rate-limit + ETag + dedupe (no API exists). VAT regime as listing fact. Filter UX = multi-select make/model (#1 ss.com complaint). Reuses existing Inventory adapter system — `SsComCarsAdapter implements IWarehouseAdapter`. |
| client-signup-and-anonymous-checkout | **Delayed account creation** as the only checkout default. Magic-link primary + password optional + Google OAuth equal-prominence. Mixpanel-style first-touch + last-touch attribution. Cross-device pre-fetch mitigation pattern. |
| **New: Sonner toast adoption** | High-ROI quality lift (1 day) |
| **New: Command palette (kbar/cmdk)** | ⌘K + shortcut conventions |
| **New: Inline editing via content-source-maps** | Sanity Presentation-style; aligns with MCP narrative |
| **New: Empty states + onboarding** | First-run seeding + 15 designed empty states |
| **New: Content Releases** | Sanity 2025 differentiator vs Strapi/Payload |
| **New: 4-tier permissions UX** | Notion 3.0 model replacing per-action checkboxes |
| **New: Receipt email as product surface** | 54% open rate, visual progress timeline |
| **New: Faceted filter system** | Used by ss.com cars first, generalises to any product list |
| **New: Motion token system (project standard)** | Carbon/Material 3-shaped tokens, prefers-reduced-motion scalar |
| **New: WCAG 2.2 AA audit** | Pre-public-deploy item; EU EAA legally required |
