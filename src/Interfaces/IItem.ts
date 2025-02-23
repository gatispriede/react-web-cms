import {EItemType} from "../enums/EItemType";

export interface IItem {
    name?: string;
    type: EItemType;
    style: string;
    content: string;
    action?: string;
    actionType?: EItemType
    actionContent?: string
}