export enum EItemType {
    Text = "TEXT",
    RichText = "RICH_TEXT",
    Image = "IMAGE",
    Carousel = "CAROUSEL",
    Gallery = "GALLERY",
    Hero = "HERO",
    ProjectCard = "PROJECT_CARD",
    SkillPills = "SKILL_PILLS",
    Timeline = "TIMELINE",
    SocialLinks = "SOCIAL_LINKS",
    BlogFeed = "BLOG_FEED",
    List = "LIST",
    Services = "SERVICES",
    Testimonials = "TESTIMONIALS",
    StatsCard = "STATS_CARD",
    ProjectGrid = "PROJECT_GRID",
    Manifesto = "MANIFESTO",
    InquiryForm = "INQUIRY_FORM",
    DataModel = "DATA_MODEL",
    InfraTopology = "INFRA_TOPOLOGY",
    PipelineFlow = "PIPELINE_FLOW",
    RepoTree = "REPO_TREE",
    ArchitectureTiers = "ARCHITECTURE_TIERS",
    StatsStrip = "STATS_STRIP",
    /** Product module — mode-dispatched (featured/grid/carousel/comparison/related).
     *  See ui/client/modules/Product/ for the renderer + ui/admin/modules/Product/
     *  for the editor. Added by Phase 1.B (product-module-and-checkout-customization).
     *  Catalogue-only when `commerce.checkoutEnabled === false` — Buy CTAs early-return null. */
    Product = "PRODUCT",
    /** Leaf-product hero — image gallery + title + price + Buy CTA + VAT
     *  badge. Auto-injected by `ProductDetailTemplate` on warehouse-derived
     *  leaf pages; renders standalone too if an operator drops it.
     *  Phase 1.C (products-as-composable-page). */
    ProductDetailHero = "PRODUCT_DETAIL_HERO",
    /** Two-column key/value spec table generated from `IProduct.attributes`.
     *  Auto-injected by `ProductDetailTemplate`. Phase 1.C. */
    ProductSpecTable = "PRODUCT_SPEC_TABLE",
    /** RichText specialisation that auto-binds to `product.description` via
     *  `ProductContext`. Operators can override the body. Phase 1.C. */
    ProductDescription = "PRODUCT_DESCRIPTION",
    /** Cursor-based pagination control — Load-more button or infinite-scroll
     *  variant (predefined Select). Auto-injected after a `ProductGrid` on
     *  warehouse-derived category pages. Phase 1.C. */
    Pagination = "PAGINATION",
    /** Breadcrumb trail — walks the parent chain N-deep and renders crumbs.
     *  Auto-injected near the top of warehouse-derived category pages so
     *  visitors can step up the tree. Phase 1.C. */
    Breadcrumb = "BREADCRUMB",
    /** Locked hero on the `/account/settings` system page — renders
     *  "Settings for {name}" header + breadcrumb. Phase 1.E
     *  (client-account-settings-page). */
    AccountSettingsHero = "ACCOUNT_SETTINGS_HERO",
    /** Locked tab bar on the `/account/settings` system page —
     *  Profile / Security / Addresses / Payment / Notifications /
     *  Privacy / Language. Phase 1.E. */
    AccountSettingsNav = "ACCOUNT_SETTINGS_NAV",
    /** Locked form dispatcher on the `/account/settings` system
     *  page — renders the active tab's form per `?tab=`. Phase 1.E. */
    AccountSettingsForm = "ACCOUNT_SETTINGS_FORM",
    /** Image-led full-bleed gallery — `Lookbook` / `Premium` templates.
     *  Mobile fallback: horizontal carousel. Phase 1.F
     *  (product-display-templates). */
    LargeGallery = "LARGE_GALLERY",
    /** Sibling-products grid under a parent product — `Bundle` template.
     *  Pulls siblings via `product.attributes.parentSku`. Phase 1.F. */
    SubProductsGrid = "SUB_PRODUCTS_GRID",
    /** Auto-rendered product spec sheet as a downloadable PDF link.
     *  Reuses W8g VAT-compliant invoice rendering primitives when
     *  available; falls back to a TODO stub link otherwise. Phase 1.F. */
    DownloadablePdf = "DOWNLOADABLE_PDF",
    /** Warranty terms block — for B2B + new-cars verticals. Phase 1.F. */
    WarrantyInfo = "WARRANTY_INFO",
    // Phase 1.D — checkout-as-composable-page. 12 locked transactional modules.
    CartLineItems = "CART_LINE_ITEMS",
    CartSummary = "CART_SUMMARY",
    CartActions = "CART_ACTIONS",
    CheckoutProgressBar = "CHECKOUT_PROGRESS_BAR",
    CheckoutAddressForm = "CHECKOUT_ADDRESS_FORM",
    CheckoutShippingMethod = "CHECKOUT_SHIPPING_METHOD",
    CheckoutPaymentForm = "CHECKOUT_PAYMENT_FORM",
    CheckoutCartSummary = "CHECKOUT_CART_SUMMARY",
    PlaceOrderButton = "PLACE_ORDER_BUTTON",
    OrderSummary = "ORDER_SUMMARY",
    MagicLinkAccountUpgrade = "MAGIC_LINK_ACCOUNT_UPGRADE",
    AccountWelcome = "ACCOUNT_WELCOME",
    // Phase 1.D — 6 operator-composable modules.
    TrustBadges = "TRUST_BADGES",
    MoneyBackGuarantee = "MONEY_BACK_GUARANTEE",
    ShippingCalculator = "SHIPPING_CALCULATOR",
    DownloadInvoiceButton = "DOWNLOAD_INVOICE_BUTTON",
    ReferAFriendCta = "REFER_A_FRIEND_CTA",
    SocialShareButtons = "SOCIAL_SHARE_BUTTONS",
    // all-pages-module-composed — Account batch. Smart-wrapper modules
    // (`ui/client/modules/_AccountPageModules/`) bind the pure
    // presentational OrdersList / OrderDetailModule / AddressList /
    // NotificationInbox modules to the customer GraphQL surface so the
    // `/account/*` routes render through SystemPageDispatch.
    OrdersList = "ORDERS_LIST",
    OrderDetail = "ORDER_DETAIL",
    AddressList = "ADDRESS_LIST",
    NotificationInbox = "NOTIFICATION_INBOX",
    // all-pages-module-composed — Auth batch. Smart-wrapper modules for
    // the `/account/signin` `/account/signup` `/account/magic-link`
    // routes — bind the pure SigninForm / SignupForm /
    // MagicLinkRequestForm modules to NextAuth + the customer GraphQL
    // surface, reading provider config from `/api/site/auth-flags`.
    SigninForm = "SIGNIN_FORM",
    SignupForm = "SIGNUP_FORM",
    MagicLinkRequestForm = "MAGIC_LINK_REQUEST_FORM",
    // all-pages-module-composed — Blog batch. `BlogPost` is the
    // single-post body module (title + cover + sanitised HTML + meta);
    // its smart wrapper reads the `[slug]` route param and fetches via
    // `PostApi.getBySlug`. `/blog` reuses the existing `BlogFeed` module.
    BlogPost = "BLOG_POST",
    // all-pages-module-composed — Marketing batch. Four pure
    // presentational modules wired for the `/welcome` landing page;
    // their content-parser wrappers in `_MarketingPageModules/` read
    // the operator-authored arrays straight out of `item.content`.
    FeatureGrid = "FEATURE_GRID",
    LogoCloud = "LOGO_CLOUD",
    PricingTable = "PRICING_TABLE",
    TestimonialWall = "TESTIMONIAL_WALL",
    Empty = 'EMPTY',
}
export default EItemType