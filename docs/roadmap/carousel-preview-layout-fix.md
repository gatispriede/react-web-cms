# Carousel preview — layout blow-out + caption legibility fix

_Session: 2026-04-24_

## Symptom

In `/admin/modules-preview`, every Carousel variant rendered as solid black
rectangles that overflowed their section borders. Default and polaroid
variants additionally clipped or hid their captions after dimensions were
corrected.

## Root causes

### 1. 2^25 px layout runaway

Chrome MCP DOM inspection showed `.slick-slide` computed widths of
**33,554,432 px** (2^25 — Chrome's layout maximum) and `.slick-list` at
~37.2 M px. Window was 2133 px and source images 1920 × 1080, so the
container was six orders of magnitude too wide.

Chain that produced it:

1. `<figure>` preview tiles sit inside a CSS grid; grid items default to
   `min-width: auto` → min-content.
2. AntD's Carousel (rc-slick) injects inline `display: inline-block;
   width: 100%` on every `<li class="container">` child before slick
   initializes.
3. `<img>` with `aspect-ratio` set but no explicit width contributes its
   intrinsic width to min-content.
4. `min-content` of inline-block + intrinsic image width propagated up
   into the grid column, inflating it until Chrome clamped at 2^25.
5. Slick recorded that inflated width as its `list` size, then split it
   across slides — every slide rendered at 33 M px.

### 2. Caption clip vs wrapper clip

Default variant: container computed at 1129 px tall (16:9 of the
2008-px-wide wrapper). Wrapper had `max-height: 60vh` (= 595 px), so the
caption positioned at `bottom: 0` of the container sat at y ≈ 1078 — far
below the wrapper's clip line.

Polaroid variant: wrapper padding `24px 0 40px` (= 64 px of vertical
chrome) meant the 70 vh container overflowed the wrapper clip by ~14 px.

### 3. Caption hidden by image

`document.elementFromPoint(textCenterX, textCenterY)` returned
`<img class="ant-image-img">` instead of the caption `<p>`. `.image` had
`z-index: 1`; `.text` had `z-index: auto` (0). Same stacking context →
image painted on top.

## Fixes

### `ui/client/modules/Carousel/Carousel.scss`

- `display: flex !important` on `.slick-initialized .container` — beats
  AntD's inline-block injection so flex lays slides out as fixed-size
  tracks rather than min-content-driven inline boxes.
- Base container `max-height: 60vh` — clips aspect-ratio height into the
  wrapper clip band so captions at `bottom: 0` stay visible.
- Cinematic container `max-height: 75vh`.
- Polaroid container `max-height: calc(70vh - 64px)` — subtracts wrapper
  padding (`24px 0 40px`) so the container can never exceed the clip.
- Base `.container .text` caption strengthened:
  `background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.82) 100%);`
  `text-shadow: 0 1px 2px rgba(0,0,0,0.6);`
  `z-index: 3;`
  `padding: 20px 24px 18px;`
  `p { font-size: 15px; font-weight: 500; }`

### `ui/client/lib/preview/ModulesPreview.tsx`

- `<figure>` grid item: added `minWidth: 0` — kills the
  min-content-width-propagation pipe at its origin.
- Preview frame `<div>`: added `minWidth: 0, overflow: hidden` — second
  line of defence. Inline comment now explains the 33 M px trap for the
  next operator who touches this.

## Verification

Chrome MCP at 2133 px viewport:

| Variant   | Wrapper height | Text clip-bottom |
|-----------|----------------|------------------|
| default   | 595 px         | negative (inside) |
| cinematic | 744 px         | negative (inside) |
| polaroid  | 799 px         | negative (inside) |
| ribbon    | 397 px         | negative (inside) |
| editorial | 595 px         | negative (inside) |

Final screenshot confirmed "Microstructure — field study, winter 2024"
caption visible on the default variant.

## Lessons

- **Grid items need `min-width: 0` whenever their descendants can grow
  unbounded pre-initialization.** Slick/Swiper/rc-slick are the usual
  suspects because they measure before laying out.
- **`aspect-ratio` + `<img>` + inline-block is a classic min-content
  grenade.** One missing `min-width: 0` on an ancestor will nuke a whole
  grid column.
- **Stacking inside `position: relative` parents**: absolutely-positioned
  siblings with different z-index defaults will fight. If a sibling sets
  `z-index: 1`, every other sibling that must paint over it needs an
  explicit z-index > 1, not `auto`.
