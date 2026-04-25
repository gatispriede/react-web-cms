/**
 * ArchitectureTiers — three-up tier cards (A.01 / A.02 / A.03), an optional
 * `shared/` contract footer card and an optional A.04 request-lifecycle row
 * of step pills. Mirrors the `§ A · Architecture` block from the v2 paper
 * dossiers (Portfolio - CMS.html / Portfolio - LSS.html).
 */
export interface IArchitectureTier {
    /** Ordinal label rendered top-left, e.g. "A.01". */
    ord?: string;
    /** Concern label rendered top-right, e.g. "RENDER CONCERN". */
    concern?: string;
    /** Optional "role" caption (used by LSS — "device tier", "server tier"). */
    role?: string;
    /** Big card title (mono), e.g. "ui/client/" or "apps/mobile/". */
    title: string;
    /** Description paragraph below the title. */
    description?: string;
    /** Tag/feature pills row (e.g. ["Next.js 15", "React 19", "SSG"]). */
    pills?: string[];
    /** Modules table — left label, right tag (right-aligned mono). */
    modules?: Array<{label: string; tag?: string}>;
}

export interface IArchitectureLifecycleStep {
    /** Step number (printed top), e.g. "01". */
    n: string;
    /** Step title, e.g. "Browser". */
    title: string;
    /** Sub-text under the title. */
    sub?: string;
    /** When true, the step is highlighted with the accent fill. */
    highlight?: boolean;
}

export interface IArchitectureTiers {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    /** "Design aim" intro paragraph rendered above the tier row. */
    intro?: string;
    /** Three (or fewer) tier cards. */
    tiers: IArchitectureTier[];
    /** Optional shared/contract footer card. */
    sharedTitle?: string;
    sharedDescription?: string;
    sharedPills?: string[];
    /** Optional request-lifecycle row label, e.g. "A.04 · Request lifecycle". */
    lifecycleLabel?: string;
    lifecycleNote?: string;
    lifecycleSteps?: IArchitectureLifecycleStep[];
}

export enum EArchitectureTiersStyle {
    Default = "default",
    Editorial = "editorial",
}
