/**
 * InfraTopology — droplet/server cards plus a free-form inline SVG topology
 * diagram. Author pastes raw SVG as a string; renderer sanitises through
 * DOMPurify (same path used by RichText) before injecting.
 */
export interface IInfraDroplet {
    name: string;
    /** Mono caps role label (e.g. "WEB · API"). */
    role?: string;
    /** Bullet-list specs (e.g. "2 vCPU", "4 GB RAM"). */
    specs?: string[];
    /** Bullet-list services running on the droplet. */
    services?: string[];
    /** Optional accent (e.g. "rust" / "ink") rendered as left rule colour. */
    accent?: string;
}

export interface IInfraTopology {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    /** Mono caps label above the droplet card grid. */
    dropletsLabel?: string;
    droplets?: IInfraDroplet[];
    /** Mono caps label above the topology SVG. */
    topologyLabel?: string;
    /** Inline SVG markup (string). Sanitised via DOMPurify on render. */
    topologySvg?: string;
    /** Free-text caption rendered under the SVG. */
    topologyCaption?: string;
}

export enum EInfraTopologyStyle {
    Default = "default",
    Editorial = "editorial",
}
