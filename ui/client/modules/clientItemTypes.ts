/**
 * Client-side module renderers — Class Loader L4 (2026-05-03).
 *
 * Used to live inline in `ui/admin/lib/itemTypes/registry.ts` paired
 * with the admin Editors. The flat list pulled both halves into a
 * single file, which forced the admin bundle and the public-site
 * bundle to share a hard dependency.
 *
 * Split now lives in two places:
 *   - `ui/client/modules/clientItemTypes.ts`   (this file — Display half)
 *   - `ui/admin/modules/adminItemTypeEditors.ts` (Editor half)
 *
 * `itemTypes/registry.ts` zips them by `key`. Any module that's missing
 * from one side is a programmer error and the registry throws at boot.
 *
 * Per-module ClientUILoader files (e.g. `Hero/HeroClientUILoader.ts`)
 * are an acceptable next step but would add 24 micro-files for no
 * runtime gain — composing once at registry time is enough.
 */
import type {ClientItemType} from '@client/lib/loaders/ClientUILoader';
import {EItemType} from '@enums/EItemType';

import PlainText from '@client/modules/PlainText';
import RichText from '@client/modules/RichText';
import PlainImage from '@client/modules/PlainImage';
import Gallery from '@client/modules/Gallery';
import CarouselView from '@client/modules/Carousel';
import Hero from '@client/modules/Hero';
import ProjectCard from '@client/modules/ProjectCard';
import SkillPills from '@client/modules/SkillPills';
import Timeline from '@client/modules/Timeline';
import SocialLinks from '@client/modules/SocialLinks';
import BlogFeed from '@client/modules/BlogFeed';
import List from '@client/modules/List';
import Services from '@client/modules/Services';
import Testimonials from '@client/modules/Testimonials';
import StatsCard from '@client/modules/StatsCard';
import ProjectGrid from '@client/modules/ProjectGrid';
import Manifesto from '@client/modules/Manifesto';
import InquiryForm from '@client/modules/InquiryForm';
import DataModel from '@client/modules/DataModel';
import InfraTopology from '@client/modules/InfraTopology';
import PipelineFlow from '@client/modules/PipelineFlow';
import RepoTree from '@client/modules/RepoTree';
import ArchitectureTiers from '@client/modules/ArchitectureTiers';
import StatsStrip from '@client/modules/StatsStrip';

export const CLIENT_ITEM_TYPES: readonly ClientItemType[] = [
    {key: EItemType.Text, Display: PlainText},
    {key: EItemType.RichText, Display: RichText},
    {key: EItemType.Image, Display: PlainImage},
    {key: EItemType.Gallery, Display: Gallery},
    {key: EItemType.Carousel, Display: CarouselView},
    {key: EItemType.Hero, Display: Hero},
    {key: EItemType.ProjectCard, Display: ProjectCard},
    {key: EItemType.SkillPills, Display: SkillPills},
    {key: EItemType.Timeline, Display: Timeline},
    {key: EItemType.SocialLinks, Display: SocialLinks},
    {key: EItemType.BlogFeed, Display: BlogFeed},
    {key: EItemType.List, Display: List},
    {key: EItemType.Services, Display: Services},
    {key: EItemType.Testimonials, Display: Testimonials},
    {key: EItemType.StatsCard, Display: StatsCard},
    {key: EItemType.ProjectGrid, Display: ProjectGrid},
    {key: EItemType.Manifesto, Display: Manifesto},
    {key: EItemType.InquiryForm, Display: InquiryForm},
    {key: EItemType.DataModel, Display: DataModel},
    {key: EItemType.InfraTopology, Display: InfraTopology},
    {key: EItemType.PipelineFlow, Display: PipelineFlow},
    {key: EItemType.RepoTree, Display: RepoTree},
    {key: EItemType.ArchitectureTiers, Display: ArchitectureTiers},
    {key: EItemType.StatsStrip, Display: StatsStrip},
];
