export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'linkedin';

export interface ContactSocial {
    platform: SocialPlatform;
    url: string;
}

export interface ContactBlockProps {
    testId: string;
    /** E.164 preferred for the tel: link. */
    phone?: string;
    /** Display string for the phone — defaults to `phone`. */
    phoneDisplay?: string;
    addressLines?: string[];
    /** Google Maps / OSM URL — when present, address content is wrapped in an anchor. */
    mapUrl?: string;
    email?: string;
    social?: ContactSocial[];
    headline?: string;
}
