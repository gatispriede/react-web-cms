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
import SectionHeading from '@client/modules/SectionHeading';
import KeyValueDossier from '@client/modules/KeyValueDossier';
import Product from '@client/modules/Product';
import ProductDetailHero from '@client/modules/ProductDetailHero';
import ProductSpecTable from '@client/modules/ProductSpecTable';
import ProductDescription from '@client/modules/ProductDescription';
import Pagination from '@client/modules/Pagination';
import Breadcrumb from '@client/modules/Breadcrumb';
import LargeGallery from '@client/modules/LargeGallery';
import SubProductsGrid from '@client/modules/SubProductsGrid';
import DownloadablePdf from '@client/modules/DownloadablePdf';
import WarrantyInfo from '@client/modules/WarrantyInfo';
// Phase 1.D — checkout-as-composable-page (18 modules: 12 locked + 6 composable).
import CartLineItems from '@client/modules/Checkout/CartLineItems';
import CartSummary from '@client/modules/Checkout/CartSummary';
import CartActions from '@client/modules/Checkout/CartActions';
import CheckoutProgressBar from '@client/modules/Checkout/CheckoutProgressBar';
import CheckoutAddressForm from '@client/modules/Checkout/CheckoutAddressForm';
import CheckoutShippingMethod from '@client/modules/Checkout/CheckoutShippingMethod';
import CheckoutPaymentForm from '@client/modules/Checkout/CheckoutPaymentForm';
import CheckoutCartSummary from '@client/modules/Checkout/CheckoutCartSummary';
import PlaceOrderButton from '@client/modules/Checkout/PlaceOrderButton';
import OrderSummary from '@client/modules/Checkout/OrderSummary';
import MagicLinkAccountUpgrade from '@client/modules/Checkout/MagicLinkAccountUpgrade';
import AccountWelcome from '@client/modules/Checkout/AccountWelcome';
import ShippingCalculator from '@client/modules/Checkout/ShippingCalculator';
import DownloadInvoiceButton from '@client/modules/Checkout/DownloadInvoiceButton';
import TrustBadges from '@client/modules/Trust/TrustBadges';
import MoneyBackGuarantee from '@client/modules/Trust/MoneyBackGuarantee';
import ReferAFriendCta from '@client/modules/Marketing/ReferAFriendCta';
import SocialShareButtons from '@client/modules/Marketing/SocialShareButtons';
// all-pages-module-composed — Account batch smart wrappers.
import {
    OrdersListHost,
    OrderDetailHost,
    AddressListHost,
    NotificationInboxHost,
    AccountDashboardGridHost,
    AccountProfileFormHost,
} from '@client/modules/_AccountPageModules/wrappers';
// all-pages-module-composed — Auth batch smart wrappers.
import {
    SigninFormHost,
    SignupFormHost,
    MagicLinkRequestFormHost,
    CustomerVerifyConfirmHost,
} from '@client/modules/_AccountPageModules/authWrappers';
// all-pages-module-composed — Blog batch smart wrapper.
import {BlogPostHost} from '@client/modules/_BlogPageModules/wrappers';
// all-pages-module-composed — Marketing batch content-parser wrappers.
import {
    FeatureGridHost,
    LogoCloudHost,
    PricingTableHost,
    TestimonialWallHost,
} from '@client/modules/_MarketingPageModules/wrappers';
// all-pages-module-composed — Cars batch smart wrappers.
import {CarsListHost, CarDetailHost} from '@client/modules/_CarsPageModules/wrappers';

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
    {key: EItemType.SectionHeading, Display: SectionHeading},
    {key: EItemType.KeyValueDossier, Display: KeyValueDossier},
    {key: EItemType.Product, Display: Product},
    // Phase 1.C — products-as-composable-page sub-jump B.
    {key: EItemType.ProductDetailHero, Display: ProductDetailHero},
    {key: EItemType.ProductSpecTable, Display: ProductSpecTable},
    {key: EItemType.ProductDescription, Display: ProductDescription},
    {key: EItemType.Pagination, Display: Pagination},
    {key: EItemType.Breadcrumb, Display: Breadcrumb},
    // Phase 1.F — product-display-templates: 4 new modules consumed by
    // the 5 built-in `IProductTemplate` seeds + operator-created custom
    // templates.
    {key: EItemType.LargeGallery, Display: LargeGallery},
    {key: EItemType.SubProductsGrid, Display: SubProductsGrid},
    {key: EItemType.DownloadablePdf, Display: DownloadablePdf},
    {key: EItemType.WarrantyInfo, Display: WarrantyInfo},
    // Phase 1.D — checkout-as-composable-page.
    {key: EItemType.CartLineItems, Display: CartLineItems as never},
    {key: EItemType.CartSummary, Display: CartSummary as never},
    {key: EItemType.CartActions, Display: CartActions as never},
    {key: EItemType.CheckoutProgressBar, Display: CheckoutProgressBar as never},
    {key: EItemType.CheckoutAddressForm, Display: CheckoutAddressForm as never},
    {key: EItemType.CheckoutShippingMethod, Display: CheckoutShippingMethod as never},
    {key: EItemType.CheckoutPaymentForm, Display: CheckoutPaymentForm as never},
    {key: EItemType.CheckoutCartSummary, Display: CheckoutCartSummary as never},
    {key: EItemType.PlaceOrderButton, Display: PlaceOrderButton as never},
    {key: EItemType.OrderSummary, Display: OrderSummary as never},
    {key: EItemType.MagicLinkAccountUpgrade, Display: MagicLinkAccountUpgrade as never},
    {key: EItemType.AccountWelcome, Display: AccountWelcome as never},
    {key: EItemType.ShippingCalculator, Display: ShippingCalculator as never},
    {key: EItemType.DownloadInvoiceButton, Display: DownloadInvoiceButton as never},
    {key: EItemType.TrustBadges, Display: TrustBadges as never},
    {key: EItemType.MoneyBackGuarantee, Display: MoneyBackGuarantee as never},
    {key: EItemType.ReferAFriendCta, Display: ReferAFriendCta as never},
    {key: EItemType.SocialShareButtons, Display: SocialShareButtons as never},
    // all-pages-module-composed — Account batch.
    {key: EItemType.OrdersList, Display: OrdersListHost as never},
    {key: EItemType.OrderDetail, Display: OrderDetailHost as never},
    {key: EItemType.AddressList, Display: AddressListHost as never},
    {key: EItemType.NotificationInbox, Display: NotificationInboxHost as never},
    {key: EItemType.AccountDashboardGrid, Display: AccountDashboardGridHost as never},
    {key: EItemType.AccountProfileForm, Display: AccountProfileFormHost as never},
    // all-pages-module-composed — Auth batch.
    {key: EItemType.SigninForm, Display: SigninFormHost as never},
    {key: EItemType.SignupForm, Display: SignupFormHost as never},
    {key: EItemType.MagicLinkRequestForm, Display: MagicLinkRequestFormHost as never},
    {key: EItemType.CustomerVerifyConfirm, Display: CustomerVerifyConfirmHost as never},
    // all-pages-module-composed — Blog batch.
    {key: EItemType.BlogPost, Display: BlogPostHost as never},
    // all-pages-module-composed — Marketing batch.
    {key: EItemType.FeatureGrid, Display: FeatureGridHost as never},
    {key: EItemType.LogoCloud, Display: LogoCloudHost as never},
    {key: EItemType.PricingTable, Display: PricingTableHost as never},
    {key: EItemType.TestimonialWall, Display: TestimonialWallHost as never},
    // all-pages-module-composed — Cars batch.
    {key: EItemType.CarsList, Display: CarsListHost as never},
    {key: EItemType.CarDetail, Display: CarDetailHost as never},
];
