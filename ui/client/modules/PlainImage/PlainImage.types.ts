import {IImageRef} from '@interfaces/IImageRef';

export interface IPlainImage {
    image: IImageRef;
    description: string;
    useAsBackground: boolean;
    imageFixed: boolean;
    useGradiant: boolean;
    offsetX: number;
    preview: boolean;
}

/** Pre-C18 stored shape — kept only for the read-side normaliser. */
export interface IPlainImageLegacy {
    src?: string;
    alt?: string;
    height?: number;
    imgWidth?: string;
    imgHeight?: string;
    description?: string;
    useAsBackground?: boolean;
    imageFixed?: boolean;
    useGradiant?: boolean;
    offsetX?: number;
    preview?: boolean;
    image?: IImageRef;
}

export enum EImageStyle {
    Default = "default",
    Polaroid = "polaroid",
    Cinema = "cinema",
    Vintage = "vintage"
}
