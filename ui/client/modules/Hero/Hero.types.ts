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
    accent: string;
    /** Short label drawn inside a portrait placeholder tile, e.g. "GP". */
    portraitLabel?: string;
    /** Optional real portrait image — overrides the diagonal placeholder. */
    portraitImage?: string;
    /** Definition-list pairs below the hero (Based / Years / Mode / Stack). */
    meta?: IHeroMeta[];
    /** Bottom coordinate strip (LAT / LON / ELEV / LOCAL / UPDATED). */
    coords?: IHeroCoord[];
    ctaPrimary?: IHeroCta;
    ctaSecondary?: IHeroCta;
}

export enum EHeroStyle {
    Default = "default",
    Centered = "centered",
    Compact = "compact",
    Editorial = "editorial",
}
