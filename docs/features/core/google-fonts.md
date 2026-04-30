# Google Fonts

## Overview

The admin can pick any Google Font for display and monospace font stacks via a searchable picker. The selected fonts are loaded efficiently on the public site, with an optional GDPR-compliant self-hosting mode.

## Font picker

`AdminSettings/FontPicker.tsx` browses a local catalogue at `src/frontend/data/google-fonts.json`. Selecting a font writes the CSS font-family stack (with category-appropriate fallbacks) into the active theme's font tokens.

## Public site font loading

`_document.tsx` extracts the active theme's font families via `extractFontFamily()`, deduplicates against `BUNDLED_FAMILIES` (fonts already included in the CSS bundle), and builds a single `<link>` URL via `buildGoogleFontsUrl()` with the variants listed in the catalogue. This minimises DNS lookups and ensures a single stylesheet load per page.

## GDPR self-hosting mode

When `siteFlags.selfHostFonts` is `true`, font requests are proxied through two internal routes:

| Route | Behaviour |
|---|---|
| `/api/fonts/css` | Fetches Google Fonts CSS, rewrites all `src:` URLs to `/api/fonts/file` |
| `/api/fonts/file` | Fetches and streams the binary font file |

**Visitor privacy:** visitor IP and User-Agent are never forwarded to Google — only the server's IP makes the upstream request.

**Cache headers:**
- CSS: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
- Font binaries: `Cache-Control: public, max-age=31536000, immutable`

## Catalogue refresh

The catalogue JSON is not updated automatically. Run when new fonts are needed:

```bash
npx tsx Scripts/update-google-fonts.ts
```

This pulls from the Google Fonts Developer API and overwrites `src/frontend/data/google-fonts.json`. Commit the result.
