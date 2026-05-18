/**
 * `TdSynnexStreamOneAdapter` — first concrete `IDropshipDistributorAdapter`.
 *
 * Spec: docs/roadmap/storefront/pc-parts-dropshipping-integration.md
 * Distributor: TD SYNNEX StreamOne Ion (pan-EU + UK; largest reach;
 *              recommended first integration per spec §"Distributor choice").
 *
 * STATUS — SCAFFOLD ONLY.
 *
 * Every method throws `TdSynnexNotCredentialedError`. The operator
 * has not yet acquired a TD SYNNEX partner account (1-2 week
 * onboarding wall-clock per spec §"Operator post-merge ops"), so
 * the adapter has no credentials to authenticate against the
 * StreamOne API. This file exists to:
 *
 *   1. Lock in the constructor + config shape so env-var wiring
 *      can land in `.env.example` + adapter factory ahead of time.
 *   2. Surface a clear, actionable error if any code path
 *      accidentally invokes a dropship method while the feature
 *      flag is on but creds are missing.
 *   3. Give the follow-up "fill in the real calls" commit a single
 *      file to touch — every method body is a 1-line throw that
 *      gets replaced with a real fetch.
 *
 * Once the operator has credentials, the next commit replaces each
 * throw with a real HTTPS call against `STREAMONE_API_BASE`,
 * normalises StreamOne's response shapes into the
 * `IDropshipDistributorAdapter` types, and removes this banner.
 *
 * Reference: StreamOne developer docs at
 *   https://developers.streamonecloud.com
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
 * StreamOne Ion production API base. The sandbox lives at a
 * separate hostname which the operator wires via env override
 * during the partner-onboarding smoke-test phase (spec §"Operator
 * post-merge ops" step 4).
 */
export const TD_SYNNEX_STREAMONE_API_BASE = 'https://api.streamonecloud.com';

/**
 * Config shape locked in ahead of credentials. Maps 1:1 with the
 * env vars in spec §"Environment variables":
 *
 *   TD_SYNNEX_API_BASE       → baseUrl
 *   TD_SYNNEX_CLIENT_ID      → clientId
 *   TD_SYNNEX_CLIENT_SECRET  → clientSecret
 *   TD_SYNNEX_RESELLER_ID    → resellerId  (operator's partner code)
 */
export interface TdSynnexStreamOneConfig {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    /** Operator's partner / reseller code, assigned by TD SYNNEX. */
    resellerId: string;
}

/**
 * Thrown by every method while the adapter is in scaffold state.
 * The admin pane should catch + surface this in
 * `DropshipAdapterStatusPanel` rather than re-throwing into the
 * customer's checkout flow.
 */
export class TdSynnexNotCredentialedError extends Error {
    public readonly code = 'TD_SYNNEX_NOT_CREDENTIALED' as const;
    constructor(method: string) {
        super(
            `TD SYNNEX StreamOne adapter not yet credentialed — pending operator partner account. ` +
            `Method '${method}' is unavailable until a TD SYNNEX reseller agreement is signed + ` +
            `TD_SYNNEX_CLIENT_ID / TD_SYNNEX_CLIENT_SECRET / TD_SYNNEX_RESELLER_ID are set in .env. ` +
            `See docs/roadmap/storefront/pc-parts-dropshipping-integration.md §"Operator post-merge ops".`,
        );
        this.name = 'TdSynnexNotCredentialedError';
    }
}

export class TdSynnexStreamOneAdapter implements IDropshipDistributorAdapter {
    public readonly id = 'td-synnex-stream-one';
    private readonly config: TdSynnexStreamOneConfig;

    constructor(config: Partial<TdSynnexStreamOneConfig> = {}) {
        this.config = {
            baseUrl: config.baseUrl ?? TD_SYNNEX_STREAMONE_API_BASE,
            clientId: config.clientId ?? '',
            clientSecret: config.clientSecret ?? '',
            resellerId: config.resellerId ?? '',
        };
    }

    public isConfigured(): boolean {
        // All three credential fields must be non-empty before the
        // adapter is even worth invoking. Real wire-up commit will
        // also attempt a token-mint round-trip on first call.
        return Boolean(
            this.config.clientId &&
            this.config.clientSecret &&
            this.config.resellerId,
        );
    }

    // --- IWarehouseAdapter (read-side) -----------------------------

    public fetchProducts(_cursor?: string): Promise<FetchPage> {
        throw new TdSynnexNotCredentialedError('fetchProducts');
    }

    public fetchProductsSince(_since: string, _cursor?: string): Promise<FetchPage> {
        throw new TdSynnexNotCredentialedError('fetchProductsSince');
    }

    public healthCheck(): Promise<HealthResult> {
        throw new TdSynnexNotCredentialedError('healthCheck');
    }

    public getCategoryHierarchy(): readonly string[] {
        // Locked in ahead of impl — PC-parts catalogue buckets by
        // category → subcategory → brand (spec §"Storefront surface").
        return ['category', 'subcategory', 'brand'];
    }

    // --- IDropshipDistributorAdapter (write-side) ------------------

    public placeOrder(_input: PlaceDropshipOrderInput): Promise<PlaceDropshipOrderResult> {
        throw new TdSynnexNotCredentialedError('placeOrder');
    }

    public getOrderStatus(_distributorOrderRef: string): Promise<DropshipOrderStatus> {
        throw new TdSynnexNotCredentialedError('getOrderStatus');
    }

    public getReturnPolicy(_productId: string): Promise<DropshipReturnPolicy> {
        throw new TdSynnexNotCredentialedError('getReturnPolicy');
    }

    public quoteWholesale(_input: WholesaleQuoteInput): Promise<WholesaleQuote> {
        throw new TdSynnexNotCredentialedError('quoteWholesale');
    }
}
