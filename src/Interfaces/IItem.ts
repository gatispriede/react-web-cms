import {EItemType} from "../enums/EItemType";

export interface IItem {
    name?: string;
    type: EItemType;
    content: string;
}