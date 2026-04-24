export interface IProjectLink {
    url: string;
    label: string;
}

export interface IProjectCard {
    title: string;
    description: string;
    image: string;
    tags: string[];
    primaryLink?: IProjectLink;
    secondaryLink?: IProjectLink;
}

export enum EProjectCardStyle {
    Default = "default",
    Featured = "featured",
}
