import {IImageRef} from "@interfaces/IImageRef";
import {ILinkRef} from "@interfaces/ILinkRef";

/** Pre-C18 alias kept so module-preview fixtures and outside callers still compile. */
export type IProjectLink = ILinkRef;

export interface IProjectCard {
    title: string;
    description: string;
    image: IImageRef;
    tags: string[];
    primaryLink?: ILinkRef;
    secondaryLink?: ILinkRef;
}

/** Pre-C18 stored shape — read-side fallback only. */
export interface IProjectCardLegacy {
    title?: string;
    description?: string;
    image?: string | IImageRef;
    tags?: string[];
    primaryLink?: {url?: string; label?: string} | ILinkRef;
    secondaryLink?: {url?: string; label?: string} | ILinkRef;
}

export enum EProjectCardStyle {
    Default = "default",
    Featured = "featured",
    Polaroid = "polaroid",
    Cinema = "cinema",
    Stack = "stack",
}
