/**
 * Phase 1.B-c — checkout customization.
 *
 * Persisted shipping-method definition. CRUD lives in
 * `services/features/Checkout/ShippingMethodService.ts`. The storefront
 * `CheckoutShippingMethod` module fetches the list and the operator
 * pricing rule resolves a price at order time.
 *
 * Four type variants — `flatRate`, `weightBased`, `freeThreshold`,
 * `pickup`. Each carries its own sub-record; unrelated fields are
 * left undefined so the persisted row is small.
 */

export type ShippingMethodType = 'flat-rate' | 'weight-based' | 'free-threshold' | 'pickup';

export interface IShippingMethodFlatRate {
    /** Price in minor units (cents) of the site's base currency. */
    amount: number;
    /** ISO 4217 currency code (e.g. 'EUR'). Falls back to site currency when omitted. */
    currency?: string;
}

export interface IShippingMethodWeightBased {
    /** Price per kg, in minor units. */
    pricePerKg: number;
    /** Flat handling fee added on top, in minor units. Optional. */
    handlingFee?: number;
    currency?: string;
}

export interface IShippingMethodFreeThreshold {
    /** Order subtotal (minor units) at or above which shipping is free. */
    thresholdAmount: number;
    /** Price (minor units) charged when below the threshold. */
    belowThresholdAmount: number;
    currency?: string;
}

export interface IShippingMethodPickup {
    /** Human-facing pickup-location address (single block of text). */
    locationAddress: string;
    /** Optional pickup window descriptor — e.g. "Mon–Fri 09:00–17:00". */
    windowDescription?: string;
}

export interface IShippingMethod {
    /** GUID, assigned by the service on create. */
    id: string;
    /** Operator-facing + storefront-visible name (translatable via i18n keys upstream). */
    name: string;
    /** Discriminator. Selects which sub-record below is honoured. */
    type: ShippingMethodType;
    /** Active flag — when false the storefront skips this row but admin still lists it. */
    isActive: boolean;
    /** Display order in the storefront list. Lower first. */
    displayOrder: number;
    /** Restrict the method to specific ISO-3166 country codes; empty = available everywhere. */
    availableCountries?: string[];

    flatRate?: IShippingMethodFlatRate;
    weightBased?: IShippingMethodWeightBased;
    freeThreshold?: IShippingMethodFreeThreshold;
    pickup?: IShippingMethodPickup;

    // Audit + concurrency — mirrors IPage / IOrder shape.
    createdAt?: Date;
    createdBy?: string;
    editedAt?: Date;
    editedBy?: string;
    version?: number;
}
