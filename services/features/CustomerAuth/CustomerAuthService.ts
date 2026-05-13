import {Collection} from 'mongodb';
import {hash, compare} from 'bcrypt';
import {createHash, randomBytes} from 'crypto';
import guid from '@utils/guid';
import {IUser, InUser, IAddress, InAddress} from '@interfaces/IUser';
import {log} from '@services/infra/logger';

const PUBLIC_FIELDS = {_id: 0} as const;

// W6c — magic-link config. Tokens are 32-byte CSPRNG, base64url-encoded
// (43 chars, ≥256-bit entropy). Stored hashed at rest (sha256) keyed by
// hash so a DB leak doesn't yield usable tokens.
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const MAGIC_RATE_LIMIT_PER_HOUR = 5;

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export interface MagicLinkIssueResult {
    /** Plaintext token — only returned here, never persisted. */
    token: string;
    /** When the token expires. */
    expiresAt: Date;
    /** Email the token was issued for (normalised). */
    email: string;
}

export interface MagicLinkRedeemResult {
    ok: boolean;
    /** When ok=true — the (possibly newly created) customer user id. */
    userId?: string;
    email?: string;
    name?: string;
    error?: string;
}

const normEmail = (e: string | undefined): string => (e ?? '').trim().toLowerCase();

/**
 * Customer-side identity & profile service. Split out of `UserService`
 * (Class Loader L3 follow-up, decision 2026-05-02): admin-grade user
 * methods stay in `UserService`; customer-kind methods (sign-up, profile
 * read/write, password change, shipping addresses) live here.
 *
 * Shares the `Users` collection — one row per human, discriminated by
 * `kind: 'admin' | 'customer'`. Cross-kind email uniqueness is enforced
 * at sign-up time so an email maps to exactly one human.
 *
 * Every customer method scopes by `_session.email` (or by the request
 * shape for anonymous sign-up); none accept a raw id from the client to
 * mutate by — the IDOR guard is "session is the only identity authority."
 *
 * Behaviour identical to the prior UserService customer methods. The
 * `customerAuth` plug-and-play flag now toggles this feature in/out
 * without touching `users`.
 */
export class CustomerAuthService {
    constructor(
        private readonly usersDB: Collection,
        private readonly hashSaltRounds: number,
        /** W6c — Mongo collection backing the magic-link token store.
         *  Optional: callers that don't wire it lose the magic-link
         *  feature; password + OAuth paths remain unaffected. */
        private readonly magicTokensDB?: Collection,
    ) {}

    /**
     * W6c — issue a single-use magic-link token. Always succeeds for
     * email-shape input (no enumeration) — caller decides whether to
     * actually dispatch the email. Per-email rate-limited.
     *
     * Token storage: hashed at rest, 15-min TTL, one row per request.
     * Caller is responsible for sending the email via EmailService +
     * the `magic-link` template registry entry.
     */
    async issueMagicLinkToken({email}: {email: string}): Promise<MagicLinkIssueResult | {error: string}> {
        try {
            const norm = normEmail(email);
            if (!norm) return {error: 'email is required'};
            if (!this.magicTokensDB) return {error: 'magic-link store unavailable'};
            // Per-email cooldown — 5/hour. Counts active+unconsumed rows.
            const since = new Date(Date.now() - 60 * 60 * 1000);
            const recent = await this.magicTokensDB.countDocuments({email: norm, createdAt: {$gte: since}});
            if (recent >= MAGIC_RATE_LIMIT_PER_HOUR) {
                return {error: 'too many magic-link requests — please wait an hour'};
            }
            const tokenPlain = randomBytes(32).toString('base64url');
            const tokenHash = sha256(tokenPlain);
            const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);
            await this.magicTokensDB.insertOne({
                id: guid(),
                tokenHash,
                email: norm,
                createdAt: new Date(),
                expiresAt,
                consumedAt: null,
            });
            return {token: tokenPlain, expiresAt, email: norm};
        } catch (err) {
            log.error({scope: 'customer.magicIssue', err}, 'issueMagicLinkToken failed');
            return {error: 'failed to issue magic-link'};
        }
    }

    /**
     * W6c — redeem a magic-link token. Single-use: mark consumed under
     * a `findOneAndUpdate` so concurrent clicks can't double-spend.
     * Creates a customer record on first-touch if absent (email is the
     * source of truth — magic-link click proves email ownership).
     */
    async redeemMagicLinkToken({token}: {token: string}): Promise<MagicLinkRedeemResult> {
        try {
            if (!token) return {ok: false, error: 'token is required'};
            if (!this.magicTokensDB) return {ok: false, error: 'magic-link store unavailable'};
            const tokenHash = sha256(token);
            const now = new Date();
            const row = await this.magicTokensDB.findOneAndUpdate(
                {tokenHash, consumedAt: null, expiresAt: {$gt: now}},
                {$set: {consumedAt: now}},
                {returnDocument: 'before'},
            ) as any;
            const doc = row?.value ?? row; // driver version compat
            if (!doc) return {ok: false, error: 'invalid or expired link'};
            const email = doc.email as string;
            // Find or create customer (idempotent — magic-link is a
            // signup-or-login fused path).
            const existing = await this.usersDB.findOne({email}) as any;
            if (existing) {
                if (existing.kind && existing.kind !== 'customer') {
                    // Admin email — refuse on the customer surface.
                    return {ok: false, error: 'this email is registered as a staff account'};
                }
                // Stamp emailVerified on first magic-link redemption
                // (the click is proof of ownership).
                if (!existing.emailVerified) {
                    await this.usersDB.updateOne({id: existing.id}, {$set: {emailVerified: new Date().toISOString()}});
                }
                return {ok: true, userId: existing.id, email: existing.email, name: existing.name};
            }
            // Brand-new customer — minimal doc; profile completion happens
            // via /account/profile after first sign-in.
            const doc2: IUser = {
                id: guid(),
                name: email.split('@')[0],
                email,
                password: '',
                kind: 'customer',
                emailVerified: new Date().toISOString(),
                shippingAddresses: [],
                createdAt: new Date().toISOString(),
            } as IUser;
            await this.usersDB.insertOne(doc2 as any);
            return {ok: true, userId: doc2.id, email: doc2.email, name: doc2.name};
        } catch (err) {
            log.error({scope: 'customer.magicRedeem', err}, 'redeemMagicLinkToken failed');
            return {ok: false, error: 'failed to redeem magic-link'};
        }
    }

    async signUpCustomer({user}: { user: InUser }): Promise<string> {
        try {
            const email = normEmail(user.email);
            if (!email) throw new Error('email is required');
            if (!user.password) throw new Error('password is required');
            // Cross-kind uniqueness — an email can identify exactly one
            // human, regardless of staff vs shopper.
            const existing = await this.usersDB.findOne({email});
            if (existing) throw new Error('user with this email already exists');

            const doc: IUser = {
                id: guid(),
                name: user.name ?? email.split('@')[0],
                email,
                password: await hash(user.password, this.hashSaltRounds),
                kind: 'customer',
                phone: user.phone,
                shippingAddresses: [],
                createdAt: new Date().toISOString(),
            } as IUser;
            await this.usersDB.insertOne(doc as any);
            return JSON.stringify({createCustomer: {id: doc.id}});
        } catch (err) {
            log.error({scope: 'customer.signup', err, email: user?.email}, 'signUpCustomer failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async addCustomerFromGoogle({email, name, googleSub}: { email: string; name?: string; googleSub: string }): Promise<string> {
        try {
            const e = normEmail(email);
            if (!e) throw new Error('email is required');
            if (!googleSub) throw new Error('googleSub is required');

            // 1) idempotent on googleSub
            const bySub = await this.usersDB.findOne({googleSub}) as any;
            if (bySub) {
                return JSON.stringify({createCustomer: {id: bySub.id, linked: false}});
            }
            // 2) link to existing customer by email
            const byEmail = await this.usersDB.findOne({email: e}) as any;
            if (byEmail) {
                if (byEmail.kind === 'admin' || byEmail.kind === undefined) {
                    // Treat absent-kind as admin (legacy back-compat). An
                    // admin email cannot also be a customer.
                    throw new Error('email already in use');
                }
                await this.usersDB.updateOne(
                    {id: byEmail.id},
                    {$set: {googleSub, emailVerified: new Date().toISOString(), name: byEmail.name || name || e.split('@')[0]}},
                );
                return JSON.stringify({createCustomer: {id: byEmail.id, linked: true}});
            }
            // 3) brand new customer
            const doc: IUser = {
                id: guid(),
                name: name ?? e.split('@')[0],
                email: e,
                password: '',
                kind: 'customer',
                googleSub,
                emailVerified: new Date().toISOString(),
                shippingAddresses: [],
                createdAt: new Date().toISOString(),
            } as IUser;
            await this.usersDB.insertOne(doc as any);
            return JSON.stringify({createCustomer: {id: doc.id, linked: false}});
        } catch (err) {
            log.error({scope: 'customer.googleLink', err, email}, 'addCustomerFromGoogle failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getMe({_session, email}: { _session?: {email?: string}; email?: string }): Promise<IUser | undefined> {
        try {
            const target = normEmail(_session?.email ?? email);
            if (!target) return undefined;
            const doc = await this.usersDB.findOne(
                {email: target, kind: 'customer'},
                {projection: PUBLIC_FIELDS},
            ) as any;
            if (!doc) return undefined;
            return {
                id: doc.id,
                name: doc.name ?? '',
                email: doc.email,
                password: '', // redacted, mirrors getUsers
                kind: 'customer',
                phone: doc.phone,
                emailVerified: doc.emailVerified,
                shippingAddresses: doc.shippingAddresses ?? [],
                createdAt: doc.createdAt,
            } as IUser;
        } catch (err) {
            log.error({scope: 'customer.me', err}, 'getMe failed');
            return undefined;
        }
    }

    async updateMyProfile({user, _session}: { user: InUser; _session?: {email?: string} }): Promise<string> {
        try {
            const sessionEmail = normEmail(_session?.email);
            if (!sessionEmail) throw new Error('not signed in');
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');

            // Whitelist — name / email / phone only. Privilege-escalation guard.
            const set: Partial<IUser> = {};
            if (user.name !== undefined) set.name = user.name;
            if (user.email !== undefined) {
                const newEmail = normEmail(user.email);
                if (newEmail && newEmail !== me.email) {
                    const clash = await this.usersDB.findOne({email: newEmail});
                    if (clash) throw new Error('email already in use');
                    set.email = newEmail;
                }
            }
            if (user.phone !== undefined) set.phone = user.phone;

            if (Object.keys(set).length === 0) {
                return JSON.stringify({updateMyProfile: {id: me.id, noop: true}});
            }
            const result = await this.usersDB.updateOne({id: me.id}, {$set: set});
            return JSON.stringify({updateMyProfile: {id: me.id, matched: result.matchedCount, modified: result.modifiedCount}});
        } catch (err) {
            log.error({scope: 'customer.updateProfile', err}, 'updateMyProfile failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async changeMyPassword({oldPassword, newPassword, _session}: { oldPassword: string; newPassword: string; _session?: {email?: string} }): Promise<string> {
        try {
            const sessionEmail = normEmail(_session?.email);
            if (!sessionEmail) throw new Error('not signed in');
            if (!newPassword) throw new Error('newPassword is required');
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');
            if (!me.password) throw new Error('account has no password set');

            const ok = await compare(oldPassword || '', me.password);
            if (!ok) throw new Error('old password is incorrect');

            const hashed = await hash(newPassword, this.hashSaltRounds);
            await this.usersDB.updateOne({id: me.id}, {$set: {password: hashed}});
            return JSON.stringify({changeMyPassword: {id: me.id}});
        } catch (err) {
            log.error({scope: 'customer.changePassword', err}, 'changeMyPassword failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async saveMyAddress({address, _session}: { address: InAddress; _session?: {email?: string} }): Promise<string> {
        try {
            const sessionEmail = normEmail(_session?.email);
            if (!sessionEmail) throw new Error('not signed in');
            if (!address || !address.line1 || !address.city || !address.country || !address.postalCode || !address.name) {
                throw new Error('address fields are required');
            }
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');

            const list: IAddress[] = Array.isArray(me.shippingAddresses) ? me.shippingAddresses.slice() : [];
            const incomingId = address.id;
            let next: IAddress[];
            let updatedId: string;
            if (incomingId) {
                const idx = list.findIndex(a => a.id === incomingId);
                if (idx === -1) throw new Error('address not found');
                updatedId = incomingId;
                next = list.slice();
                next[idx] = {...list[idx], ...address, id: incomingId} as IAddress;
            } else {
                updatedId = guid();
                next = list.concat([{...address, id: updatedId} as IAddress]);
            }

            // Honour `isDefault` — only one default at a time.
            if (address.isDefault) {
                next = next.map(a => ({...a, isDefault: a.id === updatedId}));
            }

            await this.usersDB.updateOne({id: me.id}, {$set: {shippingAddresses: next}});
            return JSON.stringify({saveMyAddress: {id: updatedId}});
        } catch (err) {
            log.error({scope: 'customer.saveAddress', err}, 'saveMyAddress failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async deleteMyAddress({id, _session}: { id: string; _session?: {email?: string} }): Promise<string> {
        try {
            const sessionEmail = normEmail(_session?.email);
            if (!sessionEmail) throw new Error('not signed in');
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');
            const list: IAddress[] = Array.isArray(me.shippingAddresses) ? me.shippingAddresses : [];
            const next = list.filter(a => a.id !== id);
            if (next.length === list.length) {
                return JSON.stringify({error: 'address not found'});
            }
            await this.usersDB.updateOne({id: me.id}, {$set: {shippingAddresses: next}});
            return JSON.stringify({deleteMyAddress: {id}});
        } catch (err) {
            log.error({scope: 'customer.deleteAddress', err, id}, 'deleteMyAddress failed');
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }
}
