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
import {ELargeGalleryStyle} from '@client/modules/LargeGallery';
import {EDownloadablePdfStyle} from '@client/modules/DownloadablePdf';
import {EDataModelStyle} from '@client/modules/DataModel';
import {EInfraTopologyStyle} from '@client/modules/InfraTopology';
import {EPipelineFlowStyle} from '@client/modules/PipelineFlow';
import {ERepoTreeStyle} from '@client/modules/RepoTree';
import {EArchitectureTiersStyle} from '@client/modules/ArchitectureTiers';
import {EStatsStripStyle} from '@client/modules/StatsStrip';
import {ESectionHeadingStyle} from '@client/modules/SectionHeading';
import {EKeyValueDossierStyle} from '@client/modules/KeyValueDossier';
import {EProductStyle} from '@client/modules/Product';

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
import {SectionHeadingEditor} from '@admin/modules/SectionHeading';
import {KeyValueDossierEditor} from '@admin/modules/KeyValueDossier';
import {ProductEditor} from '@admin/modules/Product/ProductEditor';
import {EProductDetailHeroStyle} from '@client/modules/ProductDetailHero';
import {EProductSpecTableStyle} from '@client/modules/ProductSpecTable';
import {EProductDescriptionStyle} from '@client/modules/ProductDescription';
import {EPaginationStyle} from '@client/modules/Pagination';
import {EBreadcrumbStyle} from '@client/modules/Breadcrumb';
import {EFeatureGridStyle} from '@client/modules/FeatureGrid';
import {ELogoCloudStyle} from '@client/modules/LogoCloud';
import {EPricingTableStyle} from '@client/modules/PricingTable';
import {ETrustBadgesStyle} from '@client/modules/Trust/TrustBadges';
import {EMoneyBackGuaranteeStyle} from '@client/modules/Trust/MoneyBackGuarantee';
import {EReferAFriendCtaStyle} from '@client/modules/Marketing/ReferAFriendCta';
import {ESocialShareButtonsStyle} from '@client/modules/Marketing/SocialShareButtons';
import {
    ProductDetailHeroEditor,
    ProductSpecTableEditor,
    ProductDescriptionEditor,
    BreadcrumbEditor,
    PaginationEditor,
    LargeGalleryEditor,
    SubProductsGridEditor,
    DownloadablePdfEditor,
    WarrantyInfoEditor,
} from '@admin/modules/_ProductPageModules/editors';
// Phase 1.D — checkout-as-composable-page editor wrappers.
import {
    CartLineItemsEditor,
    CartSummaryEditor,
    CartActionsEditor,
    CheckoutProgressBarEditor,
    CheckoutAddressFormEditor,
    CheckoutShippingMethodEditor,
    CheckoutPaymentFormEditor,
    CheckoutCartSummaryEditor,
    PlaceOrderButtonEditor,
    OrderSummaryEditor,
    MagicLinkAccountUpgradeEditor,
    AccountWelcomeEditor,
    ShippingCalculatorEditor,
    DownloadInvoiceButtonEditor,
    TrustBadgesEditor,
    MoneyBackGuaranteeEditor,
    ReferAFriendCtaEditor,
    SocialShareButtonsEditor,
} from '@admin/modules/_CheckoutPageModules/editors';
// all-pages-module-composed — Account + Auth batch copy editors.
import {
    OrdersListEditor,
    OrderDetailEditor,
    AddressListEditor,
    NotificationInboxEditor,
    AccountDashboardGridEditor,
    AccountProfileFormEditor,
    AccountSettingsLayoutEditor,
    SigninFormEditor,
    SignupFormEditor,
    CustomerVerifyConfirmEditor,
    MagicLinkRequestFormEditor,
} from '@admin/modules/_AccountPageModules/editors';
// all-pages-module-composed — Blog batch editor.
import {BlogPostEditor} from '@admin/modules/_BlogPageModules/editors';
import {EBlogPostStyle} from '@client/modules/BlogPost/BlogPost.types';
// all-pages-module-composed — Marketing batch editors.
import {
    FeatureGridEditor,
    LogoCloudEditor,
    PricingTableEditor,
    TestimonialWallEditor,
} from '@admin/modules/_MarketingPageModules/editors';
// all-pages-module-composed — Cars batch editors.
import {CarsListEditor, CarDetailEditor} from '@admin/modules/_CarsPageModules/editors';

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

/**
 * Friendly Style-picker labels per module, keyed by enum *value*
 * (the lowercase identifier stored on `item.style`). The picker
 * displays these instead of the enum *key name* when present.
 * Falls back to the key name (e.g. `CardGrid`) otherwise.
 *
 * Naming guidance:
 *   - Plain English, no jargon. An operator with no design vocabulary
 *     should be able to pick a variant from the dropdown alone.
 *   - Disambiguate visually distinctive shapes — "Photo bleed" beats
 *     "Editorial" when Editorial is also a theme name.
 *   - Keep parenthetical hints when the visual is non-obvious from the
 *     name, e.g. "Polaroid (rotated tiles)".
 *   - 1-4 words max — a long label crowds the dropdown.
 */
const HERO_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    centered: 'Centered',
    compact: 'Compact',
    editorial: 'Photo bleed',
    poster: 'Poster',
    cinematic: 'Cinematic (letterboxed)',
    split: 'Split (50/50)',
    glass: 'Glass card',
};
const KEY_VALUE_DOSSIER_STYLE_LABELS: Record<string, string> = {
    editorial: 'Editorial (paper)',
    'tech-modern': 'Modern (dark)',
    'card-grid': 'Card grid',
    spec: 'Spec sheet',
    print: 'Dot-matrix print',
    compact: 'Compact dense',
};
const GALLERY_STYLE_LABELS: Record<string, string> = {
    default: 'Standard grid',
    marquee: 'Marquee (scrolling)',
    'logo-wall': 'Logo wall',
    'hazard-strip': 'Hazard strip',
    masonry: 'Masonry',
    polaroid: 'Polaroid stack',
    mosaic: 'Featured mosaic',
    cinema: 'Cinema 16:9',
};
const LIST_STYLE_LABELS: Record<string, string> = {
    default: 'Bullet list',
    facts: 'Key facts',
    inline: 'Inline (single line)',
    cases: 'Case cards',
    'paper-grid': 'Paper cards',
    checklist: 'Checklist',
    timeline: 'Timeline',
    numbered: 'Numbered',
    cards: 'Card rows',
    newspaper: 'Newspaper columns',
    tasks: 'Tasks (strike-through)',
};
const SKILL_PILLS_STYLE_LABELS: Record<string, string> = {
    default: 'Pills',
    compact: 'Compact pills',
    matrix: 'Skill matrix',
    'stack-grid': 'Tech stack grid',
    constellation: 'Constellation',
    brutalist: 'Brutalist blocks',
    hex: 'Hexagon pills',
    tags: 'Hashtag tags',
    cloud: 'Word cloud',
    neon: 'Neon glow',
};
const SERVICES_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    numbered: 'Numbered list',
    grid: 'Card grid',
    cards: 'Inverted cards',
    tiers: 'Architecture tiers',
    carousel: 'Scroll carousel',
    brutalist: 'Brutalist blocks',
    pricing: 'Pricing stacks',
};
const MANIFESTO_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    accent: 'Accent banner',
    quote: 'Pull quote',
    poster: 'Poster headline',
    typewriter: 'Typewriter',
};
const CAROUSEL_STYLE_LABELS: Record<string, string> = {
    default: 'Standard slides',
    cinematic: 'Cinematic (tall)',
    polaroid: 'Polaroid (rotated)',
    ribbon: 'Ribbon (thin)',
    editorial: 'Editorial (square)',
    coverflow: 'Coverflow (tilted)',
    cinema: 'Cinema (letterbox)',
    cards: 'Cards (deck)',
};
const STATS_CARD_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    panel: 'Industrial panel',
    ticker: 'Ticker (odometer)',
    neon: 'Neon (dark glow)',
    outline: 'Outline (text stroke)',
};
const STATS_STRIP_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (rules)',
    card: 'Card (frosted glass)',
    neon: 'Neon (dark glow)',
    outline: 'Outline (text stroke)',
};
const PROJECT_GRID_STYLE_LABELS: Record<string, string> = {
    default: 'Standard grid',
    studio: 'Studio (gradient covers)',
    masonry: 'Masonry columns',
    magazine: 'Magazine feature',
    polaroid: 'Polaroid tiles',
    cinema: 'Cinema (16:9 dark)',
    tilt: 'Tilt (perspective)',
    filmstrip: 'Filmstrip (horizontal)',
};
const TESTIMONIALS_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    cards: 'Card grid',
    quote: 'Pull quote',
    marquee: 'Scrolling marquee',
    polaroid: 'Polaroid tiles',
    carousel: 'Carousel (single quote)',
    magazine: 'Magazine (feature + grid)',
    stacked: 'Stacked deck',
};
const PROJECT_CARD_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    featured: 'Featured (large)',
    polaroid: 'Polaroid snapshot',
    cinema: 'Cinema letterbox',
    stack: 'Stacked cards',
};
const TIMELINE_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (rule-divided)',
    minimal: 'Minimal',
    vertical: 'Vertical spine',
    zigzag: 'Zigzag alternating',
    cards: 'Floating cards',
    subway: 'Subway map (colored connectors)',
    terminal: 'Terminal (git log mono)',
    horizontal: 'Horizontal (left-to-right)',
};
const BLOG_FEED_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    magazine: 'Magazine (lead + list)',
    cards: 'Cards (3-col grid)',
    cinema: 'Cinema (16:9 dark)',
};
const SECTION_HEADING_STYLE_LABELS: Record<string, string> = {
    editorial: 'Editorial (§ NN, serif)',
    'tech-modern': 'Modern (sans, accent)',
    'centered-marquee': 'Centered marquee',
    'eyebrow-rule': 'Eyebrow + rule',
    banner: 'Banner (full-bleed band)',
    magazine: 'Magazine (serif + italic)',
};
const PLAIN_TEXT_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    centered: 'Centered',
    centeredBoxed: 'Centered boxed',
    lede: 'Lede (large opener)',
    quote: 'Quote (italic + accent rule)',
    dropCap: 'Drop-cap',
};
const RICH_TEXT_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    centeredBoxed: 'Centered boxed',
    magazine: 'Magazine (drop-cap, 2-col)',
    mono: 'Mono (typewriter)',
    letter: 'Letter (handwritten)',
};
const IMAGE_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    polaroid: 'Polaroid (tilted)',
    cinema: 'Cinema (16:9 letterbox)',
    vintage: 'Vintage (sepia + vignette)',
};
const INQUIRY_FORM_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (paper)',
    card: 'Card (elevated)',
    minimal: 'Minimal (hairline)',
    inverse: 'Inverse (dark)',
};
const LARGE_GALLERY_STYLE_LABELS: Record<string, string> = {
    default: 'Standard grid',
    hero: 'Hero (lead image)',
    cinema: 'Cinema (16:9 row)',
    polaroid: 'Polaroid (tilted tiles)',
};
const DOWNLOADABLE_PDF_STYLE_LABELS: Record<string, string> = {
    default: 'Standard button',
    card: 'Card (elevated)',
    banner: 'Banner (full-width accent)',
    inline: 'Inline link',
};
const PRODUCT_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    bordered: 'Bordered',
    minimal: 'Minimal',
    cards: 'Cards (elevated)',
    cinema: 'Cinema (16:9 dark)',
    elevated: 'Elevated lift',
};
const PRODUCT_DETAIL_HERO_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    split: 'Split (50/50)',
    stacked: 'Stacked (image top)',
    magazine: 'Magazine (bleed)',
};
const PRODUCT_SPEC_TABLE_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    striped: 'Striped rows',
    cards: 'Card chips',
    dense: 'Dense two-col',
};
const PRODUCT_DESCRIPTION_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (drop-cap)',
    compact: 'Compact',
    centered: 'Centered measure',
};
const BLOG_POST_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (serif)',
    compact: 'Compact',
    magazine: 'Magazine (multi-col)',
};
const FEATURE_GRID_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    cards: 'Elevated cards',
    compact: 'Compact (4-col)',
    iconic: 'Iconic (large icons)',
};
const LOGO_CLOUD_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    marquee: 'Marquee (scrolling)',
    mono: 'Mono (greyscale)',
    wall: 'Logo wall',
};
const PRICING_TABLE_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    highlighted: 'Highlighted tier',
    toggle: 'Toggle (billing)',
    compact: 'Compact rows',
};
const INFRA_TOPOLOGY_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (paper)',
    terminal: 'Terminal (green-on-black)',
    dashboard: 'Dashboard (status pills)',
    blueprint: 'Blueprint (cyan grid)',
};
const DATA_MODEL_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (paper)',
    erd: 'ERD (entity boxes)',
    terminal: 'Terminal (mysql>)',
    cards: 'Cards (tilted)',
};
const PIPELINE_FLOW_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (paper)',
    subway: 'Subway (colored rail)',
    terminal: 'Terminal ($ run)',
    neon: 'Neon (glow)',
};
const ARCHITECTURE_TIERS_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    editorial: 'Editorial (paper)',
    cards: 'Cards (depth)',
    stack: 'Stack (vertical slabs)',
    timeline: 'Timeline (left-to-right)',
};
const TRUST_BADGES_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    inline: 'Inline (single line)',
    neon: 'Neon (dark glow)',
    outlined: 'Outlined (bold)',
};
const MONEY_BACK_GUARANTEE_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    banner: 'Banner (full width)',
    card: 'Card (elevated)',
    ribbon: 'Ribbon (dark)',
};
const REFER_A_FRIEND_CTA_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    card: 'Card (elevated)',
    banner: 'Banner (gradient)',
    stamp: 'Stamp (rotated)',
};
const SOCIAL_SHARE_BUTTONS_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    pills: 'Pills (filled)',
    outlined: 'Outlined (bold)',
    branded: 'Branded (per-platform)',
};
const BREADCRUMB_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    compact: 'Compact',
    pills: 'Pills',
    slash: 'Slash separators',
    arrow: 'Arrow chevrons',
};
const PAGINATION_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    slim: 'Slim',
    pills: 'Pills',
    numbered: 'Numbered',
    minimal: 'Minimal (prev/next)',
};
const SOCIAL_LINKS_STYLE_LABELS: Record<string, string> = {
    default: 'Standard',
    large: 'Large',
    channels: 'Channels strip',
    icons: 'Icons only',
    branded: 'Branded colors',
    floating: 'Floating rail',
};

export const ADMIN_ITEM_TYPE_EDITORS: readonly AdminItemTypeEntry[] = [
    {key: EItemType.Text,            Editor: PlainTextEditor,        styleEnum: asEnum(EPlainTextStyle), styleLabels: PLAIN_TEXT_STYLE_LABELS,      defaultContent: '{"value":""}',                                                                                                                                                              labelKey: 'Simple Text',          descriptionKey: 'Plain paragraph with inline style only.',                            category: 'content'},
    {key: EItemType.RichText,        Editor: RichTextEditor,         styleEnum: asEnum(ERichTextStyle), styleLabels: RICH_TEXT_STYLE_LABELS,       defaultContent: '{"value":""}',                                                                                                                                                              labelKey: 'Rich text',            descriptionKey: 'HTML body with italic-accent runs and headings.',                    category: 'content'},
    {key: EItemType.Image,           Editor: PlainImageEditor,       styleEnum: asEnum(EImageStyle), styleLabels: IMAGE_STYLE_LABELS,            defaultContent: '{"src":"","useAsBackground":false}',                                                                                                                                        labelKey: 'Image',                descriptionKey: 'Single image with optional caption.',                                category: 'media'},
    {key: EItemType.Gallery,         Editor: GalleryEditor,          styleEnum: asEnum(EGalleryStyle), styleLabels: GALLERY_STYLE_LABELS,         defaultContent: '{"items":[],"showCaptions":true}',                                                                                                                                           labelKey: 'Gallery',              descriptionKey: 'Image grid with optional text-only tiles.',                          category: 'media'},
    {key: EItemType.Carousel,        Editor: CarouselEditor,         styleEnum: asEnum(ECarouselStyle), styleLabels: CAROUSEL_STYLE_LABELS,        defaultContent: '{"items":[]}',                                                                                                                                                              labelKey: 'Carousel',             descriptionKey: 'Horizontally scrollable image strip.',                               category: 'media'},
    {key: EItemType.Hero,            Editor: HeroEditor,             styleEnum: asEnum(EHeroStyle), styleLabels: HERO_STYLE_LABELS,            defaultContent: '{"headline":"","subtitle":"","tagline":"","bgImage":"","accent":""}',                                                                                                       labelKey: 'Hero',                 descriptionKey: 'Full-bleed header with headline, subtitle, CTA.',                    category: 'hero'},
    {key: EItemType.ProjectCard,     Editor: ProjectCardEditor,      styleEnum: asEnum(EProjectCardStyle), styleLabels: PROJECT_CARD_STYLE_LABELS,     defaultContent: '{"title":"","description":"","image":"","tags":[]}',                                                                                                                        labelKey: 'Project card',         descriptionKey: 'Single featured project with cover and tags.',                       category: 'content'},
    {key: EItemType.SkillPills,      Editor: SkillPillsEditor,       styleEnum: asEnum(ESkillPillsStyle), styleLabels: SKILL_PILLS_STYLE_LABELS,      defaultContent: '{"category":"","items":[]}',                                                                                                                                                labelKey: 'Skill pills',          descriptionKey: 'Tag cloud or matrix of skills.',                                     category: 'content'},
    {key: EItemType.Timeline,        Editor: TimelineEditor,         styleEnum: asEnum(ETimelineStyle), styleLabels: TIMELINE_STYLE_LABELS,        defaultContent: '{"entries":[{"start":"","end":"","company":"","role":""}]}',                                                                                                                labelKey: 'Timeline',             descriptionKey: 'Vertical or horizontal milestone list.',                             category: 'content'},
    {key: EItemType.SocialLinks,     Editor: SocialLinksEditor,      styleEnum: asEnum(ESocialLinksStyle), styleLabels: SOCIAL_LINKS_STYLE_LABELS,     defaultContent: '{"links":[{"platform":"website","url":"","label":""}]}',                                                                                                                    labelKey: 'Social links',         descriptionKey: 'Row of icon links to external profiles.',                            category: 'cta'},
    {key: EItemType.BlogFeed,        Editor: BlogFeedEditor,         styleEnum: asEnum(EBlogFeedStyle), styleLabels: BLOG_FEED_STYLE_LABELS,        defaultContent: '{"limit":6,"tag":"","heading":""}',                                                                                                                                         labelKey: 'Blog feed',            descriptionKey: 'Latest posts pulled from the Posts collection.',                     category: 'content'},
    {key: EItemType.List,            Editor: ListEditor,             styleEnum: asEnum(EListStyle), styleLabels: LIST_STYLE_LABELS,            defaultContent: '{"title":"","items":[{"label":"","value":"","href":""}]}',                                                                                                                  labelKey: 'List',                 descriptionKey: 'Bullet or numbered list, optional meta fields.',                     category: 'content'},
    {key: EItemType.Services,        Editor: ServicesEditor,         styleEnum: asEnum(EServicesStyle), styleLabels: SERVICES_STYLE_LABELS,        defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","rows":[{"number":"01","title":"","description":"","ctaLabel":"","ctaHref":"","iconGlyph":"","tags":[]}]}',      labelKey: 'Services',             descriptionKey: 'Icon + heading + body cards grouped by row.',                        category: 'content'},
    {key: EItemType.Testimonials,    Editor: TestimonialsEditor,     styleEnum: asEnum(ETestimonialsStyle), styleLabels: TESTIMONIALS_STYLE_LABELS,    defaultContent: '{"sectionTitle":"","sectionSubtitle":"","items":[{"quote":"","name":"","role":"","avatarInitial":""}]}',                                                                    labelKey: 'Testimonials',         descriptionKey: 'Quote cards with avatar and attribution.',                           category: 'content'},
    {key: EItemType.StatsCard,       Editor: StatsCardEditor,        styleEnum: asEnum(EStatsCardStyle), styleLabels: STATS_CARD_STYLE_LABELS,      defaultContent: '{"tag":"","title":"","stats":[{"value":"","label":""}],"features":[]}',                                                                                                     labelKey: 'Stats card',           descriptionKey: 'Metric / number callout with feature list.',                         category: 'content'},
    {key: EItemType.ProjectGrid,     Editor: ProjectGridEditor,      styleEnum: asEnum(EProjectGridStyle), styleLabels: PROJECT_GRID_STYLE_LABELS,     defaultContent: '{"sectionNumber":"","sectionTitle":"","sectionSubtitle":"","items":[{"title":"","stack":"","kind":"","year":"","coverArt":"","coverColor":"","moreLabel":"View engagement ↗","href":""}]}', labelKey: 'Project grid', descriptionKey: 'Card grid with image, title, tags per item.',                category: 'content'},
    {key: EItemType.Manifesto,       Editor: ManifestoEditor,        styleEnum: asEnum(EManifestoStyle), styleLabels: MANIFESTO_STYLE_LABELS,       defaultContent: '{"body":"","addendum":"","chips":[]}',                                                                                                                                      labelKey: 'Manifesto',            descriptionKey: 'Full-width editorial block with chip footer.',                       category: 'hero'},
    {key: EItemType.InquiryForm,     Editor: InquiryFormEditor,      styleEnum: asEnum(EInquiryFormStyle), styleLabels: INQUIRY_FORM_STYLE_LABELS,     defaultContent: '{"topics":[],"fields":[]}',                                                                                                                                                 labelKey: 'Inquiry form',         descriptionKey: 'Topic chips + name/email/message + submit (CV Contact).',            category: 'cta'},
    {key: EItemType.DataModel,       Editor: DataModelEditor,        styleEnum: asEnum(EDataModelStyle),       styleLabels: DATA_MODEL_STYLE_LABELS, defaultContent: '{"fields":[],"collections":[],"audits":[]}',                                                                                                                                labelKey: 'Data model',           descriptionKey: 'Schema visualiser — fields table + collections aside + audit cards.',category: 'content'},
    {key: EItemType.InfraTopology,   Editor: InfraTopologyEditor,    styleEnum: asEnum(EInfraTopologyStyle),   styleLabels: INFRA_TOPOLOGY_STYLE_LABELS, defaultContent: '{"droplets":[]}',                                                                                                                                                           labelKey: 'Infra topology',       descriptionKey: 'Droplet/server cards + author-supplied SVG topology.',               category: 'content'},
    {key: EItemType.PipelineFlow,    Editor: PipelineFlowEditor,     styleEnum: asEnum(EPipelineFlowStyle),    styleLabels: PIPELINE_FLOW_STYLE_LABELS, defaultContent: '{"steps":[],"sideNotes":[]}',                                                                                                                                               labelKey: 'Pipeline flow',        descriptionKey: 'Linear CI/CD pipeline with status pills and side notes.',            category: 'content'},
    {key: EItemType.RepoTree,        Editor: RepoTreeEditor,         styleEnum: asEnum(ERepoTreeStyle),        defaultContent: '{"nodes":[]}',                                                                                                                                                              labelKey: 'Repo tree',            descriptionKey: 'Interactive repo path tree with detail pane.',                       category: 'content'},
    {key: EItemType.ArchitectureTiers, Editor: ArchitectureTiersEditor, styleEnum: asEnum(EArchitectureTiersStyle), styleLabels: ARCHITECTURE_TIERS_STYLE_LABELS, defaultContent: '{"tiers":[]}',                                                                                                                                                         labelKey: 'Architecture tiers',   descriptionKey: 'Tier cards (concern/role/title/pills/modules) + shared footer + lifecycle rail.', category: 'content'},
    {key: EItemType.StatsStrip,      Editor: StatsStripEditor,       styleEnum: asEnum(EStatsStripStyle), styleLabels: STATS_STRIP_STYLE_LABELS,      defaultContent: '{"cells":[]}',                                                                                                                                                              labelKey: 'Stats strip',          descriptionKey: 'Horizontal numeric strip — value / unit / caption per cell.',        category: 'content'},
    {key: EItemType.SectionHeading,      Editor: SectionHeadingEditor,           styleEnum: asEnum(ESectionHeadingStyle), styleLabels: SECTION_HEADING_STYLE_LABELS, defaultContent: '{"heading":""}',                                                                                                                                                              labelKey: 'Section heading',          descriptionKey: 'Eyebrow + heading + subtitle — replaces hand-typed h2 + em pattern', category: 'content'},
    {key: EItemType.KeyValueDossier, Editor: KeyValueDossierEditor,  styleEnum: asEnum(EKeyValueDossierStyle), styleLabels: KEY_VALUE_DOSSIER_STYLE_LABELS, defaultContent: '{"items":[]}',                                                                                                                                                              labelKey: 'Key/value dossier',    descriptionKey: 'Structured label/value table — replaces hand-typed dl/dt/dd in RichText. 3 style variants.', category: 'content'},
    {key: EItemType.Product,         Editor: ProductEditor,          styleEnum: asEnum(EProductStyle), styleLabels: PRODUCT_STYLE_LABELS,        defaultContent: '{"mode":"grid","products":{"source":"manual","ids":[],"limit":6},"showBuyCta":true,"showPrice":true,"grid":{"columns":3,"density":"standard"}}',                                labelKey: 'Product',              descriptionKey: 'Featured / grid / carousel / comparison / related — pick mode in editor.', category: 'content'},
    // Phase 1.C — products-as-composable-page sub-jump B. Auto-injected by
    // CategoryTemplate / ProductDetailTemplate; the editors are placeholders
    // (JSON textarea or constrained Select for the Pagination variant) until
    // bespoke per-module UIs ship as a follow-up.
    {key: EItemType.ProductDetailHero, Editor: ProductDetailHeroEditor, styleEnum: asEnum(EProductDetailHeroStyle), styleLabels: PRODUCT_DETAIL_HERO_STYLE_LABELS, defaultContent: '{"productId":"","showBuyCta":true,"showVatBadge":true}',                                                                                                                       labelKey: 'Product detail hero',  descriptionKey: 'Image gallery + title + price + Buy CTA + VAT badge — bound to the page product.', category: 'hero'},
    {key: EItemType.ProductSpecTable,  Editor: ProductSpecTableEditor,  styleEnum: asEnum(EProductSpecTableStyle), styleLabels: PRODUCT_SPEC_TABLE_STYLE_LABELS, defaultContent: '{"productId":"","autoFromAttributes":true}',                                                                                                                                  labelKey: 'Spec table',           descriptionKey: 'Two-column key/value table auto-generated from IProduct.attributes.',           category: 'content'},
    {key: EItemType.ProductDescription, Editor: ProductDescriptionEditor, styleEnum: asEnum(EProductDescriptionStyle), styleLabels: PRODUCT_DESCRIPTION_STYLE_LABELS, defaultContent: '{"productId":"","autoBindTo":"product.description"}',                                                                                                                       labelKey: 'Product description',  descriptionKey: 'Rich body, auto-bound to the product\'s stored description (overridable).',     category: 'content'},
    {key: EItemType.Pagination,        Editor: PaginationEditor,        styleEnum: asEnum(EPaginationStyle), styleLabels: PAGINATION_STYLE_LABELS,        defaultContent: '{"variant":"load-more","pageSize":24}',                                                                                                                                       labelKey: 'Pagination',           descriptionKey: 'Cursor-based — load-more button or infinite-scroll.',                          category: 'cta'},
    {key: EItemType.Breadcrumb,        Editor: BreadcrumbEditor,        styleEnum: asEnum(EBreadcrumbStyle), styleLabels: BREADCRUMB_STYLE_LABELS,        defaultContent: '{"autoFromParentChain":true,"separator":"\\u203a"}',                                                                                                                            labelKey: 'Breadcrumb',           descriptionKey: 'Auto-walks the page parent chain — N-deep, no depth cap.',                     category: 'content'},
    // Phase 1.F — product-display-templates: 4 modules consumed by the
    // 5 built-in IProductTemplate seeds + operator-created customs.
    {key: EItemType.LargeGallery,      Editor: LargeGalleryEditor,      styleEnum: asEnum({Default: 'default'}),    defaultContent: '{"title":"","images":[]}',                                                                                                                                                  labelKey: 'Large gallery',        descriptionKey: 'Image-led full-bleed gallery; mobile carousel. Premium / Lookbook templates.', category: 'media'},
    {key: EItemType.SubProductsGrid,   Editor: SubProductsGridEditor,   styleEnum: asEnum({Default: 'default'}),    defaultContent: '{"title":"Bundle contents","limit":8}',                                                                                                                                     labelKey: 'Sub-products grid',    descriptionKey: 'Sibling products under a parent. For Bundle templates.',                       category: 'content'},
    {key: EItemType.DownloadablePdf,   Editor: DownloadablePdfEditor,   styleEnum: asEnum({Default: 'default'}),    defaultContent: '{"label":"Download spec sheet (PDF)"}',                                                                                                                                     labelKey: 'Downloadable PDF',     descriptionKey: 'Auto-renders the product spec sheet as a PDF download link.',                  category: 'cta'},
    {key: EItemType.WarrantyInfo,      Editor: WarrantyInfoEditor,      styleEnum: asEnum({Default: 'default'}),    defaultContent: '{"title":"Warranty"}',                                                                                                                                                      labelKey: 'Warranty info',        descriptionKey: 'Warranty terms — auto-binds to product.attributes.warrantyYears / warrantyTerms.', category: 'content'},
    // Phase 1.D — checkout-as-composable-page (12 locked + 6 composable).
    {key: EItemType.CartLineItems,            Editor: CartLineItemsEditor,            styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Cart line items',          descriptionKey: 'Locked — live cart contents with qty controls.',                                category: 'content'},
    {key: EItemType.CartSummary,              Editor: CartSummaryEditor,              styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Cart summary',             descriptionKey: 'Locked — subtotal / VAT / shipping / total.',                                  category: 'content'},
    {key: EItemType.CartActions,              Editor: CartActionsEditor,              styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Cart actions',             descriptionKey: 'Locked — Clear cart + Proceed to checkout CTAs.',                              category: 'cta'},
    {key: EItemType.CheckoutProgressBar,      Editor: CheckoutProgressBarEditor,      styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Checkout progress bar',    descriptionKey: 'Locked — address → shipping → payment indicator.',                             category: 'content'},
    {key: EItemType.CheckoutAddressForm,      Editor: CheckoutAddressFormEditor,      styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Address form',            descriptionKey: 'Locked — captures shipping address + guest email.',                            category: 'content'},
    {key: EItemType.CheckoutShippingMethod,   Editor: CheckoutShippingMethodEditor,   styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Shipping method',         descriptionKey: 'Locked — picks the carrier + service level.',                                  category: 'content'},
    {key: EItemType.CheckoutPaymentForm,      Editor: CheckoutPaymentFormEditor,      styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Payment form',           descriptionKey: 'Locked — card capture (PCI-safe iframe).',                                     category: 'content'},
    {key: EItemType.CheckoutCartSummary,      Editor: CheckoutCartSummaryEditor,      styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Checkout cart summary',  descriptionKey: 'Locked — read-only mini cart on each checkout step.',                          category: 'content'},
    {key: EItemType.PlaceOrderButton,         Editor: PlaceOrderButtonEditor,         styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Place order button',     descriptionKey: 'Locked — final submit; auth → capture → confirmation.',                        category: 'cta'},
    {key: EItemType.OrderSummary,             Editor: OrderSummaryEditor,             styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Order summary',          descriptionKey: 'Locked — confirmation / order-by-token main block.',                           category: 'content'},
    {key: EItemType.MagicLinkAccountUpgrade,  Editor: MagicLinkAccountUpgradeEditor,  styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Magic-link upgrade',     descriptionKey: 'Locked — converts guest order into customer account.',                         category: 'cta'},
    {key: EItemType.AccountWelcome,           Editor: AccountWelcomeEditor,           styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Account welcome',        descriptionKey: 'Locked — dashboard greeting + quick links.',                                   category: 'hero'},
    {key: EItemType.ShippingCalculator,       Editor: ShippingCalculatorEditor,       styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Shipping calculator',    descriptionKey: 'Composable — estimate shipping cost by postcode.',                             category: 'content'},
    {key: EItemType.DownloadInvoiceButton,    Editor: DownloadInvoiceButtonEditor,    styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Download invoice',       descriptionKey: 'Composable — direct VAT-invoice download link.',                               category: 'cta'},
    {key: EItemType.TrustBadges,              Editor: TrustBadgesEditor,              styleEnum: asEnum(ETrustBadgesStyle), styleLabels: TRUST_BADGES_STYLE_LABELS, defaultContent: '{}', labelKey: 'Trust badges',           descriptionKey: 'Composable — row of payment / security badges.',                               category: 'content'},
    {key: EItemType.MoneyBackGuarantee,       Editor: MoneyBackGuaranteeEditor,       styleEnum: asEnum(EMoneyBackGuaranteeStyle), styleLabels: MONEY_BACK_GUARANTEE_STYLE_LABELS, defaultContent: '{}', labelKey: 'Money-back guarantee',   descriptionKey: 'Composable — refund policy callout.',                                          category: 'content'},
    {key: EItemType.ReferAFriendCta,          Editor: ReferAFriendCtaEditor,          styleEnum: asEnum(EReferAFriendCtaStyle), styleLabels: REFER_A_FRIEND_CTA_STYLE_LABELS, defaultContent: '{}', labelKey: 'Refer a friend',         descriptionKey: 'Composable — invite block on confirmation.',                                   category: 'cta'},
    {key: EItemType.SocialShareButtons,       Editor: SocialShareButtonsEditor,       styleEnum: asEnum(ESocialShareButtonsStyle), styleLabels: SOCIAL_SHARE_BUTTONS_STYLE_LABELS, defaultContent: '{}', labelKey: 'Social share buttons',   descriptionKey: 'Composable — share-this-order links.',                                         category: 'cta'},
    // all-pages-module-composed — Account batch (smart wrappers; copy-only editors).
    {key: EItemType.OrdersList,               Editor: OrdersListEditor,               styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Orders list',            descriptionKey: 'Locked — customer order history with status filter chips.',                    category: 'content'},
    {key: EItemType.OrderDetail,              Editor: OrderDetailEditor,              styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Order detail',           descriptionKey: 'Locked — single order: progress, line items, payment, history.',              category: 'content'},
    {key: EItemType.AddressList,              Editor: AddressListEditor,              styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Address book',           descriptionKey: 'Locked — saved shipping addresses with add / edit / delete.',                  category: 'content'},
    {key: EItemType.NotificationInbox,        Editor: NotificationInboxEditor,        styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Notification inbox',      descriptionKey: 'Locked — in-app notifications with mark-read + dismiss.',                      category: 'content'},
    {key: EItemType.AccountDashboardGrid,     Editor: AccountDashboardGridEditor,     styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Account dashboard',      descriptionKey: 'Locked — /account home entry-points grid (orders / addresses / settings).',   category: 'content'},
    {key: EItemType.AccountProfileForm,       Editor: AccountProfileFormEditor,       styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Account profile + password', descriptionKey: 'Locked — personal-details + password change form pair for /account/profile.', category: 'content'},
    {key: EItemType.AccountSettingsLayout,    Editor: AccountSettingsLayoutEditor,    styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Account settings layout', descriptionKey: 'Locked — tabbed customer settings (profile / security / notifications / privacy / language) for /account/settings.', category: 'content'},
    // all-pages-module-composed — Auth batch (smart wrappers; copy-only editors).
    {key: EItemType.SigninForm,               Editor: SigninFormEditor,               styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Sign-in form',           descriptionKey: 'Locked — customer sign-in: password / magic-link / OAuth per site flags.',    category: 'cta'},
    {key: EItemType.SignupForm,               Editor: SignupFormEditor,               styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Sign-up form',           descriptionKey: 'Locked — customer sign-up with optional B2B (company + VAT) capture.',         category: 'cta'},
    {key: EItemType.MagicLinkRequestForm,     Editor: MagicLinkRequestFormEditor,     styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Magic-link request',     descriptionKey: 'Locked — passwordless sign-in: emails a one-click link.',                     category: 'cta'},
    {key: EItemType.CustomerVerifyConfirm,    Editor: CustomerVerifyConfirmEditor,    styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Magic-link confirm',     descriptionKey: 'Locked — magic-link click-to-confirm for /account/verify.',                   category: 'cta'},
    // all-pages-module-composed — Blog batch.
    {key: EItemType.BlogPost,                 Editor: BlogPostEditor,                 styleEnum: asEnum(EBlogPostStyle), styleLabels: BLOG_POST_STYLE_LABELS, defaultContent: '{}', labelKey: 'Blog post',              descriptionKey: 'Locked — single post body: title, cover, sanitised HTML, author, date, tags.', category: 'content'},
    // all-pages-module-composed — Marketing batch.
    {key: EItemType.FeatureGrid,              Editor: FeatureGridEditor,              styleEnum: asEnum(EFeatureGridStyle), styleLabels: FEATURE_GRID_STYLE_LABELS, defaultContent: '{"features":[]}',       labelKey: 'Feature grid',          descriptionKey: 'Marketing — 2/3-column feature cards (title + description).',                 category: 'content'},
    {key: EItemType.LogoCloud,                Editor: LogoCloudEditor,                styleEnum: asEnum(ELogoCloudStyle), styleLabels: LOGO_CLOUD_STYLE_LABELS, defaultContent: '{"logos":[]}',          labelKey: 'Logo cloud',            descriptionKey: 'Marketing — "trusted by" row of customer logos.',                            category: 'media'},
    {key: EItemType.PricingTable,             Editor: PricingTableEditor,             styleEnum: asEnum(EPricingTableStyle), styleLabels: PRICING_TABLE_STYLE_LABELS, defaultContent: '{"tiers":[],"features":[]}', labelKey: 'Pricing table',     descriptionKey: 'Marketing — tier columns + feature matrix with monthly/annual toggle.',       category: 'content'},
    {key: EItemType.TestimonialWall,          Editor: TestimonialWallEditor,          styleEnum: asEnum({Default: 'default'}), defaultContent: '{"items":[]}',          labelKey: 'Testimonial wall',      descriptionKey: 'Marketing — multi-column quote cards with author + company.',                 category: 'content'},
    // all-pages-module-composed — Cars batch.
    {key: EItemType.CarsList,                 Editor: CarsListEditor,                 styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Cars list',              descriptionKey: 'Locked — faceted car listing (make / model / fuel / gearbox / year / price).',category: 'content'},
    {key: EItemType.CarDetail,                Editor: CarDetailEditor,                styleEnum: asEnum({Default: 'default'}), defaultContent: '{}', labelKey: 'Car detail',             descriptionKey: 'Locked — single car: gallery, spec table, VAT badge, reservation CTA.',       category: 'content'},
];
