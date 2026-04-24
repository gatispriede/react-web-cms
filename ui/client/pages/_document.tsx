import {createCache, extractStyle, StyleProvider} from '@ant-design/cssinjs';
import Document, {Head, Html, Main, NextScript} from 'next/document';
import type {DocumentContext} from 'next/document';
import React from "react";
import {resolve} from "@services/api/generated";
import {IPage} from "@interfaces/IPage";
import {INavigation} from "@interfaces/INavigation";
import {IMongo} from "@interfaces/IMongo";
import {ISection} from "@interfaces/ISection";
import {IItem} from "@interfaces/IItem";
import i18nextConfig from '../../../next-i18next.config.js'
import {buildThemeCssVarsRule} from '@client/features/Themes/themeCssVarsString';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {IThemeTokens} from '@interfaces/ITheme';
import {buildGoogleFontsUrl, extractFontFamily} from '@client/features/Themes/googleFonts';

// Bundled families come from the seeded preset themes (Paper / Studio /
// Industrial). They stay loaded on every page even when a different theme
// is active so an editor activating "Studio" mid-session doesn't FOUC its
// way out of the previous theme's typography.
const BUNDLED_FAMILIES = [
    'Instrument Serif', 'JetBrains Mono', 'Inter Tight',
    'Fraunces', 'Geist Mono', 'Geist',
    'Barlow Condensed', 'Barlow',
];

// import {unstable_cache} from "next/cache";

// const isProduction = process.env.NODE_ENV === 'production';
// let myCache: { pages: IPage[]; sectionsData: ISection[][]; } | undefined = undefined

const preloadData = async () => {
    const pages  = await resolve(
        ({query}): IPage[] => {
            const list: any[] = [];
            (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                return list.push({
                    page: item.page,
                    sections: item.sections
                })
            })
            return list
        },
    )
    let sectionsData = []
    for (let id in pages) {
        if (pages[id]) {
            const sectionIds = pages[id].sections
            if (sectionIds.length > 0) {
                sectionsData.push(await resolve(
                    ({query}) => {
                        const list: ISection[] = (query as unknown as IMongo).mongo.getSections({ids: sectionIds}).map(item => {
                            let content: IItem[];
                            content = item.content.map((value: IItem) => {
                                return {
                                    name: value.name,
                                    type: value.type,
                                    content: value.content,
                                    action: value.action,
                                    actionType: value.actionType,
                                    actionContent: value.actionContent
                                }
                            })
                            return {
                                id: item.id,
                                type: item.type,
                                page: item.page,
                                content: content
                            }
                        })
                        return list
                    },
                ))
            }
        }
    }
    return {
        pages,
        sectionsData
    }
}
// const dayInSeconds = 60 * 60 * 24
// const cacheReleaseTime = process.env.NODE_ENV === 'production' ? dayInSeconds : 60

interface MyDocProps {
    themeCss?: string;
    preloadedScript?: string;
    themeSlug?: string;
    googleFontsUrl?: string;
    selfHostFonts?: boolean;
}

class MyDocument extends Document<MyDocProps> {
    render(){
        const currentLocale =
            this.props.__NEXT_DATA__.locale ??
            i18nextConfig.i18n.defaultLocale
        const {themeCss, preloadedScript, themeSlug, googleFontsUrl, selfHostFonts} = this.props;
        return (
            <Html lang={currentLocale}>
                <Head>
                    <meta charSet="utf-8" />
                    {/* Fonts: bundled preset families plus whatever the active
                        theme picked via the FontPicker are loaded up front so
                        theme switches don't FOUC. URL is composed in
                        getInitialProps from the active theme's font tokens.
                        When `selfHostFonts` is on the URL points at our own
                        proxy, so skip the preconnect hints — no reason to warm
                        up Google's CDN if the browser is never going to hit it. */}
                    {googleFontsUrl && !selfHostFonts && <link rel="preconnect" href="https://fonts.googleapis.com"/>}
                    {googleFontsUrl && !selfHostFonts && <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>}
                    {googleFontsUrl && <link rel="stylesheet" href={googleFontsUrl}/>}
                    {themeCss && (
                        <style data-theme-vars dangerouslySetInnerHTML={{__html: themeCss}}/>
                    )}
                    {preloadedScript && (
                        <script dangerouslySetInnerHTML={{__html: preloadedScript}}/>
                    )}
                </Head>
                <body {...(themeSlug ? {'data-theme-name': themeSlug} : {})}>
                <Main/>
                <NextScript/>
                </body>
            </Html>
        )
    }
}

async function loadActiveThemeTokens(): Promise<IThemeTokens | null> {
    try {
        const conn = getMongoConnection();
        const active = await conn.themeService?.getActive();
        return active?.tokens ?? null;
    } catch (err) {
        console.warn('[_document] theme token fetch failed:', err);
        return null;
    }
}

async function loadSelfHostFontsFlag(): Promise<boolean> {
    try {
        const conn = getMongoConnection();
        const flags = await conn.siteFlagsService?.get();
        return Boolean(flags?.selfHostFonts);
    } catch (err) {
        console.warn('[_document] site flags fetch failed:', err);
        return false;
    }
}

MyDocument.getInitialProps = async (ctx: DocumentContext) => {

    const cache = createCache();
    const originalRenderPage = ctx.renderPage;
    ctx.renderPage = () =>
        originalRenderPage({
            enhanceApp: (App) => (props) => (
                <StyleProvider cache={cache}>
                    <App {...props} />
                </StyleProvider>
            ),
        });

    const [initialProps, themeTokens, preloaded, selfHostFonts] = await Promise.all([
        Document.getInitialProps(ctx),
        loadActiveThemeTokens(),
        preloadData(),
        loadSelfHostFontsFlag(),
    ]);
    // @ts-ignore — legacy global for any consumer that still reads it server-side
    global.preloadedData = preloaded;
    const style = extractStyle(cache, true);
    const themeCss = buildThemeCssVarsRule(themeTokens);
    const themeSlug = typeof themeTokens?.themeSlug === 'string' ? themeTokens.themeSlug : undefined;
    const themeFamilies = themeTokens
        ? [
            extractFontFamily(themeTokens.fontDisplay),
            extractFontFamily(themeTokens.fontSans),
            extractFontFamily(themeTokens.fontMono),
        ]
        : [];
    const googleFontsUrl = buildGoogleFontsUrl([...BUNDLED_FAMILIES, ...themeFamilies], {selfHost: selfHostFonts}) ?? undefined;
    const preloadedScript = `window.preloadedData = ${JSON.stringify(preloaded)}`;
    return {
        ...initialProps,
        themeCss,
        themeSlug,
        googleFontsUrl,
        selfHostFonts,
        preloadedScript,
        styles: (
            <>
                {initialProps.styles}
                <style dangerouslySetInnerHTML={{__html: style}}/>
            </>
        ),
    };
};

export default MyDocument;