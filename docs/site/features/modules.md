# Modules

Modules are the typed building blocks that fill a section's slots. Each module has a Display component (`ui/client/modules/<Type>/<Type>.tsx`) and an Editor (`ui/admin/modules/<Type>/<Type>Editor.tsx`).

## Built-in catalogue

Text & narrative:

- **Text** — single block of plain text.
- **RichText** — sanitised HTML; supports headings, lists, links, code blocks. Inline-translatable.
- **Manifesto** — long-form prose with chip annotations.

Media:

- **Image** — single image with alt text.
- **Carousel** — horizontally scrolling image set.
- **Gallery** — grid of images with lightbox.

Marketing surfaces:

- **Hero** — headline + subtitle + tagline + background image, full-bleed.
- **ProjectCard** — title + description + cover + tags + 1–2 CTAs.
- **ProjectGrid** — multiple ProjectCards in a responsive grid.
- **Services** — numbered service rows with optional CTAs.
- **Testimonials** — quote + name + role.
- **StatsCard** — KPI strip with optional features list.
- **SkillPills** — labelled chips, optional 0–10 score (matrix mode).
- **Timeline** — career/event timeline with achievements.

Interactive & data:

- **List** — bulleted/numbered list with optional links and tags.
- **SocialLinks** — platform-icon link row.
- **InquiryForm** — captures contact submissions into the **Inquiries** pane.
- **BlogFeed** — pulls latest posts (filterable by tag).

Diagrams (CV-bundle):

- **DataModel**, **InfraTopology**, **PipelineFlow**, **RepoTree**, **ArchitectureTiers**, **StatsStrip** — purpose-built for case-study pages.

## Adding a new module

1. Drop a folder under `ui/client/modules/<Type>` with `<Type>.tsx`, `<Type>.types.ts`, optional `.scss`, optional `.test.tsx`.
2. Add the matching editor under `ui/admin/modules/<Type>/<Type>Editor.tsx`.
3. Register the type in `shared/enums/EItemType.ts` and add a validator entry to `shared/utils/contentSchemas.ts`.
4. The codegen + registry pick it up on the next `npm run codegen`.
