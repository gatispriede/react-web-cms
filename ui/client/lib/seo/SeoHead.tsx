import React from 'react';
import Head from 'next/head';
import {serializeJsonLd} from './jsonLd';

/**
 * SeoHead — W8h SEO program § canonical + hreflang + JSON-LD.
 *
 * One component that emits the canonical / hreflang / OG / Twitter /
 * JSON-LD surface. Mount on any public page; pass the precomputed
 * alternates from the active language registry.
 *
 * Why a separate component (vs extending `app.tsx`): the in-page
 * `app.tsx` Head block already covers the basic OG tags for the
 * default page route. Per-page routes (`/blog/[slug]`, `/products/
 * [slug]`, ad-hoc landing pages) need a more compact surface that
 * doesn't go through the multi-tab state machine. Both paths now
 * share `jsonLd.ts` for the structured-data shapes.
 */

export interface SeoHeadAlternate {
    hreflang: string;
    href: string;
}

export interface SeoHeadProps {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    /** When false, emits `<meta name="robots" content="noindex,nofollow"/>`. */
    indexable?: boolean;
    ogImage?: string;
    ogType?: 'website' | 'article' | 'product';
    twitterHandle?: string;
    alternates?: SeoHeadAlternate[];
    /** JSON-LD payload(s). Pass an object, an array, or null. */
    jsonLd?: unknown | unknown[] | null;
}

const SeoHead: React.FC<SeoHeadProps> = ({
    title,
    description,
    canonicalUrl,
    indexable = true,
    ogImage,
    ogType = 'website',
    twitterHandle,
    alternates,
    jsonLd,
}) => {
    const jsonLdBody = jsonLd ? serializeJsonLd(jsonLd) : '';
    return (
        <Head>
            {title && <title>{title}</title>}
            {description && <meta name="description" content={description} key="meta-description"/>}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} key="canonical"/>}
            {!indexable && <meta name="robots" content="noindex,nofollow" key="robots-noindex"/>}
            {alternates && alternates.map((a) => (
                <link
                    key={`alt-${a.hreflang}`}
                    rel="alternate"
                    hrefLang={a.hreflang}
                    href={a.href}
                />
            ))}
            {title && <meta property="og:title" content={title} key="og-title"/>}
            {description && <meta property="og:description" content={description} key="og-description"/>}
            <meta property="og:type" content={ogType} key="og-type"/>
            {canonicalUrl && <meta property="og:url" content={canonicalUrl} key="og-url"/>}
            {ogImage && <meta property="og:image" content={ogImage} key="og-image"/>}
            <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} key="twitter-card"/>
            {twitterHandle && <meta name="twitter:site" content={twitterHandle} key="twitter-site"/>}
            {title && <meta name="twitter:title" content={title} key="twitter-title"/>}
            {description && <meta name="twitter:description" content={description} key="twitter-description"/>}
            {ogImage && <meta name="twitter:image" content={ogImage} key="twitter-image"/>}
            {jsonLdBody && (
                <script
                    key="jsonld"
                    type="application/ld+json"

                    dangerouslySetInnerHTML={{__html: jsonLdBody}}
                />
            )}
        </Head>
    );
};

export default SeoHead;
