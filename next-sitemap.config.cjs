/** @type {import('next-sitemap').IConfig} */

const dev = process.env.NODE_ENV !== 'production';

module.exports = {
    siteUrl: dev ? 'http://localhost' : 'YOUR_DEPLOYED_SITE_URL',
    sourceDir: "src/frontend/.next",
    outDir: "src/frontend/public/images"
};