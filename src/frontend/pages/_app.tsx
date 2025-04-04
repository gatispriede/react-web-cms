import '../scss/global.scss'
import type { AppProps } from 'next/app'
import { appWithTranslation } from 'next-i18next'
import nextI18NextConfig from '../../../next-i18next.config.js'

function MyApp({Component, pageProps}: AppProps) {
    return <Component {...pageProps} />
}

export default appWithTranslation(MyApp, nextI18NextConfig)