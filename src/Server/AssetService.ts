import {Collection} from 'mongodb';
import guid from "../helpers/guid";
import {ILogo} from "../Interfaces/ILogo";
import {IImage, InImage} from "../Interfaces/IImage";
import {IAssetService} from "./mongoConfig";
import {auditStamp} from "./audit";

export class AssetService  implements IAssetService {
    private logosDB: Collection;
    private imagesDB: Collection;
    private setupClient: () => Promise<void>;

    constructor(logosDB: Collection, imagesDB: Collection, setupClient: () => Promise<void>) {
        this.logosDB = logosDB;
        this.imagesDB = imagesDB;
        this.setupClient = setupClient;
    }

    async getLogo(): Promise<ILogo | undefined> {
        try {
            const doc: any = await this.logosDB.findOne({});
            if (!doc) return undefined;
            // Back-fill missing id/type so clients never receive `null` for the
            // schema's scalar fields. Legacy Logos docs only had `_id` + content.
            const {_id, ...rest} = doc;
            return {
                id: rest.id ?? String(_id ?? guid()),
                type: rest.type ?? 'image',
                content: rest.content ?? '',
            };
        } catch (err) {
            console.error('Error getting logo:', err);
            await this.setupClient();
            return undefined;
        }
    }

    async saveLogo(content: string, editedBy?: string): Promise<string> {
        try {
            // Persist id + type alongside content so the schema's scalar fields
            // are always non-null going forward.
            const result = await this.logosDB.updateOne(
                {},
                {
                    $set: {content, type: 'image', ...auditStamp(editedBy)},
                    $setOnInsert: {id: guid()},
                },
                {upsert: true},
            );
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error saving logo:', err);
            await this.setupClient();
            return '';
        }
    }

    async saveImage(image: InImage): Promise<string> {
        try {
            const result = await this.imagesDB.insertOne(image);
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error saving image:', err);
            await this.setupClient();
            return '';
        }
    }

    async deleteImage(id: string): Promise<string> {
        try {
            const result = await this.imagesDB.deleteOne({ id });
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error deleting image:', err);
            await this.setupClient();
            return '';
        }
    }

    async getImages(tags: string): Promise<IImage[]> {
        try {
            return await this.imagesDB.find({tags: {$regex: tags, $options: 'i'}}).toArray() as unknown as IImage[];
        } catch (err) {
            console.error('Error getting images:', err);
            await this.setupClient();
            return [];
        }
    }
}
