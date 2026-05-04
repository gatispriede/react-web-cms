# Footer

The **Footer** pane (`/admin/client-config/footer`) configures the global site footer rendered below every public page.

## Fields

- **Tagline** — short brand line (e.g. "Built in Sigulda").
- **Columns** — up to 4. Each column has a heading and a list of links (`{label, href}`). Use for site map, legal, social, contact.
- **Copyright** — bottom strip text. Supports `{year}` substitution.
- **Show language switcher** — boolean.
- **Show theme toggle** — boolean (only meaningful when the active theme exposes a dark variant).

## Auto-populated columns

If you leave a column empty, the footer auto-populates one with all top-level navigation pages. Useful for small sites that don't want to maintain a separate site map.

## Storage

Footer config is a single `SiteSettings` document with key `footer`. Travels with bundles as `site.footer`.
