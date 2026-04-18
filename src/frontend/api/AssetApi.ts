import {resolve} from "../gqty";
import {ILogo} from "../../Interfaces/ILogo";
import IImage, {InImage} from "../../Interfaces/IImage";

export class AssetApi {
    async getLogo(): Promise<ILogo> {
        return await resolve(({query}) => {
            const logo = query.mongo.getLogo;
            if (!logo) return {type: '', content: '', id: ''};
            return {
                type: logo.type ?? undefined,
                content: logo.content,
                id: logo.id ?? undefined,
            };
        });
    }

    async saveLogo(content: string): Promise<void> {
        await resolve(({mutation}) => mutation.mongo.saveLogo({content}));
    }

    async saveImage(image: InImage): Promise<any> {
        return await resolve(({mutation}) => mutation.mongo.saveImage({image}));
    }

    async deleteImage(id: string): Promise<any> {
        return await resolve(({mutation}) => mutation.mongo.deleteImage({id}));
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
