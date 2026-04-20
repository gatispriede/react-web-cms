# Unified image selector/upload across every module

**Status:** Queued.

## Goal

Every module that accepts an image uses the same image selector + upload component (the one already used for the dockable image rail). No module falls back to a raw URL field or a second, inferior selector.

## Design

- Extract the existing selector into a reusable component (if not already): `<ImagePicker value onChange />` with support for: pick-from-library, upload new, drag-drop, clear.
- Migrate every module's image field to this component. Candidates to audit: Hero, Gallery, Testimonials, Services, Timeline, Portrait, any new modules.
- Image rail integration: drag from rail onto any image field — drop targets already exist per `dnd-phase-2`; extend to any field rendered through `ImagePicker`.
- Config schema: module field descriptor for images uses a single canonical `{ type: 'image' }` entry; editor registry maps it to `ImagePicker`.

## Files to touch

- `components/Admin/ImagePicker/*` — lift/promote the component
- Every module editor that currently has a bespoke image field
- Module field-type registry (wherever field descriptors → editor components are mapped)

## Acceptance

- Every image input in admin is the same component with the same affordances
- Drag-drop from image rail works on every image field
- Uploading a new image from any module writes to the image library, not a per-module blob
- No regressions to existing image fields

## Effort

**M · 4–6 h**
