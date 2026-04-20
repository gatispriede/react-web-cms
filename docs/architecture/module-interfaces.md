# Section-module content interfaces

Snapshot of every public section component's content JSON shape, as of 2026-04-20. Use this when building or reworking a content bundle — the `item.content` string in any bundle is a JSON serialisation of the relevant `I<Name>` shape below, and `item.type` is the matching `EItemType` enum value.

Source of truth: [`src/frontend/components/SectionComponents/`](../../src/frontend/components/SectionComponents/). If in doubt, grep `export interface I` / `export enum E` on those files.

## Bundle item envelope

Every section item (a single block inside a section's `content` array) has this shape:

```json
{
  "type": "HERO",
  "style": "editorial",
  "content": "{\"headline\":\"...\",\"subtitle\":\"...\"}",
  "action": "none",
  "actionType": "TEXT",
  "actionStyle": "default",
  "actionContent": "{}"
}
```

- `type` — `EItemType` string (e.g. `HERO`, `TIMELINE`, `SERVICES`).
- `style` — one of the module's `EStyle` enum values.
- `content` — JSON string of the module-specific shape below.
- `action` / `actionType` / `actionStyle` / `actionContent` — secondary "action" handler (mostly `none` / `TEXT` / `default` / `{}`).

---

## HERO

**EItemType**: `HERO`. Styles: `default`, `centered`, `compact`, `editorial`.

Content:
- `eyebrow?: string` — small-caps label above the headline.
- `headline: string` — main headline (required).
- `headlineSoft?: string` — italic/soft second line.
- `titles?: string[]` — A / B / C separator row.
- `subtitle: string` — prose subtitle (required in the class defaults, but an empty string is fine).
- `tagline: string` — italic tagline.
- `taglineAttribution?: string` — attribution under the tagline (e.g. `— personal motto`).
- `bgImage: string` — CSS background image URL.
- `accent: string` — accent colour hex.
- `portraitLabel?: string` — short label inside the portrait placeholder (e.g. `GP`).
- `portraitImage?: string` — overrides the placeholder with a real image URL.
- `meta?: IHeroMeta[]` — definition-list pairs `{label, value}` (Based / Years / Mode / Stack).
- `coords?: IHeroCoord[]` — `{label, value, liveTime?}`. `liveTime: true` renders Europe/Riga current time.
- `ctaPrimary?`, `ctaSecondary?: IHeroCta` — `{label, href?, primary?}`.

Recently added markup: title/subtitle/tagline support `*word*` for italic-accent runs (renderAccentRuns).

---

## TIMELINE

**EItemType**: `TIMELINE`. Styles: `default`, `alternating`, `editorial`, `minimal` (collapses the left period column).

Content:
- `entries: ITimelineEntry[]`.

`ITimelineEntry`:
- Required: `start`, `end`, `company`, `role`.
- Optional: `location`, `domain`, `contractType`, `experience: string[]`, `achievements: string[]`, `quote`.
- **Recently added (2026-04-20)**: `experienceTitle?: string`, `achievementsTitle?: string` — per-entry overrides for the default `"Experience in"` / `"Key achievements"` headings. Empty/missing falls back to defaults.

Bundle note: old bundles with only `start/end/company/role/experience/achievements` still parse — the new title fields are optional.

---

## SKILL_PILLS

**EItemType**: `SKILL_PILLS`. Styles: `default`, `compact`, `matrix` (animated bar + 0–10 score), `stack-grid` (6-col tech stack).

Content:
- `category: string` — group label (e.g. "Frontend").
- `categoryMeta?: string` — small subtitle (e.g. "08 entries").
- `items: Array<string | ISkillPillItem>` — `items` is heterogeneous: strings or `{label, score?, category?, featured?}`.

---

## SERVICES

**EItemType**: `SERVICES`. Styles: `default`, `numbered`, `grid` (3-col card grid with icon + tags, Industrial).

Content:
- `sectionNumber?`, `sectionTitle?`, `sectionSubtitle?` — section header.
- `rows: IServiceRow[]`.

`IServiceRow`:
- Required: `number`, `title`, `description`.
- Optional: `ctaLabel`, `ctaHref`, `iconGlyph` (single emoji/glyph, grid mode), `tags: string[]` (chip row, grid mode).

Titles support `*word*` for italic-accent runs.

---

## TESTIMONIALS

**EItemType**: `TESTIMONIALS`. Styles: `default`, `cards` (3-col grid).

Content:
- `sectionTitle?`, `sectionSubtitle?`.
- `items: ITestimonial[]`.

`ITestimonial`: `{quote, name, role?, avatarInitial?}`. `avatarInitial` defaults to first character of `name` when absent.

---

## PROJECT_GRID

**EItemType**: `PROJECT_GRID`. Styles: `default`, `studio` (2-col cards with coloured gradient covers + art letters).

Content:
- `sectionNumber?`, `sectionTitle?`, `sectionSubtitle?`.
- `items: IProjectGridItem[]`.

`IProjectGridItem`:
- Required: `title`.
- Optional: `stack`, `kind` (allows HTML `<br/>` for 2-line sublabel), `year`, `coverArt` (defaults to first 2 chars of `title`), `coverColor` (any CSS background — gradient, image, solid), `moreLabel`, `href`.

---

## MANIFESTO

**EItemType**: `MANIFESTO`. Styles: `default`.

Content:
- `body: string` — main paragraph. Markup: `*word*` → italic-accent; `{{chip:KEY:LABEL}}` → rounded pill with thumb circle + label.
- `addendum?: string` — smaller sans-serif paragraph underneath.
- `chips?: IManifestoChip[]` — `{key, thumb, color?}`. Looked up by `key` in `{{chip:KEY:LABEL}}` tokens.

---

## STATS_CARD

**EItemType**: `STATS_CARD`. Styles: `default`, `panel` (dark panel, yellow accent rule left — Industrial).

Content:
- `tag?`, `title?`.
- `stats: IStatsCardStat[]` — `{value, label}`.
- `features?: IStatsCardFeature[]` — `{text}` — optional checklist below stats.

---

## LIST

**EItemType**: `LIST`. Styles: `default` (bulleted), `facts` (key/value with dashed rules — Dossier Contact/Signals), `inline` (flex row of label+value chips), `cases` (2-col project cards — Industrial).

Content:
- `title?: string`.
- `items: IListItem[]`.

`IListItem`:
- Required: `label`.
- Optional: `value`, `href`.
- **Added for cases mode**: `prefix` (accent-coloured prefix above title, e.g. `2024`), `prefixSub` (small secondary prefix, e.g. `— TAGAD`), `meta` (small mono/caps sub-label under title), `tags: string[]` (chip row under description).

---

## GALLERY

**EItemType**: `IMAGE` (note: Gallery and PlainImage both map to `IMAGE` under different styles). Styles: `default`, `marquee` (infinite horizontal strip, pause on hover), `logo-wall` (marquee without captions), `hazard-strip` (accent-bg ticker — Industrial).

Content:
- `items: IGalleryItem[]`.
- `disablePreview: boolean`.

`IGalleryItem`: `{alt, src, preview, text, height, imgWidth, imgHeight, textPosition}`. `textPosition` is `"TOP" | "BOTTOM"` (uppercase string literal).

---

## RICH_TEXT

**EItemType**: `RICH_TEXT`. Styles: `default`, `centered-boxed`.

Content: `{value: string}` — HTML string, sanitised on render.

---

## PLAIN_TEXT

**EItemType**: `TEXT`. Styles: `default`, `centered`, `centered-boxed`.

Content: `{value: string}` — plain text, supports `tApp` translation keys.

---

## PLAIN_IMAGE

**EItemType**: `IMAGE` (same enum as Gallery — disambiguated by style). Style: `default`.

Content: `{src, alt, description (HTML), height, preview, imgWidth, imgHeight, useAsBackground, imageFixed, useGradiant, offsetX}`.

---

## CAROUSEL

**EItemType**: `CAROUSEL`. Style: `default`.

Content: `{items: IGalleryItem[], autoplay, infinity, autoplaySpeed, dots, arrows, disablePreview}`.

---

## BLOG_FEED

**EItemType**: `BLOG_FEED`. Styles: `default`, `compact`.

Content: `{limit: number, tag: string, heading: string}`. `tag` empty string = no tag filter.

---

## SOCIAL_LINKS

**EItemType**: `SOCIAL_LINKS`. Styles: `default`, `large`.

Content: `{links: ISocialLink[]}`. `ISocialLink`: `{platform: 'github' | 'linkedin' | 'email' | 'phone' | 'twitter' | 'website' | 'youtube' | 'other', url, label?}`.

---

## PROJECT_CARD

**EItemType**: `PROJECT_CARD`. Styles: `default`, `featured`.

Content: `{title, description, image, tags: string[], primaryLink?: {url, label}, secondaryLink?: {url, label}}`.

---

## Cross-module notes

- **Italic-accent runs**: Hero (headline/subtitle/tagline), Services (sectionTitle + row titles), Testimonials (sectionTitle), ProjectGrid (sectionTitle), Manifesto (body), BlogFeed (heading) all support `*word*` → `<em class="em-accent">word</em>`. Themes style `.em-accent` (italic + accent colour); base fallback in `scss/global.scss` ensures it degrades gracefully.
- **Inline translation**: Every rendered string goes through `<InlineTranslatable>`, so admins with `siteFlags.inlineTranslationEdit` on can Alt-click any piece of text to edit the translation.
- **`tApp` / `translateOrKeep`**: All translatable text passes through `translateOrKeep(tApp, value)` → `sanitizeKey(value)` → `tApp(key)`. When no translation exists, the original string is returned — so bundles don't need separate translation files unless you want locale coverage.
- **Empty-content guardrails**: Sections with no content render as empty containers (no placeholders, no `<img>` fallbacks). Gallery / PlainImage specifically never render broken `<img>` tags when `src` is empty.

## When cloning an old bundle

Safe cloning checklist:
1. Remap section / navigation IDs to avoid collisions with existing DB rows (prefix-swap works — e.g. `paper-*` → `paper-v5-*`).
2. Update `activeThemeId` + `themes[].id` to match the remapped theme id.
3. Fields removed since the bundle was made: none (as of 2026-04-20). Safe to re-import old bundles.
4. Fields added since the bundle was made (extend if you want the new behaviour):
   - Timeline entries: `experienceTitle`, `achievementsTitle`.
   - Services rows: `iconGlyph`, `tags` (only rendered in `grid` style).
   - List items: `prefix`, `prefixSub`, `meta`, `tags` (only rendered in `cases` style).
   - SkillPills items (object form): `category`, `featured`.
5. `siteFlags.layoutMode`: `"tabs"` (default) or `"scroll"` (single-page anchored).

## Public-site mobile responsiveness (2026-04-20)

Responsive rules now live in module-specific SCSS under `src/frontend/scss/Components/*.scss` (since sprint 1). Site chrome — logo, public nav, language selector — is still in `src/frontend/scss/global.scss`, and the design-v5 mobile mitigation pass (hamburger-mobile-menu, single-row compact topbar, `lang-menu` pinned to viewport edges on ≤460 px viewports) is a separate queued item — see [`roadmap/`](../../roadmap/) for status.
