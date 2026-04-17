import {Collection} from 'mongodb';
import {ILogo} from "../Interfaces/ILogo";
import {IImage, InImage} from "../Interfaces/IImage";
import {IAssetService} from "./mongoConfig";

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
            return await this.logosDB.findOne({}) as unknown as ILogo;
        } catch (err) {
            console.error('Error getting logo:', err);
            await this.setupClient();
            return undefined;
        }
    }

    async saveLogo(content: string): Promise<string> {
        try {
            const result = await this.logosDB.updateOne({}, { $set: { content } }, { upsert: true });
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
