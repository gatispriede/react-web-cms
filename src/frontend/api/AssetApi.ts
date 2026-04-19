import {resolve} from "../gqty";
import {ILogo} from "../../Interfaces/ILogo";
import IImage, {InImage} from "../../Interfaces/IImage";
import {refreshBus} from "../lib/refreshBus";

export class AssetApi {
    async getLogo(): Promise<ILogo> {
        return await resolve(({query}) => {
            const logo = query.mongo.getLogo;
            if (!logo) return {type: '', content: '', id: ''};
            return {
                type: logo.type ?? undefined,
                content: logo.content,
                id: logo.id ?? undefined,
                editedBy: logo.editedBy ?? undefined,
                editedAt: logo.editedAt ?? undefined,
            };
        });
    }

    async saveLogo(content: string): Promise<void> {
        await resolve(({mutation}) => mutation.mongo.saveLogo({content}));
        refreshBus.emit('settings');
    }

    async saveImage(image: InImage): Promise<any> {
        const r = await resolve(({mutation}) => mutation.mongo.saveImage({image}));
        refreshBus.emit('assets');
        return r;
    }

    async deleteImage(id: string): Promise<any> {
        const r = await resolve(({mutation}) => mutation.mongo.deleteImage({id}));
        refreshBus.emit('assets');
        return r;
    }

    async rescanDiskImages(): Promise<{added: number; skipped: number; total: number}> {
        const res = await fetch('/api/rescan-images', {method: 'POST'});
        const body = await res.json().catch(() => ({}));
        refreshBus.emit('assets');
        return {added: body?.added ?? 0, skipped: body?.skipped ?? 0, total: body?.total ?? 0};
    }

    async getImages(tags: string): Promise<IImage[]> {
        return await resolve(({query}) => {
            return query.mongo.getImages({tags}).map(image => ({
                created: image.created,
                id: image.id,
                location: image.location,
                name: image.name,
                size: image.size,
                tags: image.tags,
                type: image.type,
            }));
        });
    }
}

export default AssetApi;
