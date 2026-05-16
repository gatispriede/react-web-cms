import '../styles/globals/global.scss'
// Marketing landing styles are global (`:root` custom-property tokens +
// `.marketing` class selectors). Next forbids global CSS imports outside
// `_app.tsx`, so we mount it here. Selectors are namespaced under
// `.marketing` so they don't bleed into the regular CMS site.
import '../styles/Marketing/landing.scss'
// Admin dark-mode overrides — applied via `[data-admin-theme="dark"]`
// on the document. See ui/admin/shell/AdminApp.tsx#toggleDarkMode.
import '../../admin/styles/Admin/AdminDarkMode.scss'
// Inline-edit overlay styles — global so the position:fixed overlay
// + highlight pill render on any admin-visible page.
import '../../admin/shell/InlineEdit/InlineEditOverlay.scss'
import '../../admin/shell/CommandPalette/CommandPalette.scss'
// Per-module SCSS hoisted here because Next 16 / Turbopack treats every
// `*.scss` (non-`.module.scss`) imported outside `_app.tsx` as a global-
// CSS violation. Whichever module is first in the dev compile order
// surfaces as 'Global CSS cannot be imported from files other than your
// Custom <App>'. Hoisting them all here moves the imports into the only
// chain Turbopack accepts. Component files keep a header comment
// pointing here so future maintainers don't re-add inline imports.
import '../components/FacetedFilter/FacetedFilter.scss'
import '../components/VatBadge.scss'
import '../lib/ComparisonTable/ComparisonTable.scss'
import '../lib/CookieConsentBanner/CookieConsentBanner.scss'
import '../lib/EmptyStateBlock.scss'
import '../lib/SaveSearchPrompt/SaveSearchPrompt.scss'
import '../lib/SchemaOrgInjector/SchemaOrgInjector.scss'
import '../lib/StickyCtaBar/StickyCtaBar.scss'
import '../modules/AccountDashboardGrid/AccountDashboardGrid.scss'
import '../modules/BeforeAfterSlider/BeforeAfterSlider.scss'
import '../modules/Breadcrumb/Breadcrumb.scss'
import '../modules/CarComparisonTable/CarComparisonTable.scss'
import '../modules/CarFinanceEstimator/CarFinanceEstimator.scss'
import '../modules/CarListingCard/CarListingCard.scss'
import '../modules/CarPhotoGallery/CarPhotoGallery.scss'
import '../modules/CarReservationCta/CarReservationCta.scss'
import '../modules/CarSpecTable/CarSpecTable.scss'
import '../modules/CarVehicleDetailPage/CarVehicleDetailPage.scss'
import '../modules/ChangelogTimeline/ChangelogTimeline.scss'
import '../modules/Checkout/AccountWelcome/AccountWelcome.scss'
import '../modules/Checkout/CartActions/CartActions.scss'
import '../modules/Checkout/CartLineItems/CartLineItems.scss'
import '../modules/Checkout/CartSummary/CartSummary.scss'
import '../modules/Checkout/CheckoutAddressForm/CheckoutAddressForm.scss'
import '../modules/Checkout/CheckoutCartSummary/CheckoutCartSummary.scss'
import '../modules/Checkout/CheckoutPaymentForm/CheckoutPaymentForm.scss'
import '../modules/Checkout/CheckoutProgressBar/CheckoutProgressBar.scss'
import '../modules/Checkout/CheckoutShippingMethod/CheckoutShippingMethod.scss'
import '../modules/Checkout/DownloadInvoiceButton/DownloadInvoiceButton.scss'
import '../modules/Checkout/MagicLinkAccountUpgrade/MagicLinkAccountUpgrade.scss'
import '../modules/Checkout/OrderSummary/OrderSummary.scss'
import '../modules/Checkout/PlaceOrderButton/PlaceOrderButton.scss'
import '../modules/Checkout/ShippingCalculator/ShippingCalculator.scss'
import '../modules/ContactBlock/ContactBlock.scss'
import '../modules/CountdownTimer/CountdownTimer.scss'
import '../modules/EventBuyTicketsCta/EventBuyTicketsCta.scss'
import '../modules/EventHeroVideo/EventHeroVideo.scss'
import '../modules/EventScheduleAgenda/EventScheduleAgenda.scss'
import '../modules/FeatureGrid/FeatureGrid.scss'
import '../modules/IntegrationGrid/IntegrationGrid.scss'
import '../modules/KeyValueDossier/KeyValueDossier.scss'
import '../modules/LogoCloud/LogoCloud.scss'
import '../modules/MagicLinkConfirmation/MagicLinkConfirmation.scss'
import '../modules/MagicLinkRequestForm/MagicLinkRequestForm.scss'
import '../modules/Marketing/ReferAFriendCta/ReferAFriendCta.scss'
import '../modules/Marketing/SocialShareButtons/SocialShareButtons.scss'
import '../modules/MetricsCallout/MetricsCallout.scss'
import '../modules/OauthButtonStack/OauthButtonStack.scss'
import '../modules/OpeningHours/OpeningHours.scss'
import '../modules/OrderDetailModule/OrderDetailModule.scss'
import '../modules/OrderProgressTimeline/OrderProgressTimeline.scss'
import '../modules/Pagination/Pagination.scss'
import '../modules/PricingTable/PricingTable.scss'
import '../modules/ProcessTimeline/ProcessTimeline.scss'
import '../modules/Product/Product.scss'
import '../modules/ProductDescription/ProductDescription.scss'
import '../modules/ProductDetailHero/ProductDetailHero.scss'
import '../modules/ProductScreenshotHero/ProductScreenshotHero.scss'
import '../modules/ProductSpecTable/ProductSpecTable.scss'
import '../modules/ProjectCaseStudy/ProjectCaseStudy.scss'
import '../modules/ProjectTileGrid/ProjectTileGrid.scss'
import '../modules/ReservationWidget/ReservationWidget.scss'
import '../modules/RestaurantMenu/RestaurantMenu.scss'
import '../modules/SavedSearchList/SavedSearchList.scss'
import '../modules/SectionHeading/SectionHeading.scss'
import '../modules/ServicesGridFancy/ServicesGridFancy.scss'
import '../modules/SpeakerGrid/SpeakerGrid.scss'
import '../modules/SponsorStrip/SponsorStrip.scss'
import '../modules/TestimonialWall/TestimonialWall.scss'
import '../modules/Trust/MoneyBackGuarantee/MoneyBackGuarantee.scss'
import '../modules/Trust/TrustBadges/TrustBadges.scss'
import '../modules/WishlistGrid/WishlistGrid.scss'
import { appWithTranslation } from 'next-i18next/pages'
import nextI18NextConfig from '../../../next-i18next.config.js'
import NextApp, {AppContext} from 'next/app';
import NextCookies from 'next-cookies';
import universalLanguageDetect from '@unly/universal-language-detector';
import get from 'lodash.get';
import { NextComponentType, NextPageContext } from 'next';
import { AppTreeType } from 'next/dist/shared/lib/utils';
import { Router } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import InlineTranslationHost from '@client/lib/InlineTranslationHost';
import HighContrastAutoPick from '@client/lib/HighContrastAutoPick';
import {PresenceHost} from '@client/features/Presence/PresenceBar';
import {installErrorReporter} from '@client/lib/reportError';
import AnalyticsHost from '@client/lib/analytics/AnalyticsHost';
import {startPerfBeacon} from '@client/lib/perfBeacon';
import {captureMarketingHit} from '@client/lib/marketingCapture';
// W8b — GDPR cookie-consent banner. Built on the canonical
// `@client/lib/consent` lib (storage + DNT/GPC signals + cookie registry).
import {ConsentBanner} from '@client/features/Consent';
import SkipLink from '@client/components/SkipLink';
import CartDrawer from '@client/components/Commerce/CartDrawer';
import SignupBanner from '@client/components/Auth/SignupBanner';
// Lazy dynamic import — keeps `axe-core` out of the prod bundle entirely.
// `_app.tsx` only renders <AxeDevPanel/> when NODE_ENV !== 'production', so
// the dynamic import sits behind a dead-code-eliminable typeof-guard.
import dynamic from 'next/dynamic';
const AxeDevPanel = process.env.NODE_ENV !== 'production'
    ? dynamic(() => import('@client/lib/a11y/AxeDevPanel'), {ssr: false})
    : null;

export const FALLBACK_LANG = nextI18NextConfig.i18n.defaultLocale;
export const SUPPORTED_LANGUAGES = nextI18NextConfig.i18n.locales

class App extends NextApp {
    static async getInitialProps(props: { ctx: any; Component?: NextComponentType<NextPageContext, {}, {}>; AppTree?: AppTreeType; router?: Router; }) {
        const { ctx } = props;
        const { req } = ctx;
        const cookies = NextCookies(ctx); // Parses Next.js cookies in a universal way (server + client) - It's an object

        // Universally detects the user's language
        const lang = universalLanguageDetect({
            supportedLanguages: SUPPORTED_LANGUAGES, // Whitelist of supported languages, will be used to filter out languages that aren't supported
            fallbackLanguage: FALLBACK_LANG, // Fallback language in case the user's language cannot be resolved
            acceptLanguageHeader: get(req, 'headers.accept-language'), // Optional - Accept-language header will be used when resolving the language on the server side
            serverCookies: cookies, // Optional - Cookie "i18next" takes precedence over navigator configuration (ex: "i18next: fr"), will only be used on the server side
            errorHandler: (error, level, origin, context) => { // Optional - Use you own logger here, Sentry, etc.
                console.log('Custom error handler:');
                console.error(error);

                // Example if using Sentry in your app:
                // Sentry.withScope((scope): void => {
                //   scope.setExtra('level', level);
                //   scope.setExtra('origin', origin);
                //   scope.setContext('context', context);
                //   Sentry.captureException(error);
                // });
            },
        });

        // Calls page's `getInitialProps` and fills `appProps.pageProps` - XXX See https://nextjs.org/docs#custom-app
        const appProps = await NextApp.getInitialProps(props as AppContext);

        appProps.pageProps = {
            ...appProps.pageProps,
            cookies, // Object containing all cookies
            lang, // i.e: 'en'
            isSSR: !!req,
        };

        return { ...appProps };
    }

    componentDidMount() {
        // Unregister any stale Service Workers — they cache 404 HTML responses
        // for image URLs and serve them back after the images are uploaded.
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
                regs.forEach(r => r.unregister());
            });
        }
        // Surface uncaught errors + rejections to the server. Public-site
        // pages report as `source: 'client'`; the admin shell installs
        // again with `'admin'` after it mounts, which overrides the source
        // for the rest of the tab's lifetime.
        installErrorReporter({source: 'client'});
        // Core Web Vitals RUM beacon — W8d. Self-samples at 10 %; no-op on
        // privacy opt-out (GPC/DNT). Lazy-imports `web-vitals` so the lib
        // never lands in the critical homepage bundle.
        startPerfBeacon();
        // W6c — marketing attribution capture (UTM + ref + referrer).
        // Best-effort, fire-and-forget; never blocks the page. Honours
        // a `sessionStorage` idempotency flag so SPA navigations inside
        // the same tab don't double-post.
        captureMarketingHit();
    }

    render() {
        const { Component, pageProps, router, err } = this.props;
        const modifiedPageProps = {
            ...pageProps,
            err,
            router,
        };

        // Auth-split-client-admin (Phase 1.A) — admin routes talk to the
        // admin NextAuth instance at /api/admin/auth/*; everything else
        // (storefront, /account/*, customer flows) uses the customer
        // instance at /api/auth/*. Without this, `useSession()` polls the
        // wrong endpoint and `signIn()` reads the wrong `pages.signIn`
        // setting — admin users hitting /admin get bounced to
        // /account/signin (which itself 404s when clientLoginEnabled is
        // off). See ui/client/pages/api/auth/authOptions.ts and
        // ui/client/pages/api/admin/auth/[...nextauth].ts.
        const pathname = router?.pathname ?? '';
        const sessionBasePath = pathname.startsWith('/admin') ? '/api/admin/auth' : '/api/auth';

        return (
            <SessionProvider session={(pageProps as any)?.session} basePath={sessionBasePath}>
                {/* W8a — skip link must be the FIRST focusable element. */}
                <SkipLink/>
                <Component {...modifiedPageProps} />
                <InlineTranslationHost/>
                <HighContrastAutoPick/>
                <PresenceHost/>
                <AnalyticsHost/>
                {/* Phase 1.A — auth-split-client-admin: storefront signup banner.
                    Self-suppresses when auth.clientLoginEnabled is false. */}
                <SignupBanner/>
                <ConsentBanner/>
                {/* Commerce cart drawer — self-suppresses when
                    commerce.checkoutEnabled is false. Safe to mount
                    unconditionally; renders null on catalogue-only sites. */}
                <CartDrawer/>
                {AxeDevPanel ? <AxeDevPanel/> : null}
            </SessionProvider>
        );
    }
}


export default appWithTranslation(App, nextI18NextConfig)