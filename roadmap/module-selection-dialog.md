# Module selection as dialog / popup

**Status:** Queued.

## Goal

Picking a module to add becomes a focused dialog (or rich popover), not an inline list squeezed into the rail. Module choice gets proper real estate: thumbnail/preview, short description, category filter, search.

## Design

- Trigger "Add section" → opens a modal with a grid of modules, each card showing preview thumb + name + short description.
- Grouping/filter: category chips across the top ("Hero", "Media", "Content", "CTA", "Layout").
- Keyboard: arrow keys navigate, Enter picks, Esc closes.
- Search input auto-focused.
- Reuse the existing module registry — just change how options are surfaced.
- Migrate from the current rail-embedded picker; remove the old inline list.

## Files to touch

- New: `components/Admin/ModulePicker/ModulePickerDialog.tsx`
- Admin shell / rail component — replace inline picker with dialog trigger
- Module registry — ensure each entry has thumbnail + short description fields
- i18n keys for categories + descriptions

## Acceptance

- Clicking "Add section" opens a modal listing every available module
- Thumbnail, name, description legible for each module
- Search + category filter narrow the list
- Keyboard navigation + Esc-to-close work
- Picking a module inserts it at the intended position

## Effort

**M · 4–6 h**
