import {Collection} from 'mongodb';
import guid from "@utils/guid";
import {IUser, InUser} from "@interfaces/IUser";
import {hash} from "bcrypt";
import {IUserService} from "@services/infra/mongoConfig";
import {
    generatePassword,
    hasInitialPasswordArtefact,
    staleArtefactError,
    writeInitialPasswordArtefact,
} from "@services/features/Auth/initialPassword";

const PUBLIC_FIELDS = {_id: 0} as const;

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
                if (!existing.role) {
                    await this.usersDB.updateOne({id: existing.id}, {$set: {role: 'admin'}});
                    existing.role = 'admin';
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
            const email = (user.email ?? '').trim().toLowerCase();
            if (!email) throw new Error('email is required');
            const existing = await this.usersDB.findOne({email});
            if (existing) throw new Error('user with this email already exists');
            if (!user.password) throw new Error('password is required for new users');

            const doc: IUser = {
                id: guid(),
                name: user.name ?? email.split('@')[0],
                email,
                password: await hash(user.password, this._hashSaltRounds),
                role: user.role ?? 'viewer',
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
            const docs = await this.usersDB.find({}, {projection: PUBLIC_FIELDS}).toArray();
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
}
