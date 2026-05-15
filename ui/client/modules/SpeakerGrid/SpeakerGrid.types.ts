export type SpeakerSocialPlatform = 'twitter' | 'linkedin' | 'github' | 'website';

export interface SpeakerSocial {
    platform: SpeakerSocialPlatform;
    url: string;
}

export interface Speaker {
    key: string;
    name: string;
    role?: string;
    headshotUrl?: string;
    bio: string;
    socials?: SpeakerSocial[];
}

export interface SpeakerGridProps {
    testId: string;
    speakers: Speaker[];
    /** Initially-open speaker key — used for SSR / share-link deep linking. */
    initialOpenKey?: string;
}
