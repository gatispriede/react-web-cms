// @ts-check
/**
 * @type {import('next-i18next').UserConfig}
 */
module.exports = {
    // https://www.i18next.com/overview/configuration-options#logging
    debug: process.env.NODE_ENV === 'development',
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'lv'],
    },

    reloadOnPrerender: process.env.NODE_ENV === 'development',
    /** To avoid issues when deploying to some paas (vercel...) */
    localePath:
        typeof window === 'undefined'
            ? require('path').resolve('./src/frontend/public/locales')
            : '/locales',
    /**
     * @link https://github.com/i18next/next-i18next#6-advanced-configuration
     */
    saveMissing: true,
    // strictMode: true,
    // serializeConfig: false,
    // react: { useSuspense: false }
}