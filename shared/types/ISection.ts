import {IItem} from "./IItem";

export interface ISection {
    id?: string;
    type: number,
    page?: string,
    content: IItem[]
    /**
     * Column spans per item. Length must equal `content.length`.
     * Default (when absent): `[1, 1, ...]` of length `type` — evenly divided.
     * Merging two adjacent columns collapses their entries into one item whose
     * span is the sum. Sum of `slots` should equal `type` so the grid always
     * resolves to the canonical 1/2/3/4-track width.
     *
     * Examples (type = 3, three 33% columns):
     *   slots = [1, 1, 1]  → 33 / 33 / 33 (default)
     *   slots = [2, 1]     → 66 / 33 (left two merged)
     *   slots = [1, 2]     → 33 / 66 (right two merged)
     * Type = 4 permits [1,1,1,1] · [2,1,1] · [1,2,1] · [1,1,2] · [2,2] · [1,3] · [3,1] · [4].
     */
    slots?: number[]
    /**
     * When `true`, the section is rendered as an **absolute-positioned
     * overlay** inside the previous non-overlay section. Use for stacked
     * composition — e.g. a stat card pinned to the bottom-right of a hero.
     * Overlays don't take block flow; multiple overlays stack in order.
     */
    overlay?: boolean
    /** Overlay anchor — defaults to `top-left`. `fill` stretches over the host. */
    overlayAnchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'fill'
    /**
     * Cross-cutting "transparent background" flag. When `true` the section
     * root receives `.is-transparent` and its default background / box-shadow
     * / backdrop-filter are cleared, so whatever sits behind (hero image,
     * theme body colour, parent overlay host) shows through. See
     * `docs/roadmap/module-transparency-style.md`.
     */
    transparent?: boolean
    /**
     * Section transparency level, 0–100 (%). Independent of `transparent`:
     * - `0` (or absent): fully opaque — no effect.
     * - `1..99`: partially see-through — applied as CSS `opacity: 1 - n/100`
     *   on the section element. Text dims alongside the background, matching
     *   user expectations for a "ghost section" style.
     * - `100`: fully transparent (invisible). Use sparingly — intended for
     *   admin-tunable overlays.
     *
     * Surfaced in the per-module Style tab (see `AddNewSectionItem`). The
     * legacy inline Switch from the section admin strip has been absorbed
     * into the same control + Slider pair.
     */
    transparentOpacity?: number
    /** Optimistic-concurrency counter — bumped server-side on each save.
     *  Frontend stashes this at read-time and sends it back as
     *  `expectedVersion` on save; server rejects with a `ConflictError`
     *  if a peer has bumped past us. See `src/Server/conflict.ts`. */
    version?: number
    editedBy?: string
    editedAt?: string
}