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


// import {unstable_cache} from "next/cache";

// const isProduction = process.env.NODE_ENV === 'production';
// let myCache: { pages: IPage[]; sectionsData: ISection[][]; } | undefined = undefined

const preloadData = async () => {
    const pages  = await resolve(
        ({query}): IPage[] => {
            const list: any[] = [];
            (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                list.push({
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

const HeadData = async () => {
    // const myCacheLoader = unstable_cache(async () => preloadData(), ['preloadedData'], {
    //     revalidate: 1
    // })
    const data = await preloadData()
    // @ts-ignore
    global.preloadedData = data
    const str = `window.preloadedData = ${JSON.stringify(data)}`
    return (
        <Head>
            <script type="text/javascript">
                {str}
            </script>
        </Head>
    )
}
class MyDocument extends Document<{}> {
    render(){
        const currentLocale =
            this.props.__NEXT_DATA__.locale ??
            i18nextConfig.i18n.defaultLocale
        return (
            <Html lang={currentLocale}>
                <meta charSet="utf-8" />
                <HeadData/>
                <body>
                <Main/>
                <NextScript/>
                </body>
            </Html>
        )
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

    const initialProps = await Document.getInitialProps(ctx);


    const style = extractStyle(cache, true);
    return {
        ...initialProps,
        styles: (
            <>
                {initialProps.styles}
                <style dangerouslySetInnerHTML={{__html: style}}/>
            </>
        ),
    };
};

export default MyDocument;