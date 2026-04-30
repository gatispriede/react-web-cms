# Content management

## Overview

The admin builds pages by composing **sections** — full-width row containers — each holding one or more **items** (modules). Sections are stacked vertically; items inside a section occupy column slots.

## Pages and navigation

- Each page is a `Navigation` doc: `{type: 'navigation', page, sections: [id], seo}`.
- The site map is the set of all Navigation docs. Slug routing maps URL paths to page docs.
- SEO fallbacks (`siteSeo`) are set globally in admin → SEO tab; each page can override at the Navigation level.

## Sections

A `Sections` doc: `{id, type, page, content: [Item], slots, overlay, overlayAnchor}`.

- `type` controls the column count (1, 2, or 3).
- `slots` controls the column-width distribution (e.g. `[2, 1]` = 66/33). `sum(slots) === type`.
- `overlay: true` removes the section from block flow and positions it absolute-over the previous non-overlay ("host") section. `overlayAnchor` sets the corner/fill position.

## Module types (17)

| Type | Display name | Notes |
|---|---|---|
| `HERO` | Hero | Full-bleed header with portrait, headline, subtitle, CTA |
| `TIMELINE` | Timeline | Vertical or horizontal milestone list |
| `SKILL_PILLS` | Skill pills | Tag cloud / matrix of skills |
| `SERVICES` | Services | Icon + heading + body cards |
| `TESTIMONIALS` | Testimonials | Quote cards with avatar |
| `PROJECT_GRID` | Project grid | Card grid with image, title, tags |
| `PROJECT_CARD` | Project card | Single featured project |
| `MANIFESTO` | Manifesto | Full-width editorial block |
| `STATS_CARD` | Stats | Metric / number callout |
| `LIST` | List | Bullet or numbered list |
| `GALLERY` | Gallery | Image grid with optional text-only mode |
| `RICH_TEXT` | Rich text | HTML body, italic-accent runs supported |
| `TEXT` | Text | Plain text block |
| `IMAGE` | Image | Single image with optional caption |
| `CAROUSEL` | Carousel | Horizontally scrollable image strip |
| `BLOG_FEED` | Blog feed | Latest posts pulled from `Posts` collection |
| `SOCIAL_LINKS` | Social links | Icon link row |

Each item carries `{type, style, content (JSON), action?, actionType?, actionContent?, actionStyle?}`. The `action*` fields mount a second item type as the click/hover target.

The `style` field selects a layout variant per module (e.g. `services.numbered`, `services.grid`, `services.cards`, `testimonials.cards`, `projectGrid.studio`, `statsCard.panel`, `hero.editorial`). Variants are base-theme CSS rules in `scss/Components/*.scss`; themes can override them at higher specificity via `[data-theme-name="…"]`.

Full content JSON shapes per type: see [`../architecture/module-interfaces.md`](../architecture/module-interfaces.md).

## Drag-and-drop reordering

Two independent DnD mechanisms — see [`../architecture/admin-systems.md`](../architecture/admin-systems.md) for the technical split.

- **Section reorder** — drag the section handle to reorder rows on the page.
- **Intra-section item reorder** — drag items within a section's column slots.
- **Image rail** — fixed right-hand panel; drag a thumbnail onto a section's image drop target.
- Keyboard and touch sensors are supported alongside pointer.

## Image management

- Images are uploaded via the admin and stored as metadata docs in the `Images` collection; binaries live at `src/frontend/public/images/`.
- Every image field in admin uses the shared `ImageUrlInput` component — a text input + "Select Image" modal (pick from library or upload new) + drag-drop target for the image rail. Covers module editors (Hero bg/portrait, ProjectCard cover, Gallery/Carousel items) and settings (Post cover, SEO og:image).
- Logos are a separate singleton (`Logos` collection); managed in admin → Branding.

## Key constraints

- Section/item mutations are version-checked (optimistic concurrency). Saving a stale version returns a `ConflictError` — see [`admin-experience.md`](admin-experience.md).
- `publishedAt` on a Navigation doc is set by `PublishService`; drafts are not publicly visible until a snapshot is published.
