import {Collection} from 'mongodb';
import {hash, compare} from 'bcrypt';
import guid from '@utils/guid';
import {IUser, InUser, IAddress, InAddress} from '@interfaces/IUser';
import {log} from '@services/infra/logger';

const PUBLIC_FIELDS = {_id: 0} as const;

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
    ) {}

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
