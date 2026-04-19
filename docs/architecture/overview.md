# Overview

This is a **Next.js 15 / React 19 CMS** backed by **MongoDB 7**. Despite the directory name, Redis sees minimal use — the core stack is Next + Mongo + GraphQL (Apollo Server inside a Next API route, plus an optional standalone Express server with the same schema).

The product is a **content-composable portfolio / marketing site**: admins build multilingual pages out of 17 reusable item types (Hero · RichText · Gallery · Carousel · ProjectCard · SkillPills · Timeline · SocialLinks · BlogFeed · List · Services · Testimonials · StatsCard · ProjectGrid · Manifesto · PlainText · PlainImage), arrange them in column-slot grids with absolute-positioned overlay sections, swap between 8 themes (4 colour-only + 3 editorial bundles + 1 a11y high-contrast), publish versioned snapshots with rollback, and toggle a blog on/off. Every content edit is audit-stamped (`editedBy` / `editedAt`) and version-counted (`version`) so concurrent admins don't silently overwrite each other.

The admin is a single-page React surface inside Next; the public site is statically generated for the index + slug routes and SSR'd for the blog. AntD provides the admin chrome; module SCSS targets a CSS-variable pipeline (`--theme-*`) populated from the active theme's tokens server-side in `_document.tsx` so first paint already has the right palette.

For full detail see [`../../PROJECT_ANALYSIS.md`](../../PROJECT_ANALYSIS.md). The other docs in this folder zoom into specific subsystems.

Last reviewed: 2026-04-19.
