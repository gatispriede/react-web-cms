import {ELogoStyle} from '@enums/ELogoStyle';
import {ELogoVariant} from '@enums/ELogoVariant';

/**
 * Persisted Logo document. `content` is an opaque JSON string parsed into
 * `ILogoContent` at the edge — keeps the storage shape stable while the
 * parsed shape evolves (legacy single-image rows keep working, see
 * `parseLogoContent`).
 */
export interface ILogo {
    id?: string
    type?: string
    content: string
    version?: number
    editedBy?: string
    editedAt?: string
}

/**
 * Per-variant asset slot. Today only `src` is meaningful; `width` / `height`
 * are reserved for future intrinsic-dimension overrides per variant. Keeping
 * the slot a record (not a bare string) avoids a second migration when we
 * add per-variant sizing.
 */
export interface ILogoVariantAsset {
    src: string;
    width?: number;
    height?: number;
}

/**
 * Parsed shape of `ILogo.content`. Back-compat contract:
 * - `src` is the legacy single-image field and remains the source of truth
 *   for the `Full` variant when `variants.full` is unset. This means every
 *   previously-uploaded logo keeps rendering as the `Full` variant with no
 *   migration step.
 * - `variants` is the new multi-asset map; each entry is optional and falls
 *   back through `Full` → legacy `src` → built-in `◆` mark.
 * - `style` (the visual treatment, separate axis from variant) is unchanged.
 */
export interface ILogoContent {
    src: string;
    width: number;
    height: number;
    style: ELogoStyle;
    variants?: Partial<Record<ELogoVariant, ILogoVariantAsset>>;
}

/**
 * Pick the best available `src` for a desired variant, with the fallback
 * chain documented above. Returns an empty string if nothing is uploaded —
 * the renderer then shows the dashed `◆` mark.
 *
 * Resolution order for a requested variant V:
 *   1. `variants[V].src` if non-empty
 *   2. `variants[Full].src` if non-empty (and V !== Full)
 *   3. legacy top-level `src` (acts as the `Full` slot for pre-feature rows)
 *   4. '' (caller renders the fallback mark)
 */
export function resolveLogoVariantSrc(
    logo: Pick<ILogoContent, 'src' | 'variants'>,
    variant: ELogoVariant,
): string {
    const v = logo.variants?.[variant];
    if (v && typeof v.src === 'string' && v.src) return v.src;
    if (variant !== ELogoVariant.Full) {
        const full = logo.variants?.[ELogoVariant.Full];
        if (full && typeof full.src === 'string' && full.src) return full.src;
    }
    if (typeof logo.src === 'string' && logo.src) return logo.src;
    return '';
}
