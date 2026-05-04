# Module reference

One document per `EItemType` member. These are the canonical references for content authors, the [test-ids convention](../architecture/test-ids.md), the e2e module-samples registry, and the MCP `cms module describe` command.

Single shape per file — see [`_template.md`](_template.md). When adding a new module type to `EItemType`, copy the template, fill it in, and add the corresponding entry to [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts) (the registry-completeness Vitest gate fails CI otherwise).

## Coverage matrix

| Module type | Doc | Admin editor | Public render | Sample in registry | Notes |
|---|---|---|---|---|---|
| `HERO` | [hero.md](hero.md) | `ui/admin/modules/Hero/HeroEditor.tsx` | `ui/client/modules/Hero/Hero.tsx` | ✅ | |
| `RICH_TEXT` | [rich-text.md](rich-text.md) | `ui/admin/modules/RichText/RichTextEditor.tsx` | `ui/client/modules/RichText/RichText.tsx` | ✅ | CKEditor-backed |
| `TEXT` (PlainText) | [plain-text.md](plain-text.md) | `ui/admin/modules/PlainText/PlainTextEditor.tsx` | `ui/client/modules/PlainText/PlainText.tsx` | ✅ | |
| `TIMELINE` | [timeline.md](timeline.md) | `ui/admin/modules/Timeline/TimelineEditor.tsx` | `ui/client/modules/Timeline/Timeline.tsx` | ✅ | |
| `SKILL_PILLS` | [skill-pills.md](skill-pills.md) | `ui/admin/modules/SkillPills/SkillPillsEditor.tsx` | `ui/client/modules/SkillPills/SkillPills.tsx` | ✅ | |
| `SERVICES` | [services.md](services.md) | `ui/admin/modules/Services/ServicesEditor.tsx` | `ui/client/modules/Services/Services.tsx` | ✅ | |
| `TESTIMONIALS` | [testimonials.md](testimonials.md) | `ui/admin/modules/Testimonials/TestimonialsEditor.tsx` | `ui/client/modules/Testimonials/Testimonials.tsx` | ✅ | |
| `PROJECT_GRID` | [project-grid.md](project-grid.md) | `ui/admin/modules/ProjectGrid/ProjectGridEditor.tsx` | `ui/client/modules/ProjectGrid/ProjectGrid.tsx` | ✅ | |
| `MANIFESTO` | [manifesto.md](manifesto.md) | `ui/admin/modules/Manifesto/ManifestoEditor.tsx` | `ui/client/modules/Manifesto/Manifesto.tsx` | ✅ | |
| `STATS_CARD` | [stats-card.md](stats-card.md) | `ui/admin/modules/StatsCard/StatsCardEditor.tsx` | `ui/client/modules/StatsCard/StatsCard.tsx` | ✅ | |
| `LIST` | [list.md](list.md) | `ui/admin/modules/List/ListEditor.tsx` | `ui/client/modules/List/List.tsx` | ✅ | |
| `IMAGE` (PlainImage) | [image.md](image.md) | `ui/admin/modules/PlainImage/PlainImageEditor.tsx` | `ui/client/modules/PlainImage/PlainImage.tsx` | ✅ | shares `IMAGE` enum w/ Gallery — disambiguated by style |
| `GALLERY` | [gallery.md](gallery.md) | `ui/admin/modules/Gallery/GalleryEditor.tsx` | `ui/client/modules/Gallery/Gallery.tsx` | ✅ | image-only — no `module-editor-primary-text-input` |
| `CAROUSEL` | [carousel.md](carousel.md) | `ui/admin/modules/Carousel/CarouselEditor.tsx` | `ui/client/modules/Carousel/Carousel.tsx` | ✅ | image-only |
| `BLOG_FEED` | [blog-feed.md](blog-feed.md) | `ui/admin/modules/BlogFeed/BlogFeedEditor.tsx` | `ui/client/modules/BlogFeed/BlogFeed.tsx` | ✅ | |
| `SOCIAL_LINKS` | [social-links.md](social-links.md) | `ui/admin/modules/SocialLinks/SocialLinksEditor.tsx` | `ui/client/modules/SocialLinks/SocialLinks.tsx` | ✅ | |
| `PROJECT_CARD` | [project-card.md](project-card.md) | `ui/admin/modules/ProjectCard/ProjectCardEditor.tsx` | `ui/client/modules/ProjectCard/ProjectCard.tsx` | ✅ | |
| `INQUIRY_FORM` | [inquiry-form.md](inquiry-form.md) | `ui/admin/modules/InquiryForm/InquiryFormEditor.tsx` | `ui/client/modules/InquiryForm/InquiryForm.tsx` | ❌ omitted | requires SMTP integration to test end-to-end |
| `DATA_MODEL` | [data-model.md](data-model.md) | `ui/admin/modules/DataModel/...` | `ui/client/modules/DataModel/...` | ❌ omitted | dev-portfolio specific |
| `INFRA_TOPOLOGY` | [infra-topology.md](infra-topology.md) | `ui/admin/modules/InfraTopology/...` | `ui/client/modules/InfraTopology/...` | ❌ omitted | dev-portfolio specific |
| `PIPELINE_FLOW` | [pipeline-flow.md](pipeline-flow.md) | `ui/admin/modules/PipelineFlow/...` | `ui/client/modules/PipelineFlow/...` | ❌ omitted | dev-portfolio specific |
| `REPO_TREE` | [repo-tree.md](repo-tree.md) | `ui/admin/modules/RepoTree/...` | `ui/client/modules/RepoTree/...` | ❌ omitted | dev-portfolio specific |
| `ARCHITECTURE_TIERS` | [architecture-tiers.md](architecture-tiers.md) | `ui/admin/modules/ArchitectureTiers/...` | `ui/client/modules/ArchitectureTiers/...` | ❌ omitted | dev-portfolio specific |
| `STATS_STRIP` | [stats-strip.md](stats-strip.md) | `ui/admin/modules/StatsStrip/...` | `ui/client/modules/StatsStrip/...` | ❌ omitted | dev-portfolio specific |
| `EMPTY` | — | — | — | ❌ omitted | placeholder for unfilled column slots |

## Cross-references

- The flat per-`EItemType` content shapes (one source of truth, low-detail) live in [`../architecture/module-interfaces.md`](../architecture/module-interfaces.md). The per-module docs here are higher-detail — admin editor anatomy, public render markup, theming tokens, MCP usage examples.
- Per-module sample content (the smallest valid `IItem.content` per type, used by the e2e chain spec) lives at [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts). When in doubt, that file is the executable truth — these docs follow.
- The testid convention these docs reference is documented at [`../architecture/test-ids.md`](../architecture/test-ids.md). All testids on this page compose `<feature>-<element>[-<context>]-<role>` per that rule.

## How MCP consumes these docs

`cms module describe <TYPE>` (per [tooling/mcp-server.md](../features/tooling/mcp-server.md)) returns a structured payload built from this folder:

- **schema** — the `Content shape` block as JSON Schema
- **styles** — the `EStyle` enum values from the module's `*.types.ts`
- **sample** — the `moduleSamples.ts` entry
- **renderTestid** — the `section-module-row-<type>` testid (so AI clients can verify the module rendered after a `section.add`)

`cms section add <pageSlug> <TYPE>` defaults to the registry sample for that type.
