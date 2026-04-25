/**
 * Item type registry — admin Editor (Input*) and site Display (SectionComponents/*) paired
 * as siblings per item type. Adding a new block type = one registry entry here.
 * Both the site renderer (ContentType) and the admin content picker (ContentSection)
 * consume this registry.
 */
import React from "react";
import {EItemType} from "@enums/EItemType";
import {EStyle} from "@enums/EStyle";
import {TFunction} from "i18next";
import {IItem} from "@interfaces/IItem";

// Renderer (display) modules live under `src/frontend/modules/<Name>/` — barrel exports
// default=renderer + named E<Name>Style + named <Name>Content class.
// Editor modules live under `src/frontend/admin/modules/<Name>/` as sibling trees,
// enforcing the render/edit concern split (see roadmap/target-architecture.md).
import PlainText, {EPlainTextStyle} from "@client/modules/PlainText";
import RichText, {ERichTextStyle} from "@client/modules/RichText";
import PlainImage, {EImageStyle} from "@client/modules/PlainImage";
import Gallery, {EGalleryStyle} from "@client/modules/Gallery";
import CarouselView, {ECarouselStyle} from "@client/modules/Carousel";
import Hero, {EHeroStyle} from "@client/modules/Hero";
import ProjectCard, {EProjectCardStyle} from "@client/modules/ProjectCard";
import SkillPills, {ESkillPillsStyle} from "@client/modules/SkillPills";
import Timeline, {ETimelineStyle} from "@client/modules/Timeline";
import SocialLinks, {ESocialLinksStyle} from "@client/modules/SocialLinks";
import BlogFeed, {EBlogFeedStyle} from "@client/modules/BlogFeed";
import List, {EListStyle} from "@client/modules/List";
import Services, {EServicesStyle} from "@client/modules/Services";
import Testimonials, {ETestimonialsStyle} from "@client/modules/Testimonials";
import StatsCard, {EStatsCardStyle} from "@client/modules/StatsCard";
import ProjectGrid, {EProjectGridStyle} from "@client/modules/ProjectGrid";
import Manifesto, {EManifestoStyle} from "@client/modules/Manifesto";
import InquiryForm, {EInquiryFormStyle} from "@client/modules/InquiryForm";
import DataModel, {EDataModelStyle} from "@client/modules/DataModel";
import InfraTopology, {EInfraTopologyStyle} from "@client/modules/InfraTopology";
import PipelineFlow, {EPipelineFlowStyle} from "@client/modules/PipelineFlow";
import RepoTree, {ERepoTreeStyle} from "@client/modules/RepoTree";

import {PlainTextEditor as InputPlainText} from "@admin/modules/PlainText/PlainTextEditor";
import {RichTextEditor as InputRichText} from "@admin/modules/RichText/RichTextEditor";
import {PlainImageEditor as InputPlainImage} from "@admin/modules/PlainImage/PlainImageEditor";
import {GalleryEditor as InputGallery} from "@admin/modules/Gallery/GalleryEditor";
import {CarouselEditor as InputCarousel} from "@admin/modules/Carousel/CarouselEditor";
import {HeroEditor as InputHero} from "@admin/modules/Hero/HeroEditor";
import {ProjectCardEditor as InputProjectCard} from "@admin/modules/ProjectCard/ProjectCardEditor";
import {SkillPillsEditor as InputSkillPills} from "@admin/modules/SkillPills/SkillPillsEditor";
import {TimelineEditor as InputTimeline} from "@admin/modules/Timeline/TimelineEditor";
import {SocialLinksEditor as InputSocialLinks} from "@admin/modules/SocialLinks/SocialLinksEditor";
import {BlogFeedEditor as InputBlogFeed} from "@admin/modules/BlogFeed/BlogFeedEditor";
import {ListEditor as InputList} from "@admin/modules/List/ListEditor";
import {ServicesEditor as InputServices} from "@admin/modules/Services/ServicesEditor";
import {TestimonialsEditor as InputTestimonials} from "@admin/modules/Testimonials/TestimonialsEditor";
import {StatsCardEditor as InputStatsCard} from "@admin/modules/StatsCard/StatsCardEditor";
import {ProjectGridEditor as InputProjectGrid} from "@admin/modules/ProjectGrid/ProjectGridEditor";
import {ManifestoEditor as InputManifesto} from "@admin/modules/Manifesto/ManifestoEditor";
import {InquiryFormEditor as InputInquiryForm} from "@admin/modules/InquiryForm/InquiryFormEditor";
import {DataModelEditor as InputDataModel} from "@admin/modules/DataModel/DataModelEditor";
import {InfraTopologyEditor as InputInfraTopology} from "@admin/modules/InfraTopology/InfraTopologyEditor";
import {PipelineFlowEditor as InputPipelineFlow} from "@admin/modules/PipelineFlow/PipelineFlowEditor";
import {RepoTreeEditor as InputRepoTree} from "@admin/modules/RepoTree/RepoTreeEditor";

export type ItemCategory = 'hero' | 'media' | 'content' | 'cta';

export interface ItemTypeDefinition {
    key: EItemType;
    /** Translation key — passed through `t(labelKey)` in menus. */
    labelKey: string;
    /** Translation key — one-line module description shown in the picker dialog. */
    descriptionKey: string;
    /** Category bucket — drives the picker dialog's filter chips. */
    category: ItemCategory;
    /** Public-site renderer. */
    Display: React.ComponentType<{item: IItem; t: TFunction<"translation", undefined>; tApp: TFunction<string, undefined>; admin?: boolean}>;
    /** Admin editor. */
    Editor: React.ComponentType<{
        t: TFunction<"translation", undefined>;
        content: string;
        setContent: (value: string) => void;
    }>;
    /** Enum of allowed style values for this type; used to populate the Style picker. */
    styleEnum: Record<string, string>;
    /** Default content JSON for a freshly created item. */
    defaultContent: string;
}

const entries: ItemTypeDefinition[] = [
    {
        key: EItemType.Text,
        labelKey: "Simple Text",
        descriptionKey: "Plain paragraph with inline style only.",
        category: 'content',
        Display: PlainText,
        Editor: InputPlainText,
        styleEnum: EPlainTextStyle as unknown as Record<string, string>,
        defaultContent: '{"value":""}',
    },
    {
        key: EItemType.RichText,
        labelKey: "Rich text",
        descriptionKey: "HTML body with italic-accent runs and headings.",
        category: 'content',
        Display: RichText,
        Editor: InputRichText,
        styleEnum: ERichTextStyle as unknown as Record<string, string>,
        defaultContent: '{"value":""}',
    },
    {
        key: EItemType.Image,
        labelKey: "Image",
        descriptionKey: "Single image with optional caption.",
        category: 'media',
        Display: PlainImage,
        Editor: InputPlainImage,
        styleEnum: EImageStyle as unknown as Record<string, string>,
        defaultContent: '{"src":"","useAsBackground":false}',
    },
    {
        key: EItemType.Gallery,
        labelKey: "Gallery",
        descriptionKey: "Image grid with optional text-only tiles.",
        category: 'media',
        Display: Gallery,
        Editor: InputGallery,
        styleEnum: EGalleryStyle as unknown as Record<string, string>,
        defaultContent: '{"items":[]}',
    },
    {
        key: EItemType.Carousel,
        labelKey: "Carousel",
        descriptionKey: "Horizontally scrollable image strip.",
        category: 'media',
        Display: CarouselView,
        Editor: InputCarousel,
        styleEnum: ECarouselStyle as unknown as Record<string, string>,
        defaultContent: '{"items":[]}',
    },
    {
        key: EItemType.Hero,
        labelKey: "Hero",
        descriptionKey: "Full-bleed header with headline, subtitle, CTA.",
        category: 'hero',
        Display: Hero,
        Editor: InputHero,
        styleEnum: EHeroStyle as unknown as Record<string, string>,
        defaultContent: '{"headline":"","subtitle":"","tagline":"","bgImage":"","accent":""}',
    },
    {
        key: EItemType.ProjectCard,
        labelKey: "Project card",
        descriptionKey: "Single featured project with cover and tags.",
        category: 'content',
        Display: ProjectCard,
        Editor: InputProjectCard,
        styleEnum: EProjectCardStyle as unknown as Record<string, string>,
        defaultContent: '{"title":"","description":"","image":"","tags":[]}',
    },
    {
        key: EItemType.SkillPills,
        labelKey: "Skill pills",
        descriptionKey: "Tag cloud or matrix of skills.",
        category: 'content',
        Display: SkillPills,
        Editor: InputSkillPills,
        styleEnum: ESkillPillsStyle as unknown as Record<string, string>,
        defaultContent: '{"category":"","items":[]}',
    },
    {
        key: EItemType.Timeline,
        labelKey: "Timeline",
        descriptionKey: "Vertical or horizontal milestone list.",
        category: 'content',
        Display: Timeline,
        Editor: InputTimeline,
        styleEnum: ETimelineStyle as unknown as Record<string, string>,
        defaultContent: '{"entries":[]}',
    },
    {
        key: EItemType.SocialLinks,
        labelKey: "Social links",
        descriptionKey: "Row of icon links to external profiles.",
        category: 'cta',
        Display: SocialLinks,
        Editor: InputSocialLinks,
        styleEnum: ESocialLinksStyle as unknown as Record<string, string>,
        defaultContent: '{"links":[]}',
    },
    {
        key: EItemType.BlogFeed,
        labelKey: "Blog feed",
        descriptionKey: "Latest posts pulled from the Posts collection.",
        category: 'content',
        Display: BlogFeed,
        Editor: InputBlogFeed,
        styleEnum: EBlogFeedStyle as unknown as Record<string, string>,
        defaultContent: '{"limit":6,"tag":"","heading":""}',
    },
    {
        key: EItemType.List,
        labelKey: "List",
        descriptionKey: "Bullet or numbered list, optional meta fields.",
        category: 'content',
        Display: List,
        Editor: InputList,
        styleEnum: EListStyle as unknown as Record<string, string>,
        defaultContent: '{"title":"","items":[]}',
    },
    {
        key: EItemType.Services,
        labelKey: "Services",
        descriptionKey: "Icon + heading + body cards grouped by row.",
        category: 'content',
        Display: Services,
        Editor: InputServices,
        styleEnum: EServicesStyle as unknown as Record<string, string>,
        defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","rows":[]}',
    },
    {
        key: EItemType.Testimonials,
        labelKey: "Testimonials",
        descriptionKey: "Quote cards with avatar and attribution.",
        category: 'content',
        Display: Testimonials,
        Editor: InputTestimonials,
        styleEnum: ETestimonialsStyle as unknown as Record<string, string>,
        defaultContent: '{"sectionTitle":"","sectionSubtitle":"","items":[]}',
    },
    {
        key: EItemType.StatsCard,
        labelKey: "Stats card",
        descriptionKey: "Metric / number callout with feature list.",
        category: 'content',
        Display: StatsCard,
        Editor: InputStatsCard,
        styleEnum: EStatsCardStyle as unknown as Record<string, string>,
        defaultContent: '{"tag":"","title":"","stats":[],"features":[]}',
    },
    {
        key: EItemType.ProjectGrid,
        labelKey: "Project grid",
        descriptionKey: "Card grid with image, title, tags per item.",
        category: 'content',
        Display: ProjectGrid,
        Editor: InputProjectGrid,
        styleEnum: EProjectGridStyle as unknown as Record<string, string>,
        defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","items":[]}',
    },
    {
        key: EItemType.Manifesto,
        labelKey: "Manifesto",
        descriptionKey: "Full-width editorial block with chip footer.",
        category: 'hero',
        Display: Manifesto,
        Editor: InputManifesto,
        styleEnum: EManifestoStyle as unknown as Record<string, string>,
        defaultContent: '{"body":"","addendum":"","chips":[]}',
    },
    {
        key: EItemType.InquiryForm,
        labelKey: "Inquiry form",
        descriptionKey: "Topic chips + name/email/message + submit (CV Contact).",
        category: 'cta',
        Display: InquiryForm,
        Editor: InputInquiryForm,
        styleEnum: EInquiryFormStyle as unknown as Record<string, string>,
        defaultContent: '{"topics":[],"fields":[]}',
    },
    {
        key: EItemType.DataModel,
        labelKey: "Data model",
        descriptionKey: "Schema visualiser — fields table + collections aside + audit cards.",
        category: 'content',
        Display: DataModel,
        Editor: InputDataModel,
        styleEnum: EDataModelStyle as unknown as Record<string, string>,
        defaultContent: '{"fields":[],"collections":[],"audits":[]}',
    },
    {
        key: EItemType.InfraTopology,
        labelKey: "Infra topology",
        descriptionKey: "Droplet/server cards + author-supplied SVG topology.",
        category: 'content',
        Display: InfraTopology,
        Editor: InputInfraTopology,
        styleEnum: EInfraTopologyStyle as unknown as Record<string, string>,
        defaultContent: '{"droplets":[]}',
    },
    {
        key: EItemType.PipelineFlow,
        labelKey: "Pipeline flow",
        descriptionKey: "Linear CI/CD pipeline with status pills and side notes.",
        category: 'content',
        Display: PipelineFlow,
        Editor: InputPipelineFlow,
        styleEnum: EPipelineFlowStyle as unknown as Record<string, string>,
        defaultContent: '{"steps":[],"sideNotes":[]}',
    },
    {
        key: EItemType.RepoTree,
        labelKey: "Repo tree",
        descriptionKey: "Interactive repo path tree with detail pane.",
        category: 'content',
        Display: RepoTree,
        Editor: InputRepoTree,
        styleEnum: ERepoTreeStyle as unknown as Record<string, string>,
        defaultContent: '{"nodes":[]}',
    },
];

export const ITEM_TYPE_REGISTRY: Record<string, ItemTypeDefinition> = Object.fromEntries(
    entries.map(e => [e.key, e])
);

export const getItemTypeDefinition = (key: string | EItemType): ItemTypeDefinition | undefined =>
    ITEM_TYPE_REGISTRY[key as string];

export const styleEnumFor = (key: string | EItemType): Record<string, string> =>
    ITEM_TYPE_REGISTRY[key as string]?.styleEnum ?? (EStyle as unknown as Record<string, string>);

export const itemTypeList = (): ItemTypeDefinition[] => entries;
