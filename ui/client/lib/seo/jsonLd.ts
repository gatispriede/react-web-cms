/**
 * Schema.org JSON-LD helpers — W8h SEO program § structured data.
 *
 * Tiny shape builders that emit the JSON-LD payloads Google's
 * Rich-Results test consumes. Each builder returns a plain object you
 * can drop into a `<script type="application/ld+json">` tag.
 *
 * Why hand-rolled vs `schema-dts`: the payloads are small + stable, and
 * pulling in the typed schema package would balloon the bundle for one
 * use site. The shapes here are validated against the Google docs for
 * each `@type`.
 */

export interface OrganizationJsonLd {
    '@context': 'https://schema.org';
    '@type': 'Organization';
    name: string;
    url: string;
    logo?: string;
    sameAs?: string[];
}

export interface WebSiteJsonLd {
    '@context': 'https://schema.org';
    '@type': 'WebSite';
    name: string;
    url: string;
    potentialAction?: {
        '@type': 'SearchAction';
        target: string;
        'query-input': string;
    };
}

export interface BreadcrumbItem {
    name: string;
    url: string;
}

export interface BreadcrumbListJsonLd {
    '@context': 'https://schema.org';
    '@type': 'BreadcrumbList';
    itemListElement: Array<{
        '@type': 'ListItem';
        position: number;
        name: string;
        item: string;
    }>;
}

export interface ArticleJsonLd {
    '@context': 'https://schema.org';
    '@type': 'Article';
    headline: string;
    description?: string;
    image?: string | string[];
    datePublished?: string;
    dateModified?: string;
    author?: {'@type': 'Person'; name: string};
}

export interface ProductJsonLd {
    '@context': 'https://schema.org';
    '@type': 'Product';
    name: string;
    description?: string;
    image?: string | string[];
    sku?: string;
    offers?: {
        '@type': 'Offer';
        price: string | number;
        priceCurrency: string;
        availability?: string;
        url?: string;
    };
}

export function organization(name: string, url: string, logo?: string, sameAs?: string[]): OrganizationJsonLd {
    const out: OrganizationJsonLd = {'@context': 'https://schema.org', '@type': 'Organization', name, url};
    if (logo) out.logo = logo;
    if (sameAs && sameAs.length > 0) out.sameAs = sameAs;
    return out;
}

export function website(name: string, url: string, searchTemplate?: string): WebSiteJsonLd {
    const out: WebSiteJsonLd = {'@context': 'https://schema.org', '@type': 'WebSite', name, url};
    if (searchTemplate) {
        out.potentialAction = {
            '@type': 'SearchAction',
            target: searchTemplate,
            'query-input': 'required name=search_term_string',
        };
    }
    return out;
}

export function breadcrumbList(items: BreadcrumbItem[]): BreadcrumbListJsonLd {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: it.url,
        })),
    };
}

export function article(input: {
    headline: string;
    description?: string;
    image?: string | string[];
    datePublished?: string;
    dateModified?: string;
    authorName?: string;
}): ArticleJsonLd {
    const out: ArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.headline,
    };
    if (input.description) out.description = input.description;
    if (input.image) out.image = input.image;
    if (input.datePublished) out.datePublished = input.datePublished;
    if (input.dateModified) out.dateModified = input.dateModified;
    if (input.authorName) out.author = {'@type': 'Person', name: input.authorName};
    return out;
}

export function product(input: {
    name: string;
    description?: string;
    image?: string | string[];
    sku?: string;
    price?: number | string;
    priceCurrency?: string;
    availability?: string;
    url?: string;
}): ProductJsonLd {
    const out: ProductJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: input.name,
    };
    if (input.description) out.description = input.description;
    if (input.image) out.image = input.image;
    if (input.sku) out.sku = input.sku;
    if (input.price !== undefined && input.priceCurrency) {
        out.offers = {
            '@type': 'Offer',
            price: input.price,
            priceCurrency: input.priceCurrency,
            availability: input.availability ?? 'https://schema.org/InStock',
            url: input.url,
        };
    }
    return out;
}

/**
 * Serialise one or many JSON-LD objects into the string body of a
 * `<script type="application/ld+json">` tag. Filters out nulls so call
 * sites can `[org, breadcrumbs ?? null]` without conditional spreads.
 */
export function serializeJsonLd(payload: unknown | unknown[]): string {
    if (Array.isArray(payload)) {
        const filtered = payload.filter((p) => p != null);
        if (filtered.length === 0) return '';
        if (filtered.length === 1) return JSON.stringify(filtered[0]);
        return JSON.stringify(filtered);
    }
    return payload == null ? '' : JSON.stringify(payload);
}
