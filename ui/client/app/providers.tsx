'use client';

/**
 * App Router client providers — App Router migration, Batch 1.
 *
 * This is the App-Router equivalent of the provider stack the legacy
 * `pages/_app.tsx` `render()` wrapped every page in. It is a Client
 * Component because every provider here (`SessionProvider`,
 * `ConfigProvider`, `I18nProvider`, the side-effect hosts) needs the
 * browser runtime / React context.
 *
 * The Server Component root layout (`app/layout.tsx`) resolves locale +
 * i18n resources + the initial NextAuth session server-side and hands
 * them in as props, so the client instances hydrate without a
 * loading-flicker (risk-map #9 — `useSession()` flicker on tab focus).
 *
 * NOT ported here (deliberately, Batch 1 scope):
 *  - The per-page public shell `ConfigProvider` with the live DB theme
 *    config still lives in `pages/app.tsx` (the SiteShell). The static
 *    leaf pages migrated in Batch 1 only need antd's static defaults,
 *    so this layout mounts a plain `ConfigProvider` with `staticTheme`.
 *    When the dynamic pages migrate in a later batch, the SiteShell's
 *    theme-config wiring moves alongside them.
 *  - `appWithTranslation` HOC — replaced by `<I18nProvider>` below.
 *  - `NextCookies` / `universalLanguageDetect` initial-props chain —
 *    replaced by `cookies()` / `headers()` reads in `layout.tsx`.
 */
import React from 'react';
import {SessionProvider} from 'next-auth/react';
import type {Session} from 'next-auth';
import {ConfigProvider} from 'antd';
import {AntdRegistry} from '@ant-design/nextjs-registry';
import {I18nProvider} from 'next-i18next/client';
import type {Resource} from 'i18next';
import staticTheme from '@client/features/Themes/themeConfig';
import InlineTranslationHost from '@client/lib/InlineTranslationHost';
import HighContrastAutoPick from '@client/lib/HighContrastAutoPick';
import {PresenceHost} from '@client/features/Presence/PresenceBar';
import SkipLink from '@client/components/SkipLink';
import CookieConsent from '@client/components/CookieConsent';
import AnalyticsHost from '@client/lib/analytics/AnalyticsHost';
import SignupBanner from '@client/components/Auth/SignupBanner';
import CartDrawer from '@client/components/Commerce/CartDrawer';
import ClientRuntimeHost from './ClientRuntimeHost';
import {I18N_DEFAULT_NS, SUPPORTED_LNGS} from './i18n';

interface ProvidersProps {
    children: React.ReactNode;
    /** Resolved request locale (from `layout.tsx` server detection). */
    language: string;
    /** Server-loaded i18next resources to hydrate the client instance. */
    resources: Resource;
    /** Initial NextAuth session, read server-side to avoid a loading flash. */
    session: Session | null;
}

/**
 * Provider order mirrors `_app.tsx`:
 *  - `<AntdRegistry>` outermost so antd's cssinjs styles are collected
 *    into the SSR `<style>` registry (risk-map #1 — without this you get
 *    FOUC + duplicate `<style>` tags in production only). This replaces
 *    the `_document.tsx` `StyleProvider` + `extractStyle` `enhanceApp`.
 *  - `<SessionProvider>` seeded with the server-resolved session.
 *  - `<I18nProvider>` hydrated with server resources — App-Router analog
 *    of `appWithTranslation`.
 *  - `<ConfigProvider>` for antd's static theme defaults.
 *
 * The side-effect hosts (`InlineTranslationHost`, `HighContrastAutoPick`,
 * `PresenceHost`, `AnalyticsHost`, `SignupBanner`, `CartDrawer`,
 * `CookieConsent`, `SkipLink`) and the `componentDidMount` runtime work
 * (`ClientRuntimeHost`) are mounted as siblings of `children`, exactly
 * as they were siblings of `<Component/>` in `_app.tsx`.
 */
export default function Providers({
    children,
    language,
    resources,
    session,
}: ProvidersProps): React.ReactElement {
    return (
        <AntdRegistry>
            <SessionProvider session={session}>
                <I18nProvider
                    language={language}
                    resources={resources}
                    supportedLngs={SUPPORTED_LNGS}
                    defaultNS={I18N_DEFAULT_NS}
                    /* No `fallbackLng` prop — the v16 client `I18nProvider`
                       typing only accepts a string / string[] / map, not
                       the `false` the Pages-Router config uses. Omitting it
                       gives the same "no cross-locale key bleed" behaviour:
                       a missing key resolves to the source string via the
                       resources we hydrate with, not to another locale. */
                >
                    <ConfigProvider theme={staticTheme}>
                        {/* W8a — skip link must be the FIRST focusable element. */}
                        <SkipLink/>
                        {children}
                        {/* Side-effect hosts — direct port of the `_app.tsx`
                            `render()` siblings. Each self-suppresses when its
                            backing site-flag is off, so mounting them
                            unconditionally is safe. */}
                        <InlineTranslationHost/>
                        <HighContrastAutoPick/>
                        <PresenceHost/>
                        <AnalyticsHost/>
                        <SignupBanner/>
                        <CookieConsent/>
                        <CartDrawer/>
                        {/* `componentDidMount` runtime work from `_app.tsx`
                            (service-worker unregister, error reporter, perf
                            beacon, marketing capture). */}
                        <ClientRuntimeHost/>
                    </ConfigProvider>
                </I18nProvider>
            </SessionProvider>
        </AntdRegistry>
    );
}
