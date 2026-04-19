import {Collection} from 'mongodb';
import fs from 'fs';
import path from 'node:path';
import guid from "../helpers/guid";
import {ILogo} from "../Interfaces/ILogo";
import {IImage, InImage} from "../Interfaces/IImage";
import {IAssetService} from "./mongoConfig";
import {auditStamp} from "./audit";
import {PUBLIC_IMAGE_PATH} from "../constants/imgPath";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i;
const IMAGES_DIR = path.join(process.cwd(), 'src/frontend/public/images');

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
                editedBy: rest.editedBy,
                editedAt: rest.editedAt,
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
            // Ensure every image is tagged 'All' so it's always reachable
            // from the default picker view even if the editor cleared the tags.
            const tags = Array.isArray(image.tags) ? image.tags.filter(Boolean) as string[] : [];
            const withAll = tags.includes('All') ? tags : ['All', ...tags];
            const result = await this.imagesDB.insertOne({...image, tags: withAll});
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error saving image:', err);
            await this.setupClient();
            return '';
        }
    }

    /**
     * Walk the on-disk images folder and insert a DB record for any file
     * that's missing one. Lets the editor recover images that survived a
     * bundle import's `deleteMany({})` but lost their Mongo metadata.
     * Returns {added, skipped, total} so the UI can report what happened.
     */
    async rescanDiskImages(editedBy?: string): Promise<{added: number; skipped: number; total: number}> {
        try {
            if (!fs.existsSync(IMAGES_DIR)) return {added: 0, skipped: 0, total: 0};
            const files = fs.readdirSync(IMAGES_DIR).filter(f => IMAGE_EXT.test(f));
            let added = 0;
            let skipped = 0;
            for (const fileName of files) {
                const location = `${PUBLIC_IMAGE_PATH}${fileName}`;
                const existing = await this.imagesDB.findOne({$or: [{location}, {name: fileName}]});
                if (existing) { skipped++; continue; }
                const stat = fs.statSync(path.join(IMAGES_DIR, fileName));
                const ext = path.extname(fileName).slice(1).toLowerCase();
                const image: InImage = {
                    id: guid(),
                    name: fileName,
                    location,
                    created: stat.mtime.toDateString(),
                    type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
                    size: stat.size,
                    tags: ['All'],
                    ...auditStamp(editedBy),
                } as InImage;
                await this.imagesDB.insertOne(image);
                added++;
            }
            return {added, skipped, total: files.length};
        } catch (err) {
            console.error('Error rescanning disk images:', err);
            await this.setupClient();
            return {added: 0, skipped: 0, total: 0};
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
            const query = !tags || tags === 'All'
                ? {}
                : {tags: {$regex: tags, $options: 'i'}};
            return await this.imagesDB.find(query).toArray() as unknown as IImage[];
        } catch (err) {
            console.error('Error getting images:', err);
            await this.setupClient();
            return [];
        }
    }
}
