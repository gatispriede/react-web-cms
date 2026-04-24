export interface IPlainImage {
    src: string;
    description: string;
    alt: string;
    height: number;
    useAsBackground: boolean;
    imageFixed: boolean;
    useGradiant: boolean;
    offsetX: number;
    imgWidth: string;
    imgHeight: string;
    preview: boolean;
}

export enum EImageStyle {
    Default = "default"
}
