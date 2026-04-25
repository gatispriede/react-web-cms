export interface IHeroCta {
    label: string;
    href?: string;
    primary?: boolean;
}

export interface IHeroMeta {
    label: string;
    value: string;
}

export interface IHeroCoord {
    label: string;
    value: string;
    /** When true the value is rendered live as the current time in Europe/Riga.
     * Any string value becomes the fallback until JS mounts. */
    liveTime?: boolean;
}

export interface IHero {
    /** Small caps eyebrow above the headline (e.g. "DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009"). */
    eyebrow?: string;
    headline: string;
    /** Second part of the headline, rendered italic/soft next to the main headline. */
    headlineSoft?: string;
    /** Titles array rendered as "A / B / C" with separators. */
    titles?: string[];
    subtitle: string;
    tagline: string;
    /** Quote attribution under the tagline, e.g. "— personal motto". */
    taglineAttribution?: string;
    bgImage: string;
    /** Background image transparency, 0 (fully visible) – 100 (fully invisible).
     *  Rendered on a dedicated `.hero__bg` layer so text stays at full opacity
     *  while the image fades behind it. Missing / 0 = historical behaviour. */
    bgOpacity?: number;
    accent: string;
    /** Short label drawn inside a portrait placeholder tile, e.g. "GP". */
    portraitLabel?: string;
    /** Optional real portrait image — overrides the diagonal placeholder. */
    portraitImage?: string;
    /** Portrait image transparency, 0 – 100. Applied via inline `opacity` on
     *  the `<img>` itself — the placeholder chrome (corners, 4:5 badge) is
     *  not affected. */
    portraitOpacity?: number;
    /** Definition-list pairs below the hero (Based / Years / Mode / Stack). */
    meta?: IHeroMeta[];
    /** Bottom coordinate strip (LAT / LON / ELEV / LOCAL / UPDATED). */
    coords?: IHeroCoord[];
    ctaPrimary?: IHeroCta;
    ctaSecondary?: IHeroCta;
    ctaTertiary?: IHeroCta;
}

export enum EHeroStyle {
    Default = "default",
    Centered = "centered",
    Compact = "compact",
    Editorial = "editorial",
    /** Readable-over-photo style: big white display headline on a
     *  semi-opaque dark "card" that sits over any background image.
     *  Designed for overlay-style heroes where the image is busy and
     *  the default `is-fullbleed` scrim + text-shadow isn't enough. */
    Poster = "poster",
}
