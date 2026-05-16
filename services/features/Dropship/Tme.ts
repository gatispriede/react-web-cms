/**
 * `TmeAdapter` — second concrete `IDropshipDistributorAdapter`. Lower-
 * friction signup than TD SYNNEX, so this is the adapter most likely
 * to get credentialed first.
 *
 * Spec: docs/roadmap/storefront/pc-parts-dropshipping-integration.md
 * Distributor: TME (Transfer Multisort Elektronik) — Łódź, PL.
 *              Pan-EU coverage, 30 language sites, ~1M+ SKUs across
 *              electronic components, motors, sensors, MCUs, batteries,
 *              connectors, enclosures, robotics, AI dev hardware.
 *
 * Why TME first instead of TD SYNNEX (per the 2026-05-16 EU
 * distributor research): TME exposes a free public REST API + GitHub
 * SDKs (https://developers.tme.eu/en, https://github.com/tme-dev),
 * has self-service developer signup, and a B2B trade account is
 * lightweight (VAT + business reg, days not weeks). TD SYNNEX requires
 * a 2-4 week onboarding gauntlet + volume commitments that exclude
 * indie operators. TME also carries the maker / robotics / AI-edge
 * SKUs (RPi, Jetson dev kits, sensors, motor drivers) that broaden
 * the storefront beyond PC parts.
 *
 * STATUS — SCAFFOLD ONLY.
 *
 * Every method throws `TmeNotCredentialedError`. The operator
 * registers at https://developers.tme.eu/en/signup, receives a
 * `TME_TOKEN` (anonymous, identifies the integration) + a
 * `TME_APP_SECRET` (signing key), and pastes both into `.env`. Once
 * `isConfigured()` returns true the follow-up commit replaces each
 * throw with a real HTTPS call.
 *
 * Auth scheme (per TME docs):
 *  - Every request is POST application/x-www-form-urlencoded
 *  - Required params: `Token` + `ApiSignature`
 *  - `ApiSignature` = base64(HMAC-SHA1(httpMethod + '&' + urlEncode(endpoint) + '&' + urlEncode(sortedParams), appSecret))
 *  - Language + Country params control localised output (PL, EN, DE,
 *    etc. — pick per storefront locale)
 *
 * Endpoint surface mapped to IDropshipDistributorAdapter:
 *  - `fetchProducts`         → Products/GetProductsList + Products/GetProducts (chained)
 *  - `fetchProductsSince`    → Products/GetProductsList with `UpdatedSince`
 *  - `placeOrder`            → Orders/Create (B2B account required;
 *                               anonymous-token accounts can only read)
 *  - `getOrderStatus`        → Orders/GetOrderStatus
 *  - `getReturnPolicy`       → not exposed via API today — fall back to
 *                               TME's static returns policy (28 days)
 *  - `quoteWholesale`        → Products/GetPrices
 *  - `healthCheck`           → Utilities/GetCountries (cheap, no auth weight)
 *  - `getCategoryHierarchy`  → Products/GetCategories (cached;
 *                               returns a deep tree)
 */
import type {
    IDropshipDistributorAdapter,
    PlaceDropshipOrderInput,
    PlaceDropshipOrderResult,
    DropshipOrderStatus,
    DropshipReturnPolicy,
    WholesaleQuoteInput,
    WholesaleQuote,
} from './IDropshipDistributorAdapter';
import type {FetchPage, HealthResult} from '@interfaces/IInventory';

/**
 * TME API production base. Anonymous-token endpoints + signed
 * B2B endpoints share the host; auth tier is decided per call by
 * whether the operator's TME account has B2B order-write privileges.
 */
export const TME_API_BASE = 'https://api.tme.eu';

/**
 * Config shape locked in ahead of credentials. Maps 1:1 with the env
 * vars in spec §"Environment variables — TME":
 *
 *   TME_API_BASE     → baseUrl
 *   TME_TOKEN        → token       (identifies the integration; anonymous-tier OK)
 *   TME_APP_SECRET   → appSecret   (signing key; required for write-side)
 *   TME_COUNTRY      → country     (e.g. 'LV', 'PL', 'DE' — defaults to LV)
 *   TME_LANGUAGE     → language    (e.g. 'EN', 'PL', 'DE' — defaults to EN)
 */
export interface TmeConfig {
    baseUrl: string;
    /** Identifies the integration. Public-side calls work with token only. */
    token: string;
    /** HMAC-SHA1 signing key — required for signed (B2B / write) calls. */
    appSecret: string;
    /** Default ISO-3166-1 alpha-2 country code; price/stock are localised. */
    country: string;
    /** Default UI language for product descriptions / categories. */
    language: string;
}

/**
 * Thrown by every method while the adapter is in scaffold state. The
 * admin pane should catch + surface this in `DropshipAdapterStatusPanel`
 * rather than re-throwing into the customer's checkout flow.
 */
export class TmeNotCredentialedError extends Error {
    public readonly code = 'TME_NOT_CREDENTIALED' as const;
    constructor(method: string) {
        super(
            `TME adapter not yet credentialed. Method '${method}' is unavailable until ` +
            `TME_TOKEN + TME_APP_SECRET are set in .env. Register at ` +
            `https://developers.tme.eu/en/signup, then see ` +
            `docs/roadmap/storefront/pc-parts-dropshipping-integration.md §"Operator post-merge ops".`,
        );
        this.name = 'TmeNotCredentialedError';
    }
}

export class TmeAdapter implements IDropshipDistributorAdapter {
    public readonly id = 'tme';
    private readonly config: TmeConfig;

    constructor(config: Partial<TmeConfig> = {}) {
        this.config = {
            baseUrl: config.baseUrl ?? TME_API_BASE,
            token: config.token ?? '',
            appSecret: config.appSecret ?? '',
            country: config.country ?? 'LV',
            language: config.language ?? 'EN',
        };
    }

    public isConfigured(): boolean {
        // Read-side (catalogue browsing) works with token alone — appSecret
        // is only required for B2B-signed endpoints (order placement,
        // price/stock for B2B-priced SKUs). For the dropship pipeline we
        // need both, so the configured check requires both.
        return Boolean(this.config.token && this.config.appSecret);
    }

    // --- IWarehouseAdapter (read-side) -----------------------------

    public fetchProducts(_cursor?: string): Promise<FetchPage> {
        throw new TmeNotCredentialedError('fetchProducts');
    }

    public fetchProductsSince(_since: string, _cursor?: string): Promise<FetchPage> {
        throw new TmeNotCredentialedError('fetchProductsSince');
    }

    public healthCheck(): Promise<HealthResult> {
        throw new TmeNotCredentialedError('healthCheck');
    }

    public getCategoryHierarchy(): readonly string[] {
        // Locked in ahead of impl. TME categorises into category →
        // subcategory → series; brand is a separate facet, not a path
        // level. Adapter normalises into the same 3-level shape the
        // storefront expects (spec §"Storefront surface").
        return ['category', 'subcategory', 'series'];
    }

    // --- IDropshipDistributorAdapter (write-side) ------------------

    public placeOrder(_input: PlaceDropshipOrderInput): Promise<PlaceDropshipOrderResult> {
        throw new TmeNotCredentialedError('placeOrder');
    }

    public getOrderStatus(_distributorOrderRef: string): Promise<DropshipOrderStatus> {
        throw new TmeNotCredentialedError('getOrderStatus');
    }

    public getReturnPolicy(_productId: string): Promise<DropshipReturnPolicy> {
        // TME's return policy is uniform per their B2B terms (28 days,
        // unopened, RMA-issued) and not exposed per-SKU through the
        // API. The real impl will return the static policy lifted into
        // `DropshipReturnPolicy` shape; for now, mirror TD SYNNEX and
        // throw so the call site is forced to handle the not-credentialed
        // signal consistently across adapters.
        throw new TmeNotCredentialedError('getReturnPolicy');
    }

    public quoteWholesale(_input: WholesaleQuoteInput): Promise<WholesaleQuote> {
        throw new TmeNotCredentialedError('quoteWholesale');
    }
}
