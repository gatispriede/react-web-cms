/**
 * Cars module — shared types. The car shape is just `IProduct` filtered
 * to `categories: ['cars']`; we re-export here so the Cars storefront
 * doesn't import `@interfaces/IProduct` in five places.
 */
import type {IProduct} from '@interfaces/IProduct';

export type CarListing = IProduct;

/** VAT regime tokens — mirrored from `SsComCarsNormaliser.VAT_REGIMES`.
 *  Kept in client-land for the badge UI; keep the lists in sync. */
export const CAR_VAT_REGIMES = ['b2c-eu', 'b2c-eu-margin', 'private-no-vat', 'unknown'] as const;
export type CarVatRegime = typeof CAR_VAT_REGIMES[number];

export const CAR_FUEL_TYPES = ['diesel', 'petrol', 'hybrid', 'phev', 'electric', 'lpg', 'cng'] as const;
export type CarFuelType = typeof CAR_FUEL_TYPES[number];
