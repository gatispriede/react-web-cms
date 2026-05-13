/**
 * client-account-settings-page — Phase 1.E.
 *
 * Company-specific profile sub-record attached to an `IUser` whose
 * `customerType === 'company'`. The schema models a single-user
 * company today (one `IUser` per company); the future multi-user
 * scenario can layer an `ICompanyAccount` entity above this without
 * breaking the embedded shape.
 *
 * EU VAT (`vatId`) is the only tax id format we validate end-to-end —
 * VIES verification is cached on `viesVerified*`. Non-EU tax ids
 * (EIN / BN / Companies-House-number / …) are accepted as opaque
 * strings; the registry doesn't trigger the EU-only verifier for them.
 */
import type {IAddress} from './IUser';

/** Legal entity discriminator. Predefined enum; ban free-text Selects
 *  on the storefront form for this field per project policy. */
export type LegalEntityType =
    | 'sole-prop'
    | 'llc'
    | 'plc'
    | 'gmbh'
    | 'sa'
    | 'inc'
    | 'other';

export interface ICompanyProfileContactPerson {
    firstName: string;
    lastName: string;
    role?: string;
}

export interface ICompanyProfile {
    /** Registered legal name — what shows up on invoices. */
    legalName: string;
    /** Constrained enum — see `LegalEntityType`. */
    legalEntityType: LegalEntityType;
    /** Trade-register / company-house number. Plain string; format
     *  varies per country. */
    registrationNumber: string;
    /** Canonical EU VAT format (`AA999999…`). Validated via W8g VIES
     *  when present. Optional — small companies and non-EU buyers
     *  often don't have one. */
    vatId?: string;
    /** Cached VIES verification status — set by the
     *  `verifyCompanyVat()` call on `CustomerProfileService`. Stale
     *  reads (`viesVerifiedAt` older than 24h) trigger a re-check at
     *  checkout per W8g recommendation. */
    viesVerified?: boolean;
    viesVerifiedAt?: Date;
    /** Single-point-of-contact at the business. Future multi-user
     *  designs will hang the full roster off `ICompanyAccount`
     *  instead. */
    contactPerson?: ICompanyProfileContactPerson;
    /** Billing address — for `company` type customers this may
     *  legitimately differ from `IUser.shippingAddresses` (e.g.
     *  registered office vs. warehouse). */
    billingAddress?: IAddress;
}
