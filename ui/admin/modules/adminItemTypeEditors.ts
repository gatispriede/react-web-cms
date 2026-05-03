/**
 * Admin-side module Editors + metadata — Class Loader L4 (2026-05-03).
 *
 * Pair to `ui/client/modules/clientItemTypes.ts`. Carries Editor +
 * defaultContent + styleEnum + label/description + category. The site
 * never imports this file — admin bundle only.
 *
 * `ui/admin/lib/itemTypes/registry.ts` zips this list with the
 * Client-side Display list by `key` to produce the historical
 * `ItemTypeDefinition` shape (`Display + Editor + …`).
 */
import type {AdminItemType} from '@admin/lib/loaders/AdminUILoader';
import {EItemType} from '@enums/EItemType';

import {EPlainTextStyle} from '@client/modules/PlainText';
import {ERichTextStyle} from '@client/modules/RichText';
import {EImageStyle} from '@client/modules/PlainImage';
import {EGalleryStyle} from '@client/modules/Gallery';
import {ECarouselStyle} from '@client/modules/Carousel';
import {EHeroStyle} from '@client/modules/Hero';
import {EProjectCardStyle} from '@client/modules/ProjectCard';
import {ESkillPillsStyle} from '@client/modules/SkillPills';
import {ETimelineStyle} from '@client/modules/Timeline';
import {ESocialLinksStyle} from '@client/modules/SocialLinks';
import {EBlogFeedStyle} from '@client/modules/BlogFeed';
import {EListStyle} from '@client/modules/List';
import {EServicesStyle} from '@client/modules/Services';
import {ETestimonialsStyle} from '@client/modules/Testimonials';
import {EStatsCardStyle} from '@client/modules/StatsCard';
import {EProjectGridStyle} from '@client/modules/ProjectGrid';
import {EManifestoStyle} from '@client/modules/Manifesto';
import {EInquiryFormStyle} from '@client/modules/InquiryForm';
import {EDataModelStyle} from '@client/modules/DataModel';
import {EInfraTopologyStyle} from '@client/modules/InfraTopology';
import {EPipelineFlowStyle} from '@client/modules/PipelineFlow';
import {ERepoTreeStyle} from '@client/modules/RepoTree';
import {EArchitectureTiersStyle} from '@client/modules/ArchitectureTiers';
import {EStatsStripStyle} from '@client/modules/StatsStrip';

import {PlainTextEditor} from '@admin/modules/PlainText/PlainTextEditor';
import {RichTextEditor} from '@admin/modules/RichText/RichTextEditor';
import {PlainImageEditor} from '@admin/modules/PlainImage/PlainImageEditor';
import {GalleryEditor} from '@admin/modules/Gallery/GalleryEditor';
import {CarouselEditor} from '@admin/modules/Carousel/CarouselEditor';
import {HeroEditor} from '@admin/modules/Hero/HeroEditor';
import {ProjectCardEditor} from '@admin/modules/ProjectCard/ProjectCardEditor';
import {SkillPillsEditor} from '@admin/modules/SkillPills/SkillPillsEditor';
import {TimelineEditor} from '@admin/modules/Timeline/TimelineEditor';
import {SocialLinksEditor} from '@admin/modules/SocialLinks/SocialLinksEditor';
import {BlogFeedEditor} from '@admin/modules/BlogFeed/BlogFeedEditor';
import {ListEditor} from '@admin/modules/List/ListEditor';
import {ServicesEditor} from '@admin/modules/Services/ServicesEditor';
import {TestimonialsEditor} from '@admin/modules/Testimonials/TestimonialsEditor';
import {StatsCardEditor} from '@admin/modules/StatsCard/StatsCardEditor';
import {ProjectGridEditor} from '@admin/modules/ProjectGrid/ProjectGridEditor';
import {ManifestoEditor} from '@admin/modules/Manifesto/ManifestoEditor';
import {InquiryFormEditor} from '@admin/modules/InquiryForm/InquiryFormEditor';
import {DataModelEditor} from '@admin/modules/DataModel/DataModelEditor';
import {InfraTopologyEditor} from '@admin/modules/InfraTopology/InfraTopologyEditor';
import {PipelineFlowEditor} from '@admin/modules/PipelineFlow/PipelineFlowEditor';
import {RepoTreeEditor} from '@admin/modules/RepoTree/RepoTreeEditor';
import {ArchitectureTiersEditor} from '@admin/modules/ArchitectureTiers/ArchitectureTiersEditor';
import {StatsStripEditor} from '@admin/modules/StatsStrip/StatsStripEditor';

/**
 * Admin-side per-module metadata. `category` + label/description live
 * here because the picker dialog (admin-only) is the only consumer.
 */
export interface AdminItemTypeEntry extends AdminItemType {
    readonly labelKey: string;
    readonly descriptionKey: string;
    readonly category: 'hero' | 'media' | 'content' | 'cta';
}

const asEnum = (e: object) => e as unknown as Record<string, string>;

export const ADMIN_ITEM_TYPE_EDITORS: readonly AdminItemTypeEntry[] = [
    {key: EItemType.Text,            Editor: PlainTextEditor,        styleEnum: asEnum(EPlainTextStyle),       defaultContent: '{"value":""}',                                                                                                                                                              labelKey: 'Simple Text',          descriptionKey: 'Plain paragraph with inline style only.',                            category: 'content'},
    {key: EItemType.RichText,        Editor: RichTextEditor,         styleEnum: asEnum(ERichTextStyle),        defaultContent: '{"value":""}',                                                                                                                                                              labelKey: 'Rich text',            descriptionKey: 'HTML body with italic-accent runs and headings.',                    category: 'content'},
    {key: EItemType.Image,           Editor: PlainImageEditor,       styleEnum: asEnum(EImageStyle),           defaultContent: '{"src":"","useAsBackground":false}',                                                                                                                                        labelKey: 'Image',                descriptionKey: 'Single image with optional caption.',                                category: 'media'},
    {key: EItemType.Gallery,         Editor: GalleryEditor,          styleEnum: asEnum(EGalleryStyle),         defaultContent: '{"items":[]}',                                                                                                                                                              labelKey: 'Gallery',              descriptionKey: 'Image grid with optional text-only tiles.',                          category: 'media'},
    {key: EItemType.Carousel,        Editor: CarouselEditor,         styleEnum: asEnum(ECarouselStyle),        defaultContent: '{"items":[]}',                                                                                                                                                              labelKey: 'Carousel',             descriptionKey: 'Horizontally scrollable image strip.',                               category: 'media'},
    {key: EItemType.Hero,            Editor: HeroEditor,             styleEnum: asEnum(EHeroStyle),            defaultContent: '{"headline":"","subtitle":"","tagline":"","bgImage":"","accent":""}',                                                                                                       labelKey: 'Hero',                 descriptionKey: 'Full-bleed header with headline, subtitle, CTA.',                    category: 'hero'},
    {key: EItemType.ProjectCard,     Editor: ProjectCardEditor,      styleEnum: asEnum(EProjectCardStyle),     defaultContent: '{"title":"","description":"","image":"","tags":[]}',                                                                                                                        labelKey: 'Project card',         descriptionKey: 'Single featured project with cover and tags.',                       category: 'content'},
    {key: EItemType.SkillPills,      Editor: SkillPillsEditor,       styleEnum: asEnum(ESkillPillsStyle),      defaultContent: '{"category":"","items":[]}',                                                                                                                                                labelKey: 'Skill pills',          descriptionKey: 'Tag cloud or matrix of skills.',                                     category: 'content'},
    {key: EItemType.Timeline,        Editor: TimelineEditor,         styleEnum: asEnum(ETimelineStyle),        defaultContent: '{"entries":[{"start":"","end":"","company":"","role":""}]}',                                                                                                                labelKey: 'Timeline',             descriptionKey: 'Vertical or horizontal milestone list.',                             category: 'content'},
    {key: EItemType.SocialLinks,     Editor: SocialLinksEditor,      styleEnum: asEnum(ESocialLinksStyle),     defaultContent: '{"links":[{"platform":"website","url":"","label":""}]}',                                                                                                                    labelKey: 'Social links',         descriptionKey: 'Row of icon links to external profiles.',                            category: 'cta'},
    {key: EItemType.BlogFeed,        Editor: BlogFeedEditor,         styleEnum: asEnum(EBlogFeedStyle),        defaultContent: '{"limit":6,"tag":"","heading":""}',                                                                                                                                         labelKey: 'Blog feed',            descriptionKey: 'Latest posts pulled from the Posts collection.',                     category: 'content'},
    {key: EItemType.List,            Editor: ListEditor,             styleEnum: asEnum(EListStyle),            defaultContent: '{"title":"","items":[{"label":"","value":"","href":""}]}',                                                                                                                  labelKey: 'List',                 descriptionKey: 'Bullet or numbered list, optional meta fields.',                     category: 'content'},
    {key: EItemType.Services,        Editor: ServicesEditor,         styleEnum: asEnum(EServicesStyle),        defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","rows":[{"number":"01","title":"","description":"","ctaLabel":"","ctaHref":"","iconGlyph":"","tags":[]}]}',      labelKey: 'Services',             descriptionKey: 'Icon + heading + body cards grouped by row.',                        category: 'content'},
    {key: EItemType.Testimonials,    Editor: TestimonialsEditor,     styleEnum: asEnum(ETestimonialsStyle),    defaultContent: '{"sectionTitle":"","sectionSubtitle":"","items":[{"quote":"","name":"","role":"","avatarInitial":""}]}',                                                                    labelKey: 'Testimonials',         descriptionKey: 'Quote cards with avatar and attribution.',                           category: 'content'},
    {key: EItemType.StatsCard,       Editor: StatsCardEditor,        styleEnum: asEnum(EStatsCardStyle),       defaultContent: '{"tag":"","title":"","stats":[{"value":"","label":""}],"features":[]}',                                                                                                     labelKey: 'Stats card',           descriptionKey: 'Metric / number callout with feature list.',                         category: 'content'},
    {key: EItemType.ProjectGrid,     Editor: ProjectGridEditor,      styleEnum: asEnum(EProjectGridStyle),     defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","items":[{"title":"","stack":"","kind":"","year":"","coverArt":"","coverColor":"","moreLabel":"View engagement ↗","href":""}]}', labelKey: 'Project grid', descriptionKey: 'Card grid with image, title, tags per item.',                category: 'content'},
    {key: EItemType.Manifesto,       Editor: ManifestoEditor,        styleEnum: asEnum(EManifestoStyle),       defaultContent: '{"body":"","addendum":"","chips":[]}',                                                                                                                                      labelKey: 'Manifesto',            descriptionKey: 'Full-width editorial block with chip footer.',                       category: 'hero'},
    {key: EItemType.InquiryForm,     Editor: InquiryFormEditor,      styleEnum: asEnum(EInquiryFormStyle),     defaultContent: '{"topics":[],"fields":[]}',                                                                                                                                                 labelKey: 'Inquiry form',         descriptionKey: 'Topic chips + name/email/message + submit (CV Contact).',            category: 'cta'},
    {key: EItemType.DataModel,       Editor: DataModelEditor,        styleEnum: asEnum(EDataModelStyle),       defaultContent: '{"fields":[],"collections":[],"audits":[]}',                                                                                                                                labelKey: 'Data model',           descriptionKey: 'Schema visualiser — fields table + collections aside + audit cards.',category: 'content'},
    {key: EItemType.InfraTopology,   Editor: InfraTopologyEditor,    styleEnum: asEnum(EInfraTopologyStyle),   defaultContent: '{"droplets":[]}',                                                                                                                                                           labelKey: 'Infra topology',       descriptionKey: 'Droplet/server cards + author-supplied SVG topology.',               category: 'content'},
    {key: EItemType.PipelineFlow,    Editor: PipelineFlowEditor,     styleEnum: asEnum(EPipelineFlowStyle),    defaultContent: '{"steps":[],"sideNotes":[]}',                                                                                                                                               labelKey: 'Pipeline flow',        descriptionKey: 'Linear CI/CD pipeline with status pills and side notes.',            category: 'content'},
    {key: EItemType.RepoTree,        Editor: RepoTreeEditor,         styleEnum: asEnum(ERepoTreeStyle),        defaultContent: '{"nodes":[]}',                                                                                                                                                              labelKey: 'Repo tree',            descriptionKey: 'Interactive repo path tree with detail pane.',                       category: 'content'},
    {key: EItemType.ArchitectureTiers, Editor: ArchitectureTiersEditor, styleEnum: asEnum(EArchitectureTiersStyle), defaultContent: '{"tiers":[]}',                                                                                                                                                         labelKey: 'Architecture tiers',   descriptionKey: 'Tier cards (concern/role/title/pills/modules) + shared footer + lifecycle rail.', category: 'content'},
    {key: EItemType.StatsStrip,      Editor: StatsStripEditor,       styleEnum: asEnum(EStatsStripStyle),      defaultContent: '{"cells":[]}',                                                                                                                                                              labelKey: 'Stats strip',          descriptionKey: 'Horizontal numeric strip — value / unit / caption per cell.',        category: 'content'},
];
