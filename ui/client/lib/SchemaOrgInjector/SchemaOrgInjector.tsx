import React from 'react';
import './SchemaOrgInjector.scss';
import {
    SchemaOrgEntry,
    SchemaOrgInjectorProps,
    OrganizationEntry,
    ProductEntry,
    ArticleEntry,
    LocalBusinessEntry,
    EventEntry,
    BreadcrumbListEntry,
    FaqPageEntry,
} from './SchemaOrgInjector.types';

const SCHEMA_URL = 'https://schema.org';
const SCHEMA_CTX = {'@context': SCHEMA_URL};

function organization(e: OrganizationEntry): object {
    return {
        ...SCHEMA_CTX,
        '@type': 'Organization',
        name: e.name,
        url: e.url,
        ...(e.logo ? {logo: e.logo} : {}),
        ...(e.sameAs ? {sameAs: e.sameAs} : {}),
    };
}

function product(e: ProductEntry): object {
    const offers = e.offers ? {
        '@type': 'Offer',
        priceCurrency: e.offers.priceCurrency,
        price: e.offers.price,
        ...(e.offers.availability ? {availability: `${SCHEMA_URL}/${e.offers.availability}`} : {}),
        ...(e.offers.url ? {url: e.offers.url} : {}),
    } : undefined;
    return {
        ...SCHEMA_CTX,
        '@type': 'Product',
        name: e.name,
        ...(e.image ? {image: e.image} : {}),
        ...(e.description ? {description: e.description} : {}),
        ...(e.sku ? {sku: e.sku} : {}),
        ...(e.brand ? {brand: e.brand} : {}),
        ...(offers ? {offers} : {}),
    };
}

function article(e: ArticleEntry): object {
    const author = e.author ? {
        '@type': 'Person',
        name: e.author.name,
        ...(e.author.url ? {url: e.author.url} : {}),
    } : undefined;
    const publisher = e.publisher ? {
        '@type': 'Organization',
        name: e.publisher.name,
        ...(e.publisher.logo ? {logo: {'@type': 'ImageObject', url: e.publisher.logo}} : {}),
    } : undefined;
    return {
        ...SCHEMA_CTX,
        '@type': 'Article',
        headline: e.headline,
        ...(e.image ? {image: e.image} : {}),
        datePublished: e.datePublished,
        ...(e.dateModified ? {dateModified: e.dateModified} : {}),
        ...(author ? {author} : {}),
        ...(publisher ? {publisher} : {}),
    };
}

function localBusiness(e: LocalBusinessEntry): object {
    const ohs = e.openingHoursSpecification?.map(s => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: s.dayOfWeek,
        opens: s.opens,
        closes: s.closes,
    }));
    return {
        ...SCHEMA_CTX,
        '@type': 'LocalBusiness',
        name: e.name,
        ...(e.image ? {image: e.image} : {}),
        ...(e.telephone ? {telephone: e.telephone} : {}),
        ...(e.priceRange ? {priceRange: e.priceRange} : {}),
        address: {
            '@type': 'PostalAddress',
            streetAddress: e.address.streetAddress,
            addressLocality: e.address.addressLocality,
            ...(e.address.addressRegion ? {addressRegion: e.address.addressRegion} : {}),
            postalCode: e.address.postalCode,
            addressCountry: e.address.addressCountry,
        },
        ...(e.geo ? {geo: {'@type': 'GeoCoordinates', latitude: e.geo.latitude, longitude: e.geo.longitude}} : {}),
        ...(ohs && ohs.length ? {openingHoursSpecification: ohs} : {}),
    };
}

function event(e: EventEntry): object {
    const loc = 'url' in e.location
        ? {'@type': 'VirtualLocation', url: e.location.url}
        : {
            '@type': 'Place',
            name: e.location.name,
            ...(e.location.address ? {address: e.location.address} : {}),
        };
    const offers = e.offers ? {
        '@type': 'Offer',
        url: e.offers.url,
        price: e.offers.price,
        priceCurrency: e.offers.priceCurrency,
        ...(e.offers.availability ? {availability: `${SCHEMA_URL}/${e.offers.availability}`} : {}),
    } : undefined;
    return {
        ...SCHEMA_CTX,
        '@type': 'Event',
        name: e.name,
        startDate: e.startDate,
        ...(e.endDate ? {endDate: e.endDate} : {}),
        location: loc,
        ...(e.image ? {image: e.image} : {}),
        ...(e.description ? {description: e.description} : {}),
        ...(offers ? {offers} : {}),
    };
}

function breadcrumbList(e: BreadcrumbListEntry): object {
    return {
        ...SCHEMA_CTX,
        '@type': 'BreadcrumbList',
        itemListElement: e.items.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: it.item,
        })),
    };
}

function faqPage(e: FaqPageEntry): object {
    return {
        ...SCHEMA_CTX,
        '@type': 'FAQPage',
        mainEntity: e.questions.map(q => ({
            '@type': 'Question',
            name: q.question,
            acceptedAnswer: {'@type': 'Answer', text: q.answer},
        })),
    };
}

export function toJsonLd(entry: SchemaOrgEntry): object {
    switch (entry.kind) {
        case 'organization': return organization(entry);
        case 'product': return product(entry);
        case 'article': return article(entry);
        case 'localBusiness': return localBusiness(entry);
        case 'event': return event(entry);
        case 'breadcrumbList': return breadcrumbList(entry);
        case 'faqPage': return faqPage(entry);
    }
}

const SchemaOrgInjector: React.FC<SchemaOrgInjectorProps> = ({entries, testId = 'schema-org-injector'}) => {
    if (!entries.length) return null;
    return (
        <>
            {entries.map((entry, i) => (
                <script
                    key={`${entry.kind}-${i}`}
                    type="application/ld+json"
                    data-testid={`${testId}-${entry.kind}-${i}`}
                    dangerouslySetInnerHTML={{__html: JSON.stringify(toJsonLd(entry))}}
                />
            ))}
        </>
    );
};

export default SchemaOrgInjector;
export {SchemaOrgInjector};
