/**
 * Root App-Router layout — App Router migration, Batch 1.
 *
 * This is the App-Router equivalent of `pages/_app.tsx` + `pages/_document.tsx`
 * combined. It is a **Server Component** so it can read `cookies()` /
 * `headers()` for locale detection and resolve the active theme tokens +
 * Google Fonts URL server-side (exactly what `_document.tsx`'s
 * `getInitialProps` did).
 *
 * What was ported from where:
 *
 *  - `_document.tsx` `<Html lang>` / `<body data-theme-name>` / theme CSS
 *    vars `<style data-theme-vars>` / Google Fonts `<link>` / favicon
 *    links  →  the JSX returned below.
 *  - `_app.tsx`'s hoisted **global SCSS imports** (`global.scss`,
 *    `Marketing/landing.scss`, admin dark-mode, inline-edit overlay,
 *    command palette, and the long per-module SCSS list) → imported at
 *    the top of this file. Next App Router only allows global CSS from
 *    `app/layout.tsx`, so this is the new single hoist point — the
 *    Pages-Router `_app.tsx` keeps its own copy for the not-yet-migrated
 *    pages-router pages (both routers run concurrently).
 *  - `_app.tsx` `universalLanguageDetect` / `NextCookies` initial-props
 *    chain → `resolveRequestLocale()` below, reading the `i18next` cookie
 *    then `Accept-Language`.
 *  - `_app.tsx`'s provider stack + side-effect hosts → delegated to the
 *    `'use client'` `app/providers.tsx` (`SessionProvider`,
 *    `AntdRegistry`, `I18nProvider`, `ConfigProvider`, the hosts).
 *  - `_document.tsx` antd cssinjs `StyleProvider` + `extractStyle`
 *    `enhanceApp`  →  `<AntdRegistry>` inside `providers.tsx`
 *    (risk-map #1).
 *
 * NOT ported (deliberately out of Batch-1 scope):
 *  - The dead `global.preloadedData` / `window.preloadedData` inline
 *    `<script>` payload from `_document.tsx` — risk-map #14 says delete,
 *    not port. It is simply omitted here.
 *  - `force-dynamic` vs `revalidate` tuning for the DB-driven fonts URL
 *    (risk-map #3). Batch 1 uses `force-dynamic` as the safe default so
 *    a theme change is always reflected; the `revalidateTag('theme')`
 *    optimisation is deferred to the batch that migrates the dynamic
 *    public pages.
 */
import '../styles/globals/global.scss';
// Marketing landing styles are global (`:root` custom-property tokens +
// `.marketing` class selectors). Selectors are namespaced under
// `.marketing` so they don't bleed into the regular CMS site.
import '../styles/Marketing/landing.scss';
// Admin dark-mode overrides — applied via `[data-admin-theme="dark"]`.
import '../../admin/styles/Admin/AdminDarkMode.scss';
// Inline-edit overlay styles — global so the position:fixed overlay +
// highlight pill render on any admin-visible page.
import '../../admin/shell/InlineEdit/InlineEditOverlay.scss';
import '../../admin/shell/CommandPalette/CommandPalette.scss';
// Per-module SCSS hoisted here for the same reason `_app.tsx` hoists them
// on the Pages-Router side: Next treats every `*.scss` (non-`.module.scss`)
// imported outside the root layout / Custom App as a global-CSS violation.
import '../components/FacetedFilter/FacetedFilter.scss';
import '../components/VatBadge.scss';
import '../lib/ComparisonTable/ComparisonTable.scss';
import '../lib/CookieConsentBanner/CookieConsentBanner.scss';
import '../lib/EmptyStateBlock.scss';
import '../lib/SaveSearchPrompt/SaveSearchPrompt.scss';
import '../lib/SchemaOrgInjector/SchemaOrgInjector.scss';
import '../lib/StickyCtaBar/StickyCtaBar.scss';
import '../modules/AccountDashboardGrid/AccountDashboardGrid.scss';
import '../modules/BeforeAfterSlider/BeforeAfterSlider.scss';
import '../modules/Breadcrumb/Breadcrumb.scss';
import '../modules/CarComparisonTable/CarComparisonTable.scss';
import '../modules/CarFinanceEstimator/CarFinanceEstimator.scss';
import '../modules/CarListingCard/CarListingCard.scss';
import '../modules/CarPhotoGallery/CarPhotoGallery.scss';
import '../modules/CarReservationCta/CarReservationCta.scss';
import '../modules/CarSpecTable/CarSpecTable.scss';
import '../modules/CarVehicleDetailPage/CarVehicleDetailPage.scss';
import '../modules/ChangelogTimeline/ChangelogTimeline.scss';
import '../modules/Checkout/AccountWelcome/AccountWelcome.scss';
import '../modules/Checkout/CartActions/CartActions.scss';
import '../modules/Checkout/CartLineItems/CartLineItems.scss';
import '../modules/Checkout/CartSummary/CartSummary.scss';
import '../modules/Checkout/CheckoutAddressForm/CheckoutAddressForm.scss';
import '../modules/Checkout/CheckoutCartSummary/CheckoutCartSummary.scss';
import '../modules/Checkout/CheckoutPaymentForm/CheckoutPaymentForm.scss';
import '../modules/Checkout/CheckoutProgressBar/CheckoutProgressBar.scss';
import '../modules/Checkout/CheckoutShippingMethod/CheckoutShippingMethod.scss';
import '../modules/Checkout/DownloadInvoiceButton/DownloadInvoiceButton.scss';
import '../modules/Checkout/MagicLinkAccountUpgrade/MagicLinkAccountUpgrade.scss';
import '../modules/Checkout/OrderSummary/OrderSummary.scss';
import '../modules/Checkout/PlaceOrderButton/PlaceOrderButton.scss';
import '../modules/Checkout/ShippingCalculator/ShippingCalculator.scss';
import '../modules/ContactBlock/ContactBlock.scss';
import '../modules/CountdownTimer/CountdownTimer.scss';
import '../modules/EventBuyTicketsCta/EventBuyTicketsCta.scss';
import '../modules/EventHeroVideo/EventHeroVideo.scss';
import '../modules/EventScheduleAgenda/EventScheduleAgenda.scss';
import '../modules/FeatureGrid/FeatureGrid.scss';
import '../modules/IntegrationGrid/IntegrationGrid.scss';
import '../modules/LogoCloud/LogoCloud.scss';
import '../modules/MagicLinkConfirmation/MagicLinkConfirmation.scss';
import '../modules/MagicLinkRequestForm/MagicLinkRequestForm.scss';
import '../modules/Marketing/ReferAFriendCta/ReferAFriendCta.scss';
import '../modules/Marketing/SocialShareButtons/SocialShareButtons.scss';
import '../modules/MetricsCallout/MetricsCallout.scss';
import '../modules/OauthButtonStack/OauthButtonStack.scss';
import '../modules/OpeningHours/OpeningHours.scss';
import '../modules/OrderDetailModule/OrderDetailModule.scss';
import '../modules/OrderProgressTimeline/OrderProgressTimeline.scss';
import '../modules/Pagination/Pagination.scss';
import '../modules/PricingTable/PricingTable.scss';
import '../modules/ProcessTimeline/ProcessTimeline.scss';
import '../modules/Product/Product.scss';
import '../modules/ProductDescription/ProductDescription.scss';
import '../modules/ProductDetailHero/ProductDetailHero.scss';
import '../modules/ProductScreenshotHero/ProductScreenshotHero.scss';
import '../modules/ProductSpecTable/ProductSpecTable.scss';
import '../modules/ProjectCaseStudy/ProjectCaseStudy.scss';
import '../modules/ProjectTileGrid/ProjectTileGrid.scss';
import '../modules/ReservationWidget/ReservationWidget.scss';
import '../modules/RestaurantMenu/RestaurantMenu.scss';
import '../modules/SavedSearchList/SavedSearchList.scss';
import '../modules/ServicesGridFancy/ServicesGridFancy.scss';
import '../modules/SpeakerGrid/SpeakerGrid.scss';
import '../modules/SponsorStrip/SponsorStrip.scss';
import '../modules/TestimonialWall/TestimonialWall.scss';
import '../modules/Trust/MoneyBackGuarantee/MoneyBackGuarantee.scss';
import '../modules/Trust/TrustBadges/TrustBadges.scss';
import '../modules/WishlistGrid/WishlistGrid.scss';

import React from 'react';
import {cookies, headers} from 'next/headers';
import {getServerSession} from 'next-auth/next';
import {getT, getResources} from 'next-i18next/server';
import {buildThemeCssVarsRule} from '@client/features/Themes/themeCssVarsString';
import {buildGoogleFontsUrl, extractFontFamily} from '@client/features/Themes/googleFonts';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import type {IThemeTokens} from '@interfaces/ITheme';
import type {Session} from 'next-auth';
import {authOptions} from '@client/pages/api/auth/authOptions';
import Providers from './providers';
import {FALLBACK_LNG, SUPPORTED_LNGS, I18N_NAMESPACES} from './i18n';

/**
 * The Google Fonts URL is composed from the active theme's font tokens,
 * which live in Mongo and change whenever an operator switches theme.
 * `next/font` (build-time) cannot model that, so the layout opts out of
 * static rendering. `force-dynamic` is the safe Batch-1 default — a
 * `revalidate` TTL + `revalidateTag('theme')` is the documented
 * follow-up optimisation (risk-map #3), deferred to the dynamic-pages
 * batch.
 */
export const dynamic = 'force-dynamic';

// Bundled families come from the seeded preset themes (Paper / Studio /
// Industrial). They stay loaded on every page even when a different
// theme is active so an editor activating "Studio" mid-session doesn't
// FOUC its way out of the previous theme's typography.
const BUNDLED_FAMILIES = [
    'Instrument Serif', 'JetBrains Mono', 'Inter Tight',
    'Fraunces', 'Geist Mono', 'Geist',
    'Barlow Condensed', 'Barlow',
];

/**
 * App-Router port of `_app.tsx`'s `universalLanguageDetect`. The
 * Pages-Router helper consulted the `i18next` cookie first, then the
 * `Accept-Language` header, falling back to the default locale. We read
 * the same cookie name (`app/i18n.ts` keeps `cookieName: 'i18next'`) so
 * a locale picked on a Pages-Router page carries over.
 */
async function resolveRequestLocale(): Promise<string> {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get('i18next')?.value;
    if (fromCookie && SUPPORTED_LNGS.includes(fromCookie)) {
        return fromCookie;
    }
    const headerStore = await headers();
    const acceptLanguage = headerStore.get('accept-language') ?? '';
    for (const part of acceptLanguage.split(',')) {
        const tag = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
        if (tag && SUPPORTED_LNGS.includes(tag)) {
            return tag;
        }
    }
    return FALLBACK_LNG;
}

/** Port of `_document.tsx` `loadActiveThemeTokens` — best-effort DB read. */
async function loadActiveThemeTokens(): Promise<IThemeTokens | null> {
    try {
        const conn = getMongoConnection();
        const active = await conn.themeService?.getActive();
        return active?.tokens ?? null;
    } catch (err) {
        console.warn('[app/layout] theme token fetch failed:', err);
        return null;
    }
}

/** Port of `_document.tsx` `loadSelfHostFontsFlag` — best-effort DB read. */
async function loadSelfHostFontsFlag(): Promise<boolean> {
    try {
        const conn = getMongoConnection();
        const flags = await conn.siteFlagsService?.get();
        return Boolean(flags?.selfHostFonts);
    } catch (err) {
        console.warn('[app/layout] site flags fetch failed:', err);
        return false;
    }
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}): Promise<React.ReactElement> {
    const locale = await resolveRequestLocale();

    // Server-side i18n: `app/i18n.ts` runs `initServerI18next()` at module
    // scope (it is imported above), so `getT` here resolves against the
    // already-initialised singleton. Resources are handed to the client
    // `<I18nProvider>` inside `<Providers>` so client components hydrate
    // without re-fetching — the App-Router analog of `appWithTranslation`.
    const {i18n} = await getT(I18N_NAMESPACES, {lng: locale});
    const resources = getResources(i18n, I18N_NAMESPACES);

    // Seed the NextAuth session server-side so `useSession()` doesn't
    // flicker `loading` on mount / tab focus (risk-map #9).
    const session = (await getServerSession(authOptions)) as Session | null;

    // Theme tokens + self-host flag + fonts URL — direct port of the
    // `_document.tsx` `getInitialProps` block.
    const [themeTokens, selfHostFonts] = await Promise.all([
        loadActiveThemeTokens(),
        loadSelfHostFontsFlag(),
    ]);
    const themeCss = buildThemeCssVarsRule(themeTokens);
    const themeSlug =
        typeof themeTokens?.themeSlug === 'string' ? themeTokens.themeSlug : undefined;
    const themeFamilies = themeTokens
        ? [
            extractFontFamily(themeTokens.fontDisplay),
            extractFontFamily(themeTokens.fontSans),
            extractFontFamily(themeTokens.fontMono),
        ]
        : [];
    const googleFontsUrl =
        buildGoogleFontsUrl([...BUNDLED_FAMILIES, ...themeFamilies], {selfHost: selfHostFonts}) ??
        undefined;

    return (
        <html lang={locale}>
            <head>
                <meta charSet="utf-8"/>
                {/* Favicon — served from `/api/favicon` so the active site
                    Logo (or theme override) drives it dynamically. Falls
                    back to a static `/favicon.svg` for cold boots. */}
                <link rel="icon" href="/api/favicon" type="image/svg+xml"/>
                <link rel="alternate icon" href="/favicon.svg" type="image/svg+xml"/>
                <link rel="apple-touch-icon" href="/api/favicon"/>
                {/* Fonts: bundled preset families plus the active theme's
                    picks, loaded up front so theme switches don't FOUC.
                    When `selfHostFonts` is on the URL points at our own
                    proxy, so skip the preconnect hints. */}
                {googleFontsUrl && !selfHostFonts && (
                    <link rel="preconnect" href="https://fonts.googleapis.com"/>
                )}
                {googleFontsUrl && !selfHostFonts && (
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
                )}
                {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl}/>}
                {themeCss && (
                    <style data-theme-vars dangerouslySetInnerHTML={{__html: themeCss}}/>
                )}
            </head>
            {/* `data-theme-name` MUST stay on `<body>` — the themed SCSS
                contract uses `[data-theme-name="paper"] …` ancestor
                selectors (risk-map #2). */}
            <body {...(themeSlug ? {'data-theme-name': themeSlug} : {})}>
                <Providers language={locale} resources={resources} session={session}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
