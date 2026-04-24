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
}
