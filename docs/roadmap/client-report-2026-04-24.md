# Client report — 2026-04-24

Three bugs flagged by the client in a screenshot. Latvian originals + translations below.

## 1. Hero text doesn't fit over the image

> "sākumlapa - teksts uz bildes neietilpst"
> Homepage — text over image doesn't fit.

**Surface:** Hero module on the homepage (`ui/client/modules/Hero/`).

**Hypothesis:** long copy + narrow viewport → the overlay text block overflows the image container. The Hero's text box probably has a fixed height or `overflow: hidden`, or its font sizing doesn't scale down on narrow widths. Maybe a theme-specific regression (spec for C10 modules-preview calls out exactly this symptom as a Hero-on-theme issue).

**Repro:** load the homepage on a narrow viewport (mobile width) or with a long Hero title/subtitle. Check all four themes.

**Fix direction:** audit `Hero.scss` — use `clamp()` for font sizes, ensure the text container uses `min-height` not `height`, confirm responsive breakpoints. If theme-specific, the bad tokens live in `ui/client/themes/<slug>.json`.

## 2. Text on image not readable

> "nav redzams teksts uz bildes - salasāms"
> Text on image not visible / readable.

**Surface:** same Hero, same story. Probably same root cause as #1 (text over image) but the complaint is contrast, not overflow.

**Hypothesis:** the image is light in the spot where the text sits; text colour is light too → washed out. Classic image-caption contrast problem.

**Fix direction:**
- Add a scrim / gradient overlay behind text (semi-transparent dark rectangle, or full-image gradient)
- Or text-shadow fallback for smaller copy
- Drive via theme token so each preset can choose its scrim opacity
- Pairs with [module-transparency-style.md](module-transparency-style.md) (shipped C8) contrast-warning concept — same idea, different direction (forcing readability rather than warning about it).

## 3. Can't create a new module in Services section

> "pakalpojumu sadaļa - nevar izveidot jaunu moduli"
> Services section — can't create a new module.

**Surface:** admin editor for the Services module (`ui/admin/modules/Services/` or wherever the services list editor lives).

**Hypothesis:** "Add item" button broken, or the editor schema for a Services item is rejecting a valid empty-new shape. Could be a regression from the folder reshape (N15) or from C8's section-admin-strip edits.

**Repro:** log into admin, open a page with a Services section, try to add a new service item. Capture the console error + network response.

**Fix direction:** start by reproducing. Likely a client-side exception (missing handler binding) or a server-side schema rejection (required field not defaulted for the new-empty case).

## Triage

Priority order suggested:
1. **#3 (can't create service module)** — blocking admin work right now, user-facing; fix first. S-sized bug hunt.
2. **#2 (contrast)** — readable fix; scrim/gradient + theme token. S.
3. **#1 (overflow)** — responsive CSS audit; may share root cause with #2. S.

Probably all three land in under a day once reproduced. C10 (admin-modules-preview-page) would have caught #1 and #2 — another argument for shipping it.

## Effort

**S × 3** — none individually complex; the fix-times are dominated by reproducing the state (right theme + right content length + right viewport).
