/**
 * size-limit budgets — W8d performance budget gate.
 *
 * Per-route gzip budgets on the Next build output. Glob path covers the
 * content-hash suffix Next emits (`pages/index-abc123.js`). `webpack`
 * mode is correct for Next 16 (`next build --webpack`), per
 * `package.json` `build` script.
 *
 * Starting numbers are deliberately *conservative* — they match what
 * the spec calls out as targets (150–200 kB gzipped per public route),
 * not aspirational floors. CI fails only on regressions beyond these
 * limits; floors get ratcheted down later via tooling-as-PR (no manual
 * edits inside a feature PR).
 *
 * Framework chunk gets its own line because every route inherits it —
 * a 10 kB regression there is a 10 kB regression across the whole site.
 *
 * If the build output structure changes (e.g. Next switches to per-route
 * static folders), update the globs here — size-limit otherwise reports
 * "0 B" instead of failing, and the gate silently passes.
 */
module.exports = [
    {
        name: 'homepage',
        path: 'ui/client/.next/static/chunks/pages/index-*.js',
        limit: '60 KB',
        gzip: true,
    },
    {
        name: 'products list',
        path: 'ui/client/.next/static/chunks/pages/products/index-*.js',
        limit: '80 KB',
        gzip: true,
    },
    {
        name: 'product detail',
        path: 'ui/client/.next/static/chunks/pages/products/[slug]-*.js',
        limit: '100 KB',
        gzip: true,
    },
    {
        name: 'checkout',
        path: 'ui/client/.next/static/chunks/pages/checkout/index-*.js',
        limit: '80 KB',
        gzip: true,
    },
    {
        name: 'blog list',
        path: 'ui/client/.next/static/chunks/pages/blog/index-*.js',
        limit: '70 KB',
        gzip: true,
    },
    {
        name: 'blog post',
        path: 'ui/client/.next/static/chunks/pages/blog/[slug]-*.js',
        limit: '70 KB',
        gzip: true,
    },
    {
        name: 'framework',
        path: 'ui/client/.next/static/chunks/framework-*.js',
        limit: '50 KB',
        gzip: true,
    },
];
