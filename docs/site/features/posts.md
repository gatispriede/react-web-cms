# Posts

The **Posts** pane (`/admin/content/posts`) is a lightweight blog. Posts are independent of pages — they live in their own `Posts` collection and render through `/blog` and `/blog/[slug]`.

## Fields

- **Title** — required.
- **Slug** — auto-derived from the title; editable.
- **Excerpt** — optional short summary used in the index card.
- **Body** — RichText (HTML).
- **Cover image** — `api/<filename>` path or full URL.
- **Tags** — string array; surfaced as filter pills.
- **Author** — free-text.
- **Published at** — ISO date; posts with a future date or `draft: true` are hidden from the public feed.
- **Draft** — boolean.

## Public surface

- `/blog` — list, paginated by 50, sorted by `publishedAt` desc.
- `/blog/<slug>` — single post.
- **BlogFeed module** — embed the latest N posts on any CMS page, optionally filtered by tag.

## Toggle off

If you don't need a blog, switch off **blogEnabled** in Settings → Site flags. The `/blog` routes 404 and the BlogFeed module is hidden from the picker.
