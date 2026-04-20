import '../scss/global.scss'
import { appWithTranslation } from 'next-i18next'
import nextI18NextConfig from '../../../next-i18next.config.js'
import NextApp, {AppContext} from 'next/app';
import NextCookies from 'next-cookies';
import universalLanguageDetect from '@unly/universal-language-detector';
import get from 'lodash.get';
import { NextComponentType, NextPageContext } from 'next';
import { AppTreeType } from 'next/dist/shared/lib/utils';
import { Router } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import InlineTranslationHost from '../components/common/InlineTranslationHost';
import HighContrastAutoPick from '../components/common/HighContrastAutoPick';
import {PresenceHost} from '../components/common/PresenceBar';

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
    }

    render() {
        const { Component, pageProps, router, err } = this.props;
        const modifiedPageProps = {
            ...pageProps,
            err,
            router,
        };

        return (
            <SessionProvider session={(pageProps as any)?.session}>
                <Component {...modifiedPageProps} />
                <InlineTranslationHost/>
                <HighContrastAutoPick/>
                <PresenceHost/>
            </SessionProvider>
        );
    }
}


export default appWithTranslation(App, nextI18NextConfig)