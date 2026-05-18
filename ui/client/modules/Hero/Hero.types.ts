import {IImageRef} from "@interfaces/IImageRef";
import {ILinkRef} from "@interfaces/ILinkRef";

/** Hero CTA — link reference with sibling render hints (`primary` flag). */
export interface IHeroCta extends ILinkRef {
    /** Visual emphasis hint — only the primary button gets the accent fill. */
    primary?: boolean;
}

/** Pre-C18 CTA shape — kept for the read-side normaliser. */
export interface IHeroCtaLegacy {
    label?: string;
    href?: string;
    url?: string;
    primary?: boolean;
}

export interface IHeroMeta {
    label: string;
    value: string;
}

export interface IHeroCoord {
    label: string;
    value: string;
    liveTime?: boolean;
}

export interface IHero {
    eyebrow?: string;
    headline: string;
    headlineSoft?: string;
    titles?: string[];
    subtitle: string;
    tagline: string;
    taglineAttribution?: string;
    /** Background image. Width/height are render-irrelevant for `<div
     *  background-image>` so they're typically left unset; alt is non-meaningful
     *  (decorative image, marked aria-hidden by the renderer). */
    bgImage: IImageRef;
    /** Background image transparency, 0–100. Sibling render hint — not part
     *  of image identity. */
    bgOpacity?: number;
    accent: string;
    /** Short label drawn inside a portrait placeholder tile, e.g. "GP". */
    portraitLabel?: string;
    /** Portrait image — overrides the placeholder. `width` / `height` on the
     *  ref drive the tile size. */
    portraitImage?: IImageRef;
    /** Portrait image transparency, 0–100. Sibling render hint. */
    portraitOpacity?: number;
    meta?: IHeroMeta[];
    coords?: IHeroCoord[];
    ctaPrimary?: IHeroCta;
    ctaSecondary?: IHeroCta;
    ctaTertiary?: IHeroCta;
}

/** Pre-C18 stored shape — read-side fallback only. */
export interface IHeroLegacy {
    eyebrow?: string;
    headline?: string;
    headlineSoft?: string;
    titles?: string[];
    subtitle?: string;
    tagline?: string;
    taglineAttribution?: string;
    bgImage?: string | IImageRef;
    bgOpacity?: number;
    accent?: string;
    portraitLabel?: string;
    portraitImage?: string | IImageRef;
    portraitOpacity?: number;
    portraitWidth?: number | string;
    portraitHeight?: number | string;
    meta?: IHeroMeta[];
    coords?: IHeroCoord[];
    ctaPrimary?: IHeroCtaLegacy;
    ctaSecondary?: IHeroCtaLegacy;
    ctaTertiary?: IHeroCtaLegacy;
}

export enum EHeroStyle {
    Default = "default",
    Centered = "centered",
    Compact = "compact",
    Editorial = "editorial",
    Poster = "poster",
    Cinematic = "cinematic",
    Split = "split",
    Glass = "glass",
}
