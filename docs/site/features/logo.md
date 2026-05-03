# Logo

The **Logo** pane (`/admin/client-config/logo`) controls the brand mark shown in the public nav and the admin top bar.

## Fields

- **Image** — uploaded SVG/PNG/JPG. Stored under `ui/client/public/images/`; referenced as `api/<filename>`.
- **Width**, **Height** — render dimensions (px). The admin caps the bounding box at 80×80 in the nav; tweak for dense vs roomy themes.
- **Link** — where the logo navigates to (default `/`).
- **Alt text** — accessibility label; leave empty to fall back to the site name.

## SVG vs raster

SVGs render inline (so they inherit CSS colour) when small enough. PNG/JPG go through the standard `<img>` path. For dark/light theme variants, ship two logos and switch via Theme tokens.

## Bundle round-trip

Logo travels with bundle exports as a single document in the `Logos` collection (the schema reserves space for multiple but only the first is rendered). The image asset rides along in the bundle's `assets` map as a base64 data URI.
