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
 * STATUS — REAL CALLS WIRED, NOT YET CREDENTIALED.
 *
 * Every public method first guards on `isConfigured()`. If credentials
 * are missing, it throws `TmeNotCredentialedError` (same behaviour the
 * scaffold-only version had). If credentials are present, the real
 * HMAC-signed call fires.
 *
 * What this means operationally:
 *   - Right now: `TME_TOKEN` / `TME_APP_SECRET` are unset in `.env`,
 *     so `isConfigured()` returns false, every method throws,
 *     `DropshipAdapterStatusPanel` surfaces "not credentialed" in
 *     the admin.
 *   - The moment the operator drops creds in `.env` and restarts the
 *     server, the adapter starts answering real questions against
 *     `api.tme.eu`. No code change needed.
 *
 * Auth scheme (per TME docs):
 *  - Every request is POST application/x-www-form-urlencoded.
 *  - Required params on every call: `Token`, `Country`, `Language`.
 *  - `ApiSignature` = base64(HMAC-SHA1(
 *        HTTP_METHOD + '&' +
 *        urlEncode(absoluteEndpointUrl) + '&' +
 *        urlEncode(allParamsSortedAlphabeticallyByKeyAsQueryString),
 *        appSecret))
 *  - The body sent to the server is identical to the signed
 *    `allParamsSortedAlphabeticallyByKeyAsQueryString`, PLUS the
 *    `ApiSignature` appended.
 *  - Language + Country control localised output (LV, PL, EN, DE, ...).
 *
 * Endpoint surface mapped to IDropshipDistributorAdapter:
 *  - `fetchProducts`         → /Products/GetProductsList → /Products/GetProducts
 *  - `fetchProductsSince`    → /Products/GetProductsList with `UpdatedSince`
 *  - `placeOrder`            → /Orders/Create  (B2B-only; needs signed secret)
 *  - `getOrderStatus`        → /Orders/GetOrderStatus
 *  - `getReturnPolicy`       → static (no per-SKU API today; uniform 28-day RMA)
 *  - `quoteWholesale`        → /Products/GetPrices
 *  - `healthCheck`           → /Utilities/GetCountries (cheap, no params)
 *  - `getCategoryHierarchy`  → static path triple (storefront expects 3 levels);
 *                               the dynamic tree from /Products/GetCategories is
 *                               cached + consumed by InventoryService separately.
 *
 * Caveat: response shapes below are best-effort from public docs.
 * The first real call will surface any field-name mismatches; the
 * `parseProductRow` + `parseOrderStatus` helpers are the only spots
 * to touch in that iteration.
 */
import {createHmac} from 'node:crypto';
import type {
    IDropshipDistributorAdapter,
    PlaceDropshipOrderInput,
    PlaceDropshipOrderResult,
    DropshipOrderStatus,
    DropshipReturnPolicy,
    WholesaleQuoteInput,
    WholesaleQuote,
} from './IDropshipDistributorAdapter';
import type {FetchPage, HealthResult, WarehouseProductRow} from '@interfaces/IInventory';

/** Production API base. */
export const TME_API_BASE = 'https://api.tme.eu';

/**
 * Config shape. Maps 1:1 with env vars in spec §"Environment variables — TME":
 *
 *   TME_API_BASE     → baseUrl
 *   TME_TOKEN        → token       (identifies the integration; anonymous-tier OK)
 *   TME_APP_SECRET   → appSecret   (signing key; required for write-side)
 *   TME_COUNTRY      → country     (e.g. 'LV', 'PL', 'DE' — defaults to LV)
 *   TME_LANGUAGE     → language    (e.g. 'EN', 'PL', 'DE' — defaults to EN)
 */
export interface TmeConfig {
    baseUrl: string;
    token: string;
    appSecret: string;
    country: string;
    language: string;
}

/**
 * Thrown when the adapter is invoked without credentials. The admin pane
 * should catch this in `DropshipAdapterStatusPanel` rather than re-throwing
 * into the customer's checkout flow.
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

/**
 * Thrown when a credentialed call to the TME API itself fails — bad
 * signature, throttled, network error, distributor-side fault. Carries
 * the HTTP status + the raw envelope so call sites can decide whether
 * to retry, surface to the customer, or escalate to the operator.
 */
export class TmeApiError extends Error {
    public readonly code = 'TME_API_ERROR' as const;
    constructor(
        method: string,
        public readonly httpStatus: number,
        public readonly tmeStatus: string | undefined,
        public readonly raw: unknown,
    ) {
        super(
            `TME ${method} failed — HTTP ${httpStatus}, status='${tmeStatus ?? 'unknown'}'. ` +
            `Inspect .raw for the response envelope.`,
        );
        this.name = 'TmeApiError';
    }
}

// -- Response shapes (best-effort from public docs) -----------------

/**
 * TME envelope. Every response carries `Status` (OK / E_<code>) + a
 * `Data` payload. Some endpoints also return `Errors` arrays on partial
 * failures; we surface those via `TmeApiError`.
 */
interface TmeEnvelope<T> {
    Status: string;
    Data?: T;
    Errors?: Array<{Code?: string; Element?: string; Message?: string}>;
}

interface TmeProductRow {
    Symbol: string;
    OriginalSymbol?: string;
    Producer?: string;
    Description?: string;
    Category?: string;
    Photo?: string;
    Thumbnail?: string;
    /** Decimal string like "12.34". */
    PriceList?: string;
    /** ISO-4217 code; usually EUR or PLN per account country. */
    Currency?: string;
    InStock?: number;
    Updated?: string;
}

interface TmeProductsListPayload {
    ProductList: TmeProductRow[];
    /** TME paginates by Page index, not opaque cursor — encode as the next-page integer. */
    NextPage?: number;
}

interface TmeOrderStatusPayload {
    OrderId: string;
    Status: string;
    StatusDescription?: string;
    TrackingNumber?: string;
    Carrier?: string;
    ShippedAt?: string;
    DeliveredAt?: string;
}

interface TmePlaceOrderPayload {
    OrderId: string;
    OrderReference?: string;
    TotalNet?: string;
    TotalGross?: string;
    Currency?: string;
}

interface TmePricesPayload {
    PriceList: Array<{
        Symbol: string;
        PriceList?: string;
        Currency?: string;
        Amount?: number;
        InStock?: number;
    }>;
}

interface TmeCountriesPayload {
    CountryList: Array<{Id: string; Name: string}>;
}

// -- Adapter implementation -----------------------------------------

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
        return Boolean(this.config.token && this.config.appSecret);
    }

    // --- IWarehouseAdapter (read-side) -----------------------------

    public async fetchProducts(cursor?: string): Promise<FetchPage> {
        this.requireConfigured('fetchProducts');
        const page = cursor ? Number(cursor) : 1;
        const payload = await this.signedPost<TmeProductsListPayload>(
            '/Products/GetProductsList.json',
            {Page: String(page)},
        );
        return {
            items: (payload.ProductList ?? []).map((p) => parseProductRow(p)),
            nextCursor: payload.NextPage ? String(payload.NextPage) : null,
        };
    }

    public async fetchProductsSince(since: string, cursor?: string): Promise<FetchPage> {
        this.requireConfigured('fetchProductsSince');
        const page = cursor ? Number(cursor) : 1;
        const payload = await this.signedPost<TmeProductsListPayload>(
            '/Products/GetProductsList.json',
            {Page: String(page), UpdatedSince: since},
        );
        return {
            items: (payload.ProductList ?? []).map((p) => parseProductRow(p)),
            nextCursor: payload.NextPage ? String(payload.NextPage) : null,
        };
    }

    public async healthCheck(): Promise<HealthResult> {
        this.requireConfigured('healthCheck');
        const t0 = Date.now();
        try {
            await this.signedPost<TmeCountriesPayload>('/Utilities/GetCountries.json', {});
            return {ok: true, latencyMs: Date.now() - t0, adapter: this.id};
        } catch (err) {
            return {
                ok: false,
                latencyMs: Date.now() - t0,
                adapter: this.id,
                message: err instanceof Error ? err.message : String(err),
            };
        }
    }

    public getCategoryHierarchy(): readonly string[] {
        // The storefront expects a fixed 3-level shape (category /
        // subcategory / series); the dynamic tree from
        // /Products/GetCategories.json is consumed separately by
        // InventoryService when it walks for catalogue ingestion.
        return ['category', 'subcategory', 'series'];
    }

    // --- IDropshipDistributorAdapter (write-side) ------------------

    public async placeOrder(input: PlaceDropshipOrderInput): Promise<PlaceDropshipOrderResult> {
        this.requireConfigured('placeOrder');
        // TME /Orders/Create expects flattened params with indexed line items —
        // `OrderLines[0][Symbol]`, `OrderLines[0][Amount]`, etc. The signing
        // logic flattens automatically since we treat the params record as
        // the source of truth.
        const params: Record<string, string> = {
            ShippingAddress_Name: input.shipTo.name,
            ShippingAddress_Street: [input.shipTo.line1, input.shipTo.line2].filter(Boolean).join(', '),
            ShippingAddress_City: input.shipTo.city,
            ShippingAddress_PostalCode: input.shipTo.postalCode,
            ShippingAddress_Country: input.shipTo.country,
            ShippingAddress_Email: input.customerEmail,
            ShippingAddress_Phone: input.customerPhone ?? '',
            ExternalOrderRef: input.operatorOrderId,
        };
        if (input.notes) params.Notes = input.notes;
        input.items.forEach((line, i) => {
            params[`OrderLines[${i}][Symbol]`] = line.productId;
            params[`OrderLines[${i}][Amount]`] = String(line.qty);
        });
        try {
            const payload = await this.signedPost<TmePlaceOrderPayload>('/Orders/Create.json', params);
            const totalAmountMinor = payload.TotalGross
                ? parseMoneyMinor(payload.TotalGross)
                : (payload.TotalNet ? parseMoneyMinor(payload.TotalNet) : undefined);
            return {
                ok: true,
                distributorOrderRef: payload.OrderReference ?? payload.OrderId,
                quotedTotal: totalAmountMinor !== undefined
                    ? {amount: totalAmountMinor, currency: payload.Currency ?? 'EUR'}
                    : undefined,
            };
        } catch (err) {
            // Surface as ok:false so OrderService.finalize can refund + cancel
            // (spec §"Order flow" step 6 — no partial-dispatch nightmare).
            return {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    public async getOrderStatus(distributorOrderRef: string): Promise<DropshipOrderStatus> {
        this.requireConfigured('getOrderStatus');
        try {
            const payload = await this.signedPost<TmeOrderStatusPayload>(
                '/Orders/GetOrderStatus.json',
                {OrderId: distributorOrderRef},
            );
            return parseOrderStatus(payload);
        } catch {
            // Networking / signature / API failure → unknown so the polling
            // worker doesn't drop the order; next tick re-polls.
            return {status: 'unknown'};
        }
    }

    public async getReturnPolicy(_productId: string): Promise<DropshipReturnPolicy> {
        this.requireConfigured('getReturnPolicy');
        // TME's return policy is uniform per their B2B terms (28 days,
        // unopened, RMA-issued). No per-SKU API. We surface the static
        // policy so OrderService.finalize can validate before accepting
        // an order — same shape every adapter returns, even though
        // it's not dynamic.
        return {
            windowDays: 28,
            restockingFeePct: 0,
            excludedReasons: ['opened-packaging', 'no-rma-issued', 'custom-cut-cable'],
            returnAddress: {
                id: 'tme-returns',
                name: 'TME Returns Department',
                line1: 'ul. Ustronna 41',
                city: 'Łódź',
                postalCode: '93-350',
                country: 'PL',
            },
        };
    }

    public async quoteWholesale(input: WholesaleQuoteInput): Promise<WholesaleQuote> {
        this.requireConfigured('quoteWholesale');
        // TME /Products/GetPrices expects `SymbolList[0]=Foo&SymbolList[1]=Bar`.
        // We're only quoting one product per call here — the spec's
        // WholesaleQuoteInput is single-line; batch quotes are a
        // follow-up if they're needed.
        const params: Record<string, string> = {
            'SymbolList[0]': input.productId,
        };
        const payload = await this.signedPost<TmePricesPayload>(
            '/Products/GetPrices.json',
            params,
        );
        const row = (payload.PriceList ?? []).find((p) => p.Symbol === input.productId);
        const unitMinor = row?.PriceList ? parseMoneyMinor(row.PriceList) : 0;
        const currency = row?.Currency ?? 'EUR';
        const now = new Date();
        // TME wholesale quotes are typically valid 24h per their B2B terms.
        const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
            productId: input.productId,
            qty: input.qty,
            unitWholesale: {amount: unitMinor, currency},
            lineTotal: {amount: unitMinor * input.qty, currency},
            quotedAt: now,
            validUntil,
        };
    }

    // --- Private helpers -------------------------------------------

    /** Throw the not-credentialed error if creds are missing. */
    private requireConfigured(method: string): void {
        if (!this.isConfigured()) throw new TmeNotCredentialedError(method);
    }

    /**
     * Build the TME API signature.
     *
     * Spec: base64(HMAC-SHA1(
     *   HTTP_METHOD + '&' +
     *   urlEncode(fullEndpointUrl) + '&' +
     *   urlEncode(sortedQueryString),
     *   appSecret))
     *
     * The signed `sortedQueryString` must exactly match what gets
     * sent in the request body (minus the trailing ApiSignature itself).
     */
    private sign(endpoint: string, params: Record<string, string>): string {
        const fullUrl = `${this.config.baseUrl}${endpoint}`;
        const sortedKeys = Object.keys(params).sort();
        const queryString = sortedKeys
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
        const stringToSign =
            'POST' + '&' +
            encodeURIComponent(fullUrl) + '&' +
            encodeURIComponent(queryString);
        return createHmac('sha1', this.config.appSecret)
            .update(stringToSign)
            .digest('base64');
    }

    /**
     * Send a signed POST request to TME. Adds the universal params
     * (Token / Country / Language) automatically; the caller only
     * provides endpoint-specific fields.
     */
    private async signedPost<T>(endpoint: string, extraParams: Record<string, string>): Promise<T> {
        const params: Record<string, string> = {
            Token: this.config.token,
            Country: this.config.country,
            Language: this.config.language,
            ...extraParams,
        };
        const signature = this.sign(endpoint, params);
        const body = new URLSearchParams({...params, ApiSignature: signature}).toString();
        const res = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body,
        });
        let envelope: TmeEnvelope<T>;
        try {
            envelope = (await res.json()) as TmeEnvelope<T>;
        } catch {
            throw new TmeApiError(endpoint, res.status, undefined, await res.text());
        }
        if (!res.ok || envelope.Status !== 'OK') {
            throw new TmeApiError(endpoint, res.status, envelope.Status, envelope);
        }
        if (!envelope.Data) {
            throw new TmeApiError(endpoint, res.status, envelope.Status, envelope);
        }
        return envelope.Data;
    }
}

// -- Parsing helpers (the spots to iterate after first real call) ---

/**
 * Map a TME product row → the adapter-facing `WarehouseProductRow`
 * shape. The Symbol field is TME's stable product id; OriginalSymbol
 * is the manufacturer part number (often more useful as the SKU).
 * Inferred from public docs; first real call may surface mismatches.
 */
function parseProductRow(p: TmeProductRow): WarehouseProductRow {
    return {
        externalId: p.Symbol,
        sku: p.OriginalSymbol ?? p.Symbol,
        title: [p.Producer, p.OriginalSymbol ?? p.Symbol].filter(Boolean).join(' ').trim()
            || p.Symbol,
        description: p.Description,
        priceCents: p.PriceList ? parseMoneyMinor(p.PriceList) : 0,
        currency: p.Currency ?? 'EUR',
        stock: p.InStock ?? 0,
        images: [p.Photo, p.Thumbnail].filter((x): x is string => Boolean(x)),
        attributes: {
            tmeSymbol: p.Symbol,
            manufacturerPartNumber: p.OriginalSymbol,
            manufacturer: p.Producer,
            categoryPath: p.Category,
        },
        updatedAt: p.Updated ?? new Date().toISOString(),
    };
}

/**
 * Map TME's `Status` string onto the adapter's `DropshipOrderStatus`
 * discriminated union. Best-effort from public docs — exact string
 * values verified against the first real call.
 */
function parseOrderStatus(p: TmeOrderStatusPayload): DropshipOrderStatus {
    const status = (p.Status ?? '').toUpperCase();
    if (status === 'SHIPPED' || status === 'DISPATCHED') {
        return {
            status: 'shipped',
            trackingNumber: p.TrackingNumber ?? '',
            carrier: p.Carrier ?? '',
            shippedAt: p.ShippedAt ?? new Date().toISOString(),
        };
    }
    if (status === 'DELIVERED') {
        return {
            status: 'delivered',
            deliveredAt: p.DeliveredAt ?? new Date().toISOString(),
        };
    }
    if (status === 'CONFIRMED' || status === 'PROCESSING' || status === 'PICKING' || status === 'ALLOCATED') {
        // ETA not always populated; if absent, +3 working days is the
        // typical TME B2B SLA — the polling worker re-quotes anyway.
        return {
            status: 'allocated',
            estimatedShipDate: nextWorkingDayIso(3),
        };
    }
    if (status === 'CANCELLED') {
        return {status: 'cancelled', reason: p.StatusDescription ?? 'distributor-cancelled'};
    }
    if (status === 'REJECTED' || status === 'FAILED' || status === 'ERROR') {
        return {status: 'rejected', reason: p.StatusDescription ?? 'distributor-rejected'};
    }
    if (status === 'NEW' || status === 'PENDING' || status === '') {
        return {status: 'pending-allocation'};
    }
    return {status: 'unknown'};
}

/**
 * ISO date string for "today + N working days". Skip weekends — that's
 * close enough for an ETA the polling worker is going to refresh
 * anyway.
 */
function nextWorkingDayIso(workingDays: number): string {
    const d = new Date();
    let added = 0;
    while (added < workingDays) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) added += 1;
    }
    return d.toISOString().slice(0, 10);
}

/** Decimal-string "12.34" → integer minor units 1234. */
function parseMoneyMinor(decimal: string): number {
    const n = Number(decimal);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
}
