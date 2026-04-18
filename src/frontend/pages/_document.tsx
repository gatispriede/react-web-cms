import {createCache, extractStyle, StyleProvider} from '@ant-design/cssinjs';
import Document, {Head, Html, Main, NextScript} from 'next/document';
import type {DocumentContext} from 'next/document';
import React from "react";
import {resolve} from "../gqty";
import {IPage} from "../../Interfaces/IPage";
import {INavigation} from "../../Interfaces/INavigation";
import {IMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import i18nextConfig from '../../../next-i18next.config.js'
import {buildThemeCssVarsRule} from '../theme/themeCssVarsString';
import {getMongoConnection} from '../../Server/mongoDBConnection';
import {IThemeTokens} from '../../Interfaces/ITheme';

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
}

class MyDocument extends Document<MyDocProps> {
    render(){
        const currentLocale =
            this.props.__NEXT_DATA__.locale ??
            i18nextConfig.i18n.defaultLocale
        const {themeCss, preloadedScript} = this.props;
        return (
            <Html lang={currentLocale}>
                <Head>
                    <meta charSet="utf-8" />
                    {themeCss && (
                        <style data-theme-vars dangerouslySetInnerHTML={{__html: themeCss}}/>
                    )}
                    {preloadedScript && (
                        <script dangerouslySetInnerHTML={{__html: preloadedScript}}/>
                    )}
                </Head>
                <body>
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

    const [initialProps, themeTokens, preloaded] = await Promise.all([
        Document.getInitialProps(ctx),
        loadActiveThemeTokens(),
        preloadData(),
    ]);
    // @ts-ignore — legacy global for any consumer that still reads it server-side
    global.preloadedData = preloaded;
    const style = extractStyle(cache, true);
    const themeCss = buildThemeCssVarsRule(themeTokens);
    const preloadedScript = `window.preloadedData = ${JSON.stringify(preloaded)}`;
    return {
        ...initialProps,
        themeCss,
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