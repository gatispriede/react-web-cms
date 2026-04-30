import {Collection} from 'mongodb';
import guid from "@utils/guid";
import {IUser, InUser, IAddress, InAddress} from "@interfaces/IUser";
import {hash, compare} from "bcrypt";
import {IUserService} from "@services/infra/mongoConfig";
import {
    generatePassword,
    hasInitialPasswordArtefact,
    staleArtefactError,
    writeInitialPasswordArtefact,
} from "@services/features/Auth/initialPassword";

const PUBLIC_FIELDS = {_id: 0} as const;

const normEmail = (e: string | undefined): string => (e ?? '').trim().toLowerCase();

export class UserService implements IUserService {
    private usersDB: Collection;
    private readonly _adminName: string;
    private _adminPassword: string;
    private readonly _adminPasswordHash: string;
    private readonly _hashSaltRounds: number;
    private readonly setupClient: () => Promise<void>;

    constructor(usersDB: Collection, setupClient: () => Promise<void>, adminName: string, adminPassword: string, adminPasswordHash: string, hashSaltRounds: number) {
        this.usersDB = usersDB;
        this.setupClient = setupClient;
        this._adminName = adminName;
        this._adminPassword = adminPassword;
        this._adminPasswordHash = adminPasswordHash;
        this._hashSaltRounds = hashSaltRounds;
    }

    async setupAdmin(): Promise<IUser | undefined> {
        try {
            const existing = await this.usersDB.findOne({name: this._adminName}) as unknown as IUser;
            if (existing) {
                const patch: Partial<IUser> = {};
                if (!existing.role) {
                    patch.role = 'admin';
                    existing.role = 'admin';
                }
                // Back-fill `kind` on the seeded admin (and any legacy doc that
                // predates the customer split) so later kind-aware queries
                // don't have to pretend `undefined ≡ 'admin'` everywhere.
                if (!existing.kind) {
                    patch.kind = 'admin';
                    existing.kind = 'admin';
                }
                if (Object.keys(patch).length) {
                    await this.usersDB.updateOne({id: existing.id}, {$set: patch});
                }
                return existing;
            }

            // No admin exists. Before we seed a new one, guard against the
            // "file on disk but user gone" foot-gun: re-seeding would silently
            // invalidate whatever credentials an operator thinks they have.
            if (!this._adminPasswordHash && !this._adminPassword && hasInitialPasswordArtefact()) {
                throw staleArtefactError();
            }

            // Decide which password hash to store on the freshly-seeded admin.
            // Precedence: ADMIN_PASSWORD_HASH (pre-computed)
            //           > hash(ADMIN_DEFAULT_PASSWORD)
            //           > generate fresh + write protected artefact.
            let passwordHash = this._adminPasswordHash;
            let mustChangePassword = false;
            if (!passwordHash && this._adminPassword) {
                passwordHash = await hash(this._adminPassword, this._hashSaltRounds);
                // The env-supplied default is still a "shared seed" — flag it so
                // the admin is nudged to rotate on first login.
                mustChangePassword = true;
            }
            if (!passwordHash) {
                const generated = generatePassword();
                passwordHash = await hash(generated, this._hashSaltRounds);
                writeInitialPasswordArtefact(generated);
                mustChangePassword = true;
            }

            const newAdmin: IUser = {
                id: guid(),
                name: this._adminName,
                email: process.env.ADMIN_EMAIL ?? 'admin@admin.com',
                password: passwordHash,
                role: 'admin',
                kind: 'admin',
                mustChangePassword,
            } as IUser;
            await this.usersDB.insertOne(newAdmin as any);
            return newAdmin;
        } catch (err) {
            console.error('Error seeding admin user:', err);
            // A stale-artefact error is a real blocker — propagate so the caller
            // can refuse to proceed instead of treating it like a transient
            // Mongo hiccup.
            if (err instanceof Error && err.message.includes('initial-password artefact')) {
                throw err;
            }
            await this.setupClient();
            return undefined;
        }
    }

    async addUser({user}: { user: InUser }): Promise<string> {
        try {
            const email = normEmail(user.email);
            if (!email) throw new Error('email is required');
            // Email uniqueness spans both kinds: a customer with this email
            // would clash if the admin tries to log in / be looked up later.
            const existing = await this.usersDB.findOne({email});
            if (existing) throw new Error('user with this email already exists');
            if (!user.password) throw new Error('password is required for new users');

            const doc: IUser = {
                id: guid(),
                name: user.name ?? email.split('@')[0],
                email,
                password: await hash(user.password, this._hashSaltRounds),
                role: user.role ?? 'viewer',
                kind: 'admin',
                avatar: user.avatar,
                canPublishProduction: Boolean(user.canPublishProduction),
                mustChangePassword: Boolean(user.mustChangePassword),
            };
            await this.usersDB.insertOne(doc as any);
            return JSON.stringify({createUser: {id: doc.id}});
        } catch (err) {
            console.error('Error adding user:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async updateUser({user}: { user: InUser }): Promise<string> {
        try {
            if (!user.id) throw new Error('id is required for updateUser');
            const set: Partial<IUser> = {};
            if (user.name !== undefined) set.name = user.name;
            if (user.email !== undefined) set.email = user.email.trim().toLowerCase();
            if (user.role !== undefined) set.role = user.role;
            if (user.avatar !== undefined) set.avatar = user.avatar;
            if (user.canPublishProduction !== undefined) set.canPublishProduction = Boolean(user.canPublishProduction);
            if (user.preferredAdminLocale !== undefined) {
                if (user.preferredAdminLocale !== 'en' && user.preferredAdminLocale !== 'lv') {
                    throw new Error('preferredAdminLocale must be "en" or "lv"');
                }
                set.preferredAdminLocale = user.preferredAdminLocale;
            }
            if (user.password) {
                set.password = await hash(user.password, this._hashSaltRounds);
                // Rotating the password retires the seeded-default flag. If an
                // admin explicitly passes `mustChangePassword` in the same
                // call it still wins (handled below).
                set.mustChangePassword = false;
            }
            if (user.mustChangePassword !== undefined) set.mustChangePassword = Boolean(user.mustChangePassword);

            if (Object.keys(set).length === 0) {
                return JSON.stringify({updateUser: {id: user.id, noop: true}});
            }
            const result = await this.usersDB.updateOne({id: user.id}, {$set: set});
            return JSON.stringify({updateUser: {id: user.id, matched: result.matchedCount, modified: result.modifiedCount}});
        } catch (err) {
            console.error('Error updating user:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async removeUser({id}: { id: string }): Promise<string> {
        try {
            // Never allow removing the last admin.
            const target = await this.usersDB.findOne({id});
            if (!target) return JSON.stringify({error: 'user not found'});
            if ((target as any).role === 'admin') {
                const adminCount = await this.usersDB.countDocuments({role: 'admin'});
                if (adminCount <= 1) {
                    return JSON.stringify({error: 'cannot remove the last admin user'});
                }
            }
            const result = await this.usersDB.deleteOne({id});
            return JSON.stringify({removeUser: {id, deleted: result.deletedCount}});
        } catch (err) {
            console.error('Error removing user:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getUser({email}: { email: string }): Promise<IUser | undefined> {
        try {
            return await this.usersDB.findOne({email}) as unknown as IUser;
        } catch (err) {
            console.error('Error getting user:', err);
            await this.setupClient();
            return undefined;
        }
    }

    async getUsers(): Promise<IUser[]> {
        try {
            // Admin-facing user list — never include customers (they live
            // alongside admins for the email-uniqueness constraint, but
            // the admin UI only shows admin-kind users).
            const docs = await this.usersDB
                .find({kind: {$ne: 'customer'}}, {projection: PUBLIC_FIELDS})
                .toArray();
            return docs.map(d => ({
                id: (d as any).id,
                name: (d as any).name,
                email: (d as any).email,
                password: '',
                role: (d as any).role ?? 'viewer',
                avatar: (d as any).avatar,
                canPublishProduction: Boolean((d as any).canPublishProduction),
                mustChangePassword: Boolean((d as any).mustChangePassword),
                preferredAdminLocale: (d as any).preferredAdminLocale,
            }));
        } catch (err) {
            console.error('Error listing users:', err);
            await this.setupClient();
            return [];
        }
    }

    // ---------------------------------------------------------------------
    // Customer-facing methods. Every one of these scopes by `_session.email`
    // (or by the request shape for anonymous sign-up); none accept a raw id
    // from the client to mutate by — the IDOR guard is "session is the only
    // identity authority".
    // ---------------------------------------------------------------------

    async signUpCustomer({user}: { user: InUser }): Promise<string> {
        try {
            const email = normEmail(user.email);
            if (!email) throw new Error('email is required');
            if (!user.password) throw new Error('password is required');
            // Cross-kind uniqueness — an email can identify exactly one
            // human, regardless of whether they're staff or shopper.
            const existing = await this.usersDB.findOne({email});
            if (existing) throw new Error('user with this email already exists');

            const doc: IUser = {
                id: guid(),
                name: user.name ?? email.split('@')[0],
                email,
                password: await hash(user.password, this._hashSaltRounds),
                kind: 'customer',
                phone: user.phone,
                shippingAddresses: [],
                createdAt: new Date().toISOString(),
            } as IUser;
            await this.usersDB.insertOne(doc as any);
            return JSON.stringify({createCustomer: {id: doc.id}});
        } catch (err) {
            console.error('Error signing up customer:', err);
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
                    // admin email cannot also be a customer — the human is
                    // expected to sign in with admin Google instead.
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
            console.error('Error linking Google customer:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async getMe({_session, email}: { _session?: {email?: string}; email?: string }): Promise<IUser | undefined> {
        try {
            // The Proxy injects `_session.email`; the explicit `email` arg is a
            // fallback for the rare standalone caller (e.g. tests). Customer
            // scope is enforced by the kind filter, never by client id.
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
            console.error('Error fetching me:', err);
            return undefined;
        }
    }

    async updateMyProfile({user, _session}: { user: InUser; _session?: {email?: string} }): Promise<string> {
        try {
            const sessionEmail = normEmail(_session?.email);
            if (!sessionEmail) throw new Error('not signed in');
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');

            // Whitelist — name / email / phone only. Anything else (role,
            // canPublishProduction, kind, mustChangePassword, googleSub,
            // emailVerified) is silently ignored. Privilege-escalation guard.
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
            console.error('Error updating my profile:', err);
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

            const hashed = await hash(newPassword, this._hashSaltRounds);
            await this.usersDB.updateOne({id: me.id}, {$set: {password: hashed}});
            return JSON.stringify({changeMyPassword: {id: me.id}});
        } catch (err) {
            console.error('Error changing password:', err);
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
            // Always look up by session — never trust a client-supplied id to
            // pick which customer doc to mutate. This is the IDOR guard.
            const me = await this.usersDB.findOne({email: sessionEmail, kind: 'customer'}) as any;
            if (!me) throw new Error('customer not found');

            const list: IAddress[] = Array.isArray(me.shippingAddresses) ? me.shippingAddresses.slice() : [];
            const incomingId = address.id;
            let next: IAddress[];
            let updatedId: string;
            if (incomingId) {
                // Update path — only matches if the address actually belongs
                // to this customer; otherwise treat as new (don't silently
                // adopt the alien id).
                const idx = list.findIndex(a => a.id === incomingId);
                if (idx === -1) throw new Error('address not found');
                updatedId = incomingId;
                next = list.slice();
                next[idx] = {...list[idx], ...address, id: incomingId} as IAddress;
            } else {
                updatedId = guid();
                next = list.concat([{...address, id: updatedId} as IAddress]);
            }

            // Honour `isDefault` — only one default at a time. If the
            // incoming address asks to be default, demote everyone else.
            if (address.isDefault) {
                next = next.map(a => ({...a, isDefault: a.id === updatedId}));
            }

            await this.usersDB.updateOne({id: me.id}, {$set: {shippingAddresses: next}});
            return JSON.stringify({saveMyAddress: {id: updatedId}});
        } catch (err) {
            console.error('Error saving address:', err);
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
            console.error('Error deleting address:', err);
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }
}
