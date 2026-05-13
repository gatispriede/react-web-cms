/**
 * client-account-settings-page (Phase 1.E) — customer profile service.
 *
 * Owns the customer-side mutations the `/account/settings` page +
 * the `accountSettings.*` / `customer.*` MCP tool surface need:
 *
 *   - `getProfile(userId)` — admin-grade read of the full customer
 *     record (server-side only; the storefront uses the existing
 *     `me` query on `CustomerAuthService` for self-reads).
 *   - `updateProfile(userId, patch)` — patches a curated subset of
 *     fields. Rejects writes to admin-only fields (`role`, `kind`,
 *     `password`) and validates per `customerType`.
 *   - `setCustomerType(userId, type)` — the explicit type-switch.
 *     `client → company` flips the discriminator; `company → client`
 *     requires the caller to acknowledge the company-data archive
 *     (`{ack: true}`) — guards against accidental data loss.
 *   - Address CRUD — thin wrappers over `shippingAddresses[]`.
 *   - Payment-method CRUD — Stripe-tokenized refs only; never raw
 *     card data.
 *   - `verifyCompanyVat(userId)` — caches the VIES verdict on the
 *     company sub-record (24h TTL per W8g recommendation).
 *
 * IDOR guard: the service trusts the caller to pass the right
 * `userId`; the MCP tool layer is admin-only and the storefront
 * resolvers resolve `userId` from `_session.email`. We never accept a
 * raw client-supplied id from the public SDL.
 */
import {Collection} from 'mongodb';
import guid from '@utils/guid';
import {log} from '@services/infra/logger';
import type {IUser, IAddress} from '@interfaces/IUser';
import type {ICompanyProfile} from '@interfaces/ICompanyProfile';
import type {IPaymentMethodRef} from '@interfaces/IPaymentMethodRef';

const PROJ = {_id: 0} as const;

/** Whitelist of top-level fields a customer-side update may patch.
 *  Anything outside this set is silently dropped — admin-only fields
 *  (`role`, `kind`, `password`, `canPublishProduction`, `grants`) are
 *  intentionally absent. */
const PATCHABLE_FIELDS = new Set<keyof IUser>([
    'name',
    'phone',
    'preferredLanguage',
    'preferredCurrency',
    'dateOfBirth',
    'company',
]);

/** Optional VIES verifier — wired in via constructor so the service
 *  stays test-friendly and free of a hard dep on the multi-currency
 *  feature. Returning `null` is allowed (e.g. VIES is down). */
export interface IViesVerifier {
    /** Returns `true` when the VAT id verifies, `false` when it
     *  cleanly fails, `null` when the upstream is unreachable. */
    verify(vatId: string): Promise<boolean | null>;
}

export class CustomerProfileService {
    constructor(
        private readonly usersDB: Collection,
        private readonly vies?: IViesVerifier,
    ) {}

    /** Admin-grade read. Returns `null` for unknown ids. */
    async getProfile(userId: string): Promise<IUser | null> {
        const doc = await this.usersDB.findOne({id: userId}, {projection: PROJ});
        return (doc as IUser | null) ?? null;
    }

    /**
     * Patch a curated subset of fields. Validation:
     *   - `'company'` patch is only honoured when `customerType === 'company'`
     *     (after applying the patch). Stale company data on a `'client'`
     *     row is rejected.
     *   - `dateOfBirth` is rejected for `'company'` types — DOB is a
     *     `'client'`-only marketing-segmentation field.
     */
    async updateProfile(
        userId: string,
        patch: Partial<IUser>,
    ): Promise<{ok: boolean; error?: string}> {
        const current = await this.getProfile(userId);
        if (!current) return {ok: false, error: 'user not found'};
        if (current.kind !== 'customer') return {ok: false, error: 'not a customer'};

        const $set: Record<string, unknown> = {};
        for (const key of Object.keys(patch) as (keyof IUser)[]) {
            if (!PATCHABLE_FIELDS.has(key)) continue;
            $set[key as string] = patch[key];
        }
        const nextType = current.customerType ?? 'client';
        if ($set.company && nextType !== 'company') {
            return {ok: false, error: 'company-profile data only valid for customerType=company'};
        }
        if ($set.dateOfBirth && nextType === 'company') {
            return {ok: false, error: 'dateOfBirth is only valid for customerType=client'};
        }

        if (Object.keys($set).length === 0) return {ok: true};
        await this.usersDB.updateOne({id: userId}, {$set});
        return {ok: true};
    }

    /**
     * Flip `customerType`. `company → client` requires `ack: true` to
     * acknowledge the company-data archive (we keep `company` on disk
     * but the storefront stops surfacing it). `client → company`
     * reveals empty company fields the operator can fill in.
     */
    async setCustomerType(
        userId: string,
        type: 'client' | 'company',
        opts: {ack?: boolean} = {},
    ): Promise<{ok: boolean; error?: string}> {
        const current = await this.getProfile(userId);
        if (!current) return {ok: false, error: 'user not found'};
        if (current.kind !== 'customer') return {ok: false, error: 'not a customer'};
        const was = current.customerType ?? 'client';
        if (was === type) return {ok: true};
        if (was === 'company' && type === 'client' && !opts.ack) {
            return {ok: false, error: 'company → client requires {ack: true}'};
        }
        await this.usersDB.updateOne({id: userId}, {$set: {customerType: type}});
        log.info({scope: 'customer.type.set', userId, from: was, to: type}, 'customer type switched');
        return {ok: true};
    }

    /** Append an address. Generates a guid + flips defaults so only
     *  one row is `isDefault: true` at a time. */
    async addAddress(userId: string, address: Omit<IAddress, 'id'>): Promise<{ok: boolean; id?: string; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.shippingAddresses ?? [];
        const id = guid();
        const next: IAddress = {...address, id};
        const updated = next.isDefault
            ? [...list.map(a => ({...a, isDefault: false})), next]
            : [...list, next];
        await this.usersDB.updateOne({id: userId}, {$set: {shippingAddresses: updated}});
        return {ok: true, id};
    }

    async updateAddress(userId: string, addressId: string, patch: Partial<IAddress>): Promise<{ok: boolean; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.shippingAddresses ?? [];
        const idx = list.findIndex(a => a.id === addressId);
        if (idx < 0) return {ok: false, error: 'address not found'};
        const merged: IAddress = {...list[idx], ...patch, id: addressId};
        const updated = list.map((a, i) => (i === idx ? merged : a));
        await this.usersDB.updateOne({id: userId}, {$set: {shippingAddresses: updated}});
        return {ok: true};
    }

    async deleteAddress(userId: string, addressId: string): Promise<{ok: boolean; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.shippingAddresses ?? [];
        const updated = list.filter(a => a.id !== addressId);
        await this.usersDB.updateOne({id: userId}, {$set: {shippingAddresses: updated}});
        return {ok: true};
    }

    async setDefaultAddress(userId: string, addressId: string): Promise<{ok: boolean; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.shippingAddresses ?? [];
        if (!list.some(a => a.id === addressId)) return {ok: false, error: 'address not found'};
        const updated = list.map(a => ({...a, isDefault: a.id === addressId}));
        await this.usersDB.updateOne({id: userId}, {$set: {shippingAddresses: updated}});
        return {ok: true};
    }

    async addPaymentMethod(userId: string, ref: Omit<IPaymentMethodRef, 'id' | 'addedAt'>): Promise<{ok: boolean; id?: string; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.paymentMethods ?? [];
        const next: IPaymentMethodRef = {...ref, id: guid(), addedAt: new Date()};
        const updated = next.isDefault
            ? [...list.map(m => ({...m, isDefault: false})), next]
            : [...list, next];
        await this.usersDB.updateOne({id: userId}, {$set: {paymentMethods: updated}});
        return {ok: true, id: next.id};
    }

    async removePaymentMethod(userId: string, refId: string): Promise<{ok: boolean; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.paymentMethods ?? [];
        const updated = list.filter(m => m.id !== refId);
        await this.usersDB.updateOne({id: userId}, {$set: {paymentMethods: updated}});
        return {ok: true};
    }

    async setDefaultPaymentMethod(userId: string, refId: string): Promise<{ok: boolean; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        const list = user.paymentMethods ?? [];
        if (!list.some(m => m.id === refId)) return {ok: false, error: 'payment method not found'};
        const updated = list.map(m => ({...m, isDefault: m.id === refId}));
        await this.usersDB.updateOne({id: userId}, {$set: {paymentMethods: updated}});
        return {ok: true};
    }

    /**
     * Refresh the VIES verdict on a company-type customer. Stores
     * the result + verifiedAt on `company.viesVerified*`. Soft-fails
     * (returns `{ok: true, viesVerified: null}`) when the upstream is
     * unreachable — the caller surfaces a "pending verification"
     * badge per W8g recommendation. */
    async verifyCompanyVat(userId: string): Promise<{ok: boolean; viesVerified?: boolean | null; error?: string}> {
        const user = await this.getProfile(userId);
        if (!user) return {ok: false, error: 'user not found'};
        if (user.customerType !== 'company') return {ok: false, error: 'not a company customer'};
        const vatId = user.company?.vatId;
        if (!vatId) return {ok: false, error: 'company.vatId is not set'};
        const result = this.vies ? await this.vies.verify(vatId) : null;
        const patch: Partial<ICompanyProfile> = {
            ...user.company!,
            viesVerified: result ?? undefined,
            viesVerifiedAt: new Date(),
        };
        await this.usersDB.updateOne({id: userId}, {$set: {company: patch}});
        return {ok: true, viesVerified: result};
    }

    /** Admin listing — supports `customerType` filter for the
     *  `customer.list { filterByType }` MCP tool. */
    async listCustomers(opts: {filterByType?: 'client' | 'company'; limit?: number} = {}): Promise<IUser[]> {
        const where: Record<string, unknown> = {kind: 'customer'};
        if (opts.filterByType) where.customerType = opts.filterByType;
        const cursor = this.usersDB.find(where, {projection: PROJ}).limit(Math.min(500, Math.max(1, opts.limit ?? 100)));
        const docs = (await cursor.toArray()) as unknown as IUser[];
        return docs;
    }
}

let _singleton: CustomerProfileService | null = null;
export function getCustomerProfileService(db: {collection: (name: string) => Collection}, vies?: IViesVerifier): CustomerProfileService {
    if (!_singleton) _singleton = new CustomerProfileService(db.collection('Users'), vies);
    return _singleton;
}

/** Test seam — drops the cached singleton. */
export function _resetCustomerProfileServiceForTests(): void {
    _singleton = null;
}
