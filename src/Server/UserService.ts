import {Collection} from 'mongodb';
import guid from "../helpers/guid";
import {IUser, InUser} from "../Interfaces/IUser";
import {hash} from "bcrypt";
import {IUserService} from "./mongoConfig";

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
            const newAdmin: IUser = {
                id: guid(),
                name: this._adminName,
                email: 'admin@admin.com',
                password: this._adminPasswordHash,
                role: 'admin',
            } as IUser;
            await this.usersDB.insertOne(newAdmin as any);
            return newAdmin;
        } catch (err) {
            console.error('Error getting user:', err);
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
            if (user.password) set.password = await hash(user.password, this._hashSaltRounds);

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
            }));
        } catch (err) {
            console.error('Error listing users:', err);
            await this.setupClient();
            return [];
        }
    }
}
