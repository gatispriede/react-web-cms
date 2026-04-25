export type SocialPlatform = 'github' | 'linkedin' | 'email' | 'phone' | 'twitter' | 'website' | 'youtube' | 'other';

export interface ISocialLink {
    platform: SocialPlatform;
    url: string;
    label?: string;
}

export interface ISocialLinks {
    links: ISocialLink[];
}

export enum ESocialLinksStyle {
    Default = "default",
    Large = "large",
    /** Editorial CV "channels strip" — card grid with platform glyph,
     *  big href row, mono "OPEN" affordance. */
    Channels = "channels",
}
