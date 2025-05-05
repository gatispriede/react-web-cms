/** @type {import('next-sitemap').IConfig} */ const {error} = require("next/dist/build/output/log");
const dev = process.env.NODE_ENV !== 'production';

const domain = 'http://localhost'

module.exports = {
    siteUrl: domain,
    generateRobotsTxt: true,
    sourceDir: "src/frontend/.next",
    outDir: "src/frontend/public/images",
    additionalPaths: async (config) => {
        const result = []
        const pages = await fetch(`${domain}/api/graphql?query=query%7B%0A%20%20mongo%7B%0A%20%20%20%20getNavigationCollection%7B%0A%20%20%20%20%20%20page%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D`)
            .then(response => {
                return response.json()
            }).then(response => {
                try {
                    const rez = response
                    return rez.data.mongo.getNavigationCollection;
                }catch (error) {
                    console.error(error)
                }
                return []
            });

        pages.map((page) => {
            result.push({
                loc: "/" + page.page,
                changefreq: 'daily',
                priority: 0.7,
                lastmod: new Date().toISOString(),
                alternateRefs: [
                    {
                        href: `${domain}/en/`,
                        hreflang: 'en',
                    },
                    {
                        href: `${domain}/lv/`,
                        hreflang: 'lv',
                    },
                ],
            })
            }
        )
        return result
    }
};