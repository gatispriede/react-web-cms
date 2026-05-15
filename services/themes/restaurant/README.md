# Restaurant — first-class theme

**Status:** shipped 2026-05-13. Per-theme baseline pass `tests/e2e/visual/themes/restaurant.spec.ts` ships alongside.

## Target audience

Restaurants, cafes, bistros, neighbourhood food businesses, wineries, bakeries. Hospitality + food retail in general.

## Mood

Warm · appetising · handmade · considered · photo-led.

Translates to:
- **Warm khaki paper (`#F4EFE6`) + deep cocoa ink + burgundy accent (`#7A1F2B`).** Reads as "linen tablecloth + good wine." Light by default; dark mode lifts the burgundy to coral-rose.
- **Fraunces (variable serif with optical sizes) + Manrope body.** Fraunces' "SOFT" and "opsz" axes give the display a hand-illustrated feel at large sizes — different from Editorial's Source Serif Pro rigour. Manrope's humanist sans pairs warmly without competing.
- **Considered motion** — 300ms base, overshoot-tinged eases. Different from Editorial's slow + deliberate; reads as "welcoming" rather than "literary."
- **Mixed radii** — 0px on menu items (printed-menu flat), 4px on buttons + cards. Most distinctive radius treatment of the five themes.
- **Centered-hero-integrated header** — logo centered, nav below in uppercase tracking. Magazine-masthead feel that suits the photo-led hero.
- **RestaurantMenu rendered as a printed menu** — sections separated by hairline rules with centered serif headings, dotted-leader prices, dietary badges as small mono tags.
- **OpeningHours always-visible** with a prominent "Open now" pill.
- **ReservationWidget sticky-mobile-bottom** — mobile visitors always see "Reserve a table" at the bottom of the viewport.

## When to pick this

- Restaurants, cafes, bistros, food trucks, bakeries.
- Wineries, distilleries, breweries — same hospitality DNA.
- Neighbourhood / local food businesses where booking + menu + hours are the three primary surfaces.

## When NOT to pick this

- Online food delivery / e-comm groceries — use `commerce` (snappy retail).
- Long-form food writing / cookbook publishers — use `editorial`.
- Hotel chains / hospitality brands at scale — `commerce` or a custom theme.

## File layout

| File | Role |
| --- | --- |
| `theme.json` | Manifest. |
| `theme.scss` | Tokens + body baseline with Fraunces optical-size font-variation-settings at multiple heading sizes. |
| `module-styles.scss` | Centered hero (logo centered above nav, all uppercase tracking), photo-bleed hero with warm 30→55% gradient overlay, RestaurantMenu printed-menu layout (0px radii, hairline rules, centered course headings, dotted-leader prices, mono dietary badges), OpeningHours large + open-now pill, ReservationWidget sticky-mobile-bottom, ContactBlock photo-led card, Gallery square crops with `contrast(1.04) saturate(1.05)` filter, pill-rounded buttons with uppercase tracking + overshoot hover. |
| `product-templates.scss` | No-op (restaurants don't use product templates). |
| `README.md` | This file. |

## Tokens

### Palette

| Token | Light | Dark |
| --- | --- | --- |
| `--color-surface` | `#F4EFE6` (khaki paper) | `#1C1814` (warm dark) |
| `--color-ink` | `#2A1F1A` (deep cocoa) | `#F0E8DC` (warm cream) |
| `--color-accent` | `#7A1F2B` (deep burgundy) | `#C44A5B` (coral-rose) |
| `--color-accent-ink` | `#F4EFE6` | `#1C1310` |
| `--color-surface-inset` | `#EAE2D2` | `#26201A` |
| `--color-rule` | `#C9BEA8` | `#3D362D` |

Contrast: ink/surface ≈ 13:1 light, 12:1 dark. Burgundy/khaki ≈ 7:1 — AAA for normal text.

### Typography

- **Display:** `'Fraunces', ui-serif, Georgia, ...` — variable serif with `opsz` (optical sizing) + `SOFT` (handmade quality) axes
- **Body:** `'Manrope', system-ui, ...` — humanist sans
- **Mono:** `ui-monospace, ...`
- **Base size:** 16px

Heading variation settings: `'opsz' 60, 'SOFT' 50` for h2/h3, scaled up to `'opsz' 144, 'SOFT' 100` for hero h1.

### Motion (`gentle-slow` + overshoot)

| Token | Restaurant value |
| --- | --- |
| `--motion-duration-fast` | 180ms |
| `--motion-duration-base` | 300ms |
| `--motion-duration-slow` | 500ms |
| `--motion-duration-deliberate` | 800ms |
| `--motion-ease-standard` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--motion-ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` |

Slightly slower than Commerce + SaaS-landing (snappy retail), faster than Editorial (literary). Reads as "considered" without dragging.

## Header behaviour — `centered-hero-integrated`

Logo centered, nav below. On scroll the bar condenses to a slim row with logo left + nav right and switches from transparent overlay to opaque surface. Toggled via `.is-condensed` class.

## Signature module pack

- `RestaurantMenu` printed-menu layout with section headings + dotted-leader prices + dietary badges
- `ReservationWidget` sticky-mobile-bottom
- `OpeningHours` always-visible + open-now pill
- `ContactBlock` photo-led card
- `Gallery` square crops with `contrast(1.04) saturate(1.05)` filter (food photography pop)

## Visual baselines

```bash
npx playwright test --project=visual tests/e2e/visual/themes/restaurant.spec.ts --update-snapshots
```

## Follow-ups

- **Pickup / order-ahead module** — many restaurants now offer takeaway; ship a small order-ahead surface as a per-theme module add later.
- **Surface baselines** under restaurant.
- **Self-hosted Fraunces + Manrope** via `siteFlags.selfHostFonts`.
- **Stitch frames** for the menu + reservation widget + hero.
