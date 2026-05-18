export type SchemaOrgAvailability = 'InStock' | 'OutOfStock' | 'PreOrder';
export type SchemaOrgEventAvailability = 'InStock' | 'SoldOut';

export type SchemaOrgDayOfWeek =
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday'
    | 'Sunday';

export interface OpeningHoursSpec {
    dayOfWeek: SchemaOrgDayOfWeek[];
    /** 'HH:MM' */
    opens: string;
    /** 'HH:MM' */
    closes: string;
}

export interface OrganizationEntry {
    kind: 'organization';
    name: string;
    url: string;
    logo?: string;
    sameAs?: string[];
}

export interface ProductOffer {
    priceCurrency: string;
    price: number | string;
    availability?: SchemaOrgAvailability;
    url?: string;
}

export interface ProductEntry {
    kind: 'product';
    name: string;
    image?: string | string[];
    description?: string;
    sku?: string;
    brand?: string;
    offers?: ProductOffer;
}

export interface ArticleEntry {
    kind: 'article';
    headline: string;
    image?: string;
    datePublished: string;
    dateModified?: string;
    author?: {name: string; url?: string};
    publisher?: {name: string; logo?: string};
}

export interface PostalAddress {
    streetAddress: string;
    addressLocality: string;
    addressRegion?: string;
    postalCode: string;
    addressCountry: string;
}

export interface LocalBusinessEntry {
    kind: 'localBusiness';
    name: string;
    image?: string;
    telephone?: string;
    priceRange?: string;
    address: PostalAddress;
    geo?: {latitude: number; longitude: number};
    openingHoursSpecification?: OpeningHoursSpec[];
}

export type EventLocation =
    | {name: string; address?: string}
    | {url: string};

export interface EventOffer {
    url: string;
    price: number | string;
    priceCurrency: string;
    availability?: SchemaOrgEventAvailability;
}

export interface EventEntry {
    kind: 'event';
    name: string;
    startDate: string;
    endDate?: string;
    location: EventLocation;
    image?: string;
    description?: string;
    offers?: EventOffer;
}

export interface BreadcrumbListEntry {
    kind: 'breadcrumbList';
    items: {name: string; item: string}[];
}

export interface FaqPageEntry {
    kind: 'faqPage';
    questions: {question: string; answer: string}[];
}

export type SchemaOrgEntry =
    | OrganizationEntry
    | ProductEntry
    | ArticleEntry
    | LocalBusinessEntry
    | EventEntry
    | BreadcrumbListEntry
    | FaqPageEntry;

export interface SchemaOrgInjectorProps {
    entries: SchemaOrgEntry[];
    /** Stable testid prefix. Each script gets `${testId}-${entry.kind}-${index}`. */
    testId?: string;
}
