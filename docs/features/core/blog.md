# Blog

## Overview

The CMS includes an optional blog. Posts are stored in the `Posts` collection and surfaced via the `BLOG_FEED` module type and a dedicated `/blog` route.

## Enabling / disabling

The blog is controlled by `siteFlags.blogEnabled`. When disabled, the `/blog` route returns 404 and the `BLOG_FEED` module renders empty. Toggle in admin → Settings → Site flags.

## Posts

Each post: `{id, slug, title, body, excerpt, draft, publishedAt, version}`.

- **`draft: true`** — post is not visible on the public site and is excluded from published snapshots.
- **`publishedAt`** — set when the post is first published (draft toggled off). Used for sort order and display.
- **`slug`** — URL path segment, e.g. `/blog/my-post`. Must be unique.
- **`body`** — rich text HTML, edited in the admin post editor.
- **`excerpt`** — short summary shown in the `BLOG_FEED` card grid.
- **`version`** — optimistic concurrency counter; see [`admin-experience.md`](admin-experience.md).

## Blog feed module

The `BLOG_FEED` item type fetches the latest non-draft posts from `PostService` at render time. The number of posts shown is configurable in the item's content JSON. The `/blog` route is server-side rendered (SSR) so new posts appear without a publish/snapshot cycle.

## Routes

| Route | Render mode |
|---|---|
| `/blog` | SSR — live post list |
| `/blog/[slug]` | SSR — individual post |
