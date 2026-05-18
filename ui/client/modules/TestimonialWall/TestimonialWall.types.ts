export interface Testimonial {
    key: string;
    quote: string;
    name: string;
    role?: string;
    company?: string;
    photoUrl?: string;
}

export interface TestimonialWallProps {
    testId: string;
    items: Testimonial[];
    /** CSS columns count; default 3. Mobile collapses to 1. */
    desktopColumns?: 2 | 3 | 4;
}
