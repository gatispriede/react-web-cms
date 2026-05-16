/**
 * `IDropshipDistributorAdapter` — Phase 1 scaffold for the
 * pc-parts-dropshipping-integration roadmap item.
 *
 * Spec: docs/roadmap/storefront/pc-parts-dropshipping-integration.md
 *
 * The dropship adapter extends the existing W7b `IWarehouseAdapter`
 * read-side contract (`fetchProducts` / `fetchProductsSince` /
 * `healthCheck` / `getCategoryHierarchy`) with the write-side
 * methods needed to forward an operator-side order to a
 * third-party distributor (TD SYNNEX, Ingram Micro, Asbis, etc.).
 *
 * Every method on this interface is a contract; concrete adapters
 * (e.g. `TdSynnexStreamOneAdapter`) implement them against the
 * distributor's REST / SOAP / GraphQL API. The adapter doubles as
 * the inventory source — there is no separate read adapter when an
 * operator runs in pure-dropship mode (operator holds no stock; the
 * distributor's catalogue IS the catalogue).
 *
 * This file is INTERFACE-ONLY. No implementation is wired here.
 * Wire-up to the checkout flow (`OrderService.finalize` calling
 * `placeOrder`) is a separate follow-up commit that lands once the
 * operator has acquired a distributor partner account and dropped
 * credentials into `.env`. See spec §"Operator post-merge ops".
 */
import type {IWarehouseAdapter} from '@services/features/Inventory/adapters/IWarehouseAdapter';
import type {IAddress} from '@interfaces/IUser';
import type {MoneyAmount} from '@interfaces/IPricing';

/**
 * The full dropship contract. Composes the W7b read-side
 * (`IWarehouseAdapter`) so a single instance can both populate the
 * catalogue AND forward orders. Implementations live under
 * `services/features/Inventory/adapters/<distributor>/` per the spec's
 * "Files to touch" §, with feature-flag gating + factory registration
 * in `services/features/Inventory/adapters/index.ts`.
 */
export interface IDropshipDistributorAdapter extends IWarehouseAdapter {
    /**
     * Forward an operator-side order to the distributor. The
     * distributor allocates stock, charges the operator's wholesale
     * account, and ships direct to the customer's address.
     *
     * Per spec §"Order flow" step 4: invoked from
     * `OrderService.finalize()` when the order contains
     * dropship-sourced products. If `ok === false` with
     * `rejectedItems`, the operator must refund + cancel before
     * shipping (spec step 6 — no partial-dispatch nightmare).
     */
    placeOrder(input: PlaceDropshipOrderInput): Promise<PlaceDropshipOrderResult>;

    /**
     * Poll for status on a previously-forwarded order. Returns
     * fulfillment status + tracking info once the distributor ships.
     * The operator-side `DropshipOrderPollingWorker` calls this every
     * 10 min for orders in `pending-shipment` / `allocated` state
     * (spec §"Operator-side scheduled jobs").
     *
     * Some distributors expose webhooks instead; the adapter may
     * declare webhook capability separately. Polling is the v1
     * fallback path and works for all three target distributors.
     */
    getOrderStatus(distributorOrderRef: string): Promise<DropshipOrderStatus>;

    /**
     * Per-product return policy + restocking-fee schedule. Varies by
     * distributor + product category — software keys are typically
     * non-returnable, thermal paste is non-returnable once opened, EU
     * consumer law guarantees a 14-day window for B2C, etc.
     *
     * Adapters are expected to cache aggressively (policies change
     * rarely). Operator surface: spec §"Customer support tools"
     * "Re-poll distributor status" + admin Orders pane.
     */
    getReturnPolicy(productId: string): Promise<DropshipReturnPolicy>;

    /**
     * Wholesale price quote for one product + qty, exclusive of
     * customer-facing shipping. Operator markup
     * (`commerce.dropship.markupPct` × wholesale, floored at
     * `commerce.dropship.minMarginPct`) is layered on top by
     * `DropshipMarkupService` to produce the storefront display
     * price (spec §"Operator-facing pricing model").
     *
     * Wholesale quotes are typically valid for 24 h; `validUntil`
     * lets the operator decide when to refresh vs. trust.
     */
    quoteWholesale(input: WholesaleQuoteInput): Promise<WholesaleQuote>;

    /**
     * Configuration sanity check — returns `false` when env vars are
     * unset (e.g. operator hasn't acquired a partner account yet).
     * The admin pane (`DropshipAdapterStatusPanel`) reads this to
     * surface a "Configure distributor credentials" prompt instead
     * of attempting calls that would throw at runtime.
     */
    isConfigured(): boolean;
}

/** Input to `placeOrder`. Mirrors the spec's `PlaceDropshipOrderInput`. */
export interface PlaceDropshipOrderInput {
    /** Operator-side order id — used as the distributor's reference. */
    operatorOrderId: string;
    items: Array<{productId: string; qty: number}>;
    /** Customer's shipping address (shared type from `IUser`). */
    shipTo: IAddress;
    /** Customer email — distributor sends shipping notification direct. */
    customerEmail: string;
    customerPhone?: string;
    /** Operator passes through; some distributors echo on packing slip. */
    notes?: string;
}

/** Result from `placeOrder`. Mirrors the spec's `PlaceDropshipOrderResult`. */
export interface PlaceDropshipOrderResult {
    ok: boolean;
    /** Operator persists this on `IOrder.dropshipOrderId`. */
    distributorOrderRef?: string;
    rejectedItems?: Array<{
        productId: string;
        reason: 'out-of-stock' | 'not-shippable' | 'price-changed' | 'other';
        detail?: string;
    }>;
    /** Wholesale + distributor shipping (operator's cost). */
    quotedTotal?: MoneyAmount;
    /** ISO date string (YYYY-MM-DD). */
    estimatedShipDate?: string;
    /** Populated when `ok === false` and there are no `rejectedItems`. */
    error?: string;
}

/** Discriminated union — adapter reports the current state. */
export type DropshipOrderStatus =
    | {status: 'pending-allocation'}
    | {status: 'allocated'; estimatedShipDate: string}
    | {status: 'shipped'; trackingNumber: string; carrier: string; shippedAt: string}
    | {status: 'delivered'; deliveredAt: string}
    | {status: 'rejected' | 'cancelled'; reason: string}
    | {status: 'unknown'};

export interface DropshipReturnPolicy {
    /** Typical 14 (EU consumer law) or 30. */
    windowDays: number;
    /** Some categories carry a restocking fee. */
    restockingFeePct?: number;
    /** Free-text per distributor — e.g. ['software-keys', 'opened-thermal-paste']. */
    excludedReasons: string[];
    /** Address the customer ships returns back to (often distributor warehouse). */
    returnAddress: IAddress;
}

export interface WholesaleQuoteInput {
    productId: string;
    qty: number;
    /** Optional — distributor may quote shipping in addition. */
    shipToCountry?: string;
}

export interface WholesaleQuote {
    productId: string;
    qty: number;
    unitWholesale: MoneyAmount;
    lineTotal: MoneyAmount;
    distributorShippingEstimate?: MoneyAmount;
    quotedAt: Date;
    /** Wholesale quotes are typically valid 24 h. */
    validUntil: Date;
}
