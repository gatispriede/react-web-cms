/**
 * Item type registry — admin Editor (Input*) and site Display (SectionComponents/*) paired
 * as siblings per item type. Adding a new block type = one registry entry here.
 * Both the site renderer (ContentType) and the admin content picker (ContentSection)
 * consume this registry.
 */
import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {EStyle} from "../../../enums/EStyle";
import {TFunction} from "i18next";
import {IItem} from "../../../Interfaces/IItem";

import PlainText, {EPlainTextStyle} from "../SectionComponents/PlainText";
import RichText, {ERichTextStyle} from "../SectionComponents/RichText";
import PlainImage, {EImageStyle} from "../SectionComponents/PlainImage";
import Gallery, {EGalleryStyle} from "../SectionComponents/Gallery";
import CarouselView, {ECarouselStyle} from "../SectionComponents/CarouselView";
import Hero, {EHeroStyle} from "../SectionComponents/Hero";
import ProjectCard, {EProjectCardStyle} from "../SectionComponents/ProjectCard";
import SkillPills, {ESkillPillsStyle} from "../SectionComponents/SkillPills";
import Timeline, {ETimelineStyle} from "../SectionComponents/Timeline";
import SocialLinks, {ESocialLinksStyle} from "../SectionComponents/SocialLinks";
import BlogFeed, {EBlogFeedStyle} from "../SectionComponents/BlogFeed";

import InputPlainText from "../Admin/ConfigComponents/InputPlainText";
import InputRichText from "../Admin/ConfigComponents/InputRichText";
import InputPlainImage from "../Admin/ConfigComponents/InputPlainImage";
import InputGallery from "../Admin/ConfigComponents/InputGallery";
import InputCarousel from "../Admin/ConfigComponents/InputCarousel";
import InputHero from "../Admin/ConfigComponents/InputHero";
import InputProjectCard from "../Admin/ConfigComponents/InputProjectCard";
import InputSkillPills from "../Admin/ConfigComponents/InputSkillPills";
import InputTimeline from "../Admin/ConfigComponents/InputTimeline";
import InputSocialLinks from "../Admin/ConfigComponents/InputSocialLinks";
import InputBlogFeed from "../Admin/ConfigComponents/InputBlogFeed";

export interface ItemTypeDefinition {
    key: EItemType;
    /** Translation key — passed through `t(labelKey)` in menus. */
    labelKey: string;
    /** Public-site renderer. */
    Display: React.ComponentType<{item: IItem; t: TFunction<"translation", undefined>; tApp: TFunction<string, undefined>}>;
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
        Display: PlainText,
        Editor: InputPlainText,
        styleEnum: EPlainTextStyle as unknown as Record<string, string>,
        defaultContent: '{"value":""}',
    },
    {
        key: EItemType.RichText,
        labelKey: "Rich text",
        Display: RichText,
        Editor: InputRichText,
        styleEnum: ERichTextStyle as unknown as Record<string, string>,
        defaultContent: '{"value":""}',
    },
    {
        key: EItemType.Image,
        labelKey: "Image",
        Display: PlainImage,
        Editor: InputPlainImage,
        styleEnum: EImageStyle as unknown as Record<string, string>,
        defaultContent: '{"src":"","useAsBackground":false}',
    },
    {
        key: EItemType.Gallery,
        labelKey: "Gallery",
        Display: Gallery,
        Editor: InputGallery,
        styleEnum: EGalleryStyle as unknown as Record<string, string>,
        defaultContent: '{"items":[]}',
    },
    {
        key: EItemType.Carousel,
        labelKey: "Carousel",
        Display: CarouselView,
        Editor: InputCarousel,
        styleEnum: ECarouselStyle as unknown as Record<string, string>,
        defaultContent: '{"items":[]}',
    },
    {
        key: EItemType.Hero,
        labelKey: "Hero",
        Display: Hero,
        Editor: InputHero,
        styleEnum: EHeroStyle as unknown as Record<string, string>,
        defaultContent: '{"headline":"","subtitle":"","tagline":"","bgImage":"","accent":""}',
    },
    {
        key: EItemType.ProjectCard,
        labelKey: "Project card",
        Display: ProjectCard,
        Editor: InputProjectCard,
        styleEnum: EProjectCardStyle as unknown as Record<string, string>,
        defaultContent: '{"title":"","description":"","image":"","tags":[]}',
    },
    {
        key: EItemType.SkillPills,
        labelKey: "Skill pills",
        Display: SkillPills,
        Editor: InputSkillPills,
        styleEnum: ESkillPillsStyle as unknown as Record<string, string>,
        defaultContent: '{"category":"","items":[]}',
    },
    {
        key: EItemType.Timeline,
        labelKey: "Timeline",
        Display: Timeline,
        Editor: InputTimeline,
        styleEnum: ETimelineStyle as unknown as Record<string, string>,
        defaultContent: '{"entries":[]}',
    },
    {
        key: EItemType.SocialLinks,
        labelKey: "Social links",
        Display: SocialLinks,
        Editor: InputSocialLinks,
        styleEnum: ESocialLinksStyle as unknown as Record<string, string>,
        defaultContent: '{"links":[]}',
    },
    {
        key: EItemType.BlogFeed,
        labelKey: "Blog feed",
        Display: BlogFeed,
        Editor: InputBlogFeed,
        styleEnum: EBlogFeedStyle as unknown as Record<string, string>,
        defaultContent: '{"limit":6,"tag":"","heading":""}',
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
