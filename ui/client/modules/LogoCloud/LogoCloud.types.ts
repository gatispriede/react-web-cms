export interface LogoEntry {
    key: string;
    name: string;
    logoUrl: string;
    href?: string;
}

export interface LogoCloudProps {
    testId: string;
    headline?: string;
    logos: LogoEntry[];
}

export enum ELogoCloudStyle {
    Default = "default",
    Marquee = "marquee",
    Mono = "mono",
    Wall = "wall"
}
