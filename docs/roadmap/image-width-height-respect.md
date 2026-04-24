# Respect image `width` / `height` fields across modules

## Goal

Widths and heights set by authors on image-bearing fields (Logo, PlainImage,
Gallery items, ProjectCard media, Hero portrait, Carousel slides) are
currently ignored by the rendered public-site markup — images size
themselves to their CSS container / intrinsic dimensions instead. Authors
have no way to constrain a 4000 × 3000 photo to a 400 px tile or an SVG
logo to its intended 24 px cap height.

Ship: every image field that exposes width/height in the editor must
honour it at render time (either as HTML attributes, inline style, or CSS
vars). Falls back to current behaviour when both fields are empty.

## Design

- **Data already exists.** `IGalleryItem` carries `imgWidth` / `imgHeight`;
  the logo payload has `width` / `height`; Hero portrait has no explicit
  fields yet but the image drop target accepts dimensions.
- **Render pass** — walk every module's `Display` component, replace bare
  `<img src={…}/>` with a helper (e.g. `@client/lib/SizedImage`) that:
  - emits `width` / `height` attributes when provided (browser aspect-ratio
    reserve)
  - sets inline `style={{maxWidth: w, height: h}}` so theme CSS doesn't
    override with `width: 100%`
  - keeps `object-fit: cover` behaviour when a parent container has a
    fixed aspect-ratio (avoid distortion)
- **Logo case** is the most visible — `.logo img { height: 40px }` in
  `global.scss` unconditionally forces every logo to 40 px. Needs a guard
  so author-supplied height wins.
- **SCSS audit** — any `img { width: 100%; height: auto }` blanket rules
  in Gallery / Carousel / Hero need a `:not([data-sized])` carve-out so the
  sized helper's output isn't trampled.

## Files to touch

- `ui/client/lib/SizedImage.tsx` (new helper)
- `ui/client/styles/Common/Logo.scss`, `ui/client/styles/globals/global.scss`
  (release the `.logo img { height: 40px }` grip)
- `ui/client/modules/PlainImage/PlainImage.tsx`
- `ui/client/modules/Gallery/Gallery.tsx`
- `ui/client/modules/Carousel/Carousel.tsx`
- `ui/client/modules/ProjectCard/ProjectCard.tsx`
- `ui/client/modules/Hero/Hero.tsx` (portrait image)
- Per-module `.scss` — add `:not([data-sized])` guards on blanket img rules

## Acceptance

- Author uploads logo, sets `height: 24`, `width: auto` → rendered `<img>`
  shows at 24 px on public site (currently ignored).
- Gallery item with `imgWidth: 300`, `imgHeight: 200` renders at that box
  in the grid instead of stretching to cell.
- Carousel slide with per-slide dimensions constrains the slide to those
  dimensions (overriding the slide-wide aspect-ratio clamp).
- Empty dimensions keep today's behaviour (responsive fill).

## Effort

S (3 h) — helper + 5 call sites + SCSS guard sweep + Jest snapshot for the
helper.

---

_Added 2026-04-24 from a client report (SkyClimber live site) — logo and
photos on the Pakalpojumi and Galerija pages all ignored the dimensions
the author entered._
