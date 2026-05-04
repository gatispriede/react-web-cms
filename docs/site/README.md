# Docs site — source

The docs site IS a CMS instance. The markdown files in this folder are the source of truth; running `node tools/seed-docs-bundle.js` regenerates `tests/e2e/fixtures/bundles/docs-bundle.json` which an admin can then import via the **Bundle** pane to populate a fresh CMS with docs content.

The same content is also reachable in-repo without the CMS by reading the markdown files directly.

## Sections

- [Setup](setup.md) — first install, onboarding wizard, environment variables.
- [AI / MCP workflow](ai-mcp-workflow.md) — natural-language authoring through the MCP server.
- Feature reference (per admin pane):
  - [Build / Pages](features/build.md)
  - [Modules](features/modules.md)
  - [Themes](features/themes.md)
  - [Translations](features/translations.md)
  - [Posts](features/posts.md)
  - [Products](features/products.md)
  - [Logo](features/logo.md)
  - [Footer](features/footer.md)
  - [Bundle](features/bundle.md)
  - [Users](features/users.md)
  - [Grants](features/grants.md)

## Public routes

After importing the bundle:

- `/docs` — index of all docs pages.
- `/docs/<slug>` — individual page (e.g. `/docs/setup`, `/docs/themes`).

## Iterating

1. Edit the markdown.
2. Re-run `node tools/seed-docs-bundle.js`.
3. Re-import `docs-bundle.json` from the Bundle pane (destructive — back up first if not running on a docs-only instance).
