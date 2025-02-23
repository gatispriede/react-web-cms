import {EItemType} from "../enums/EItemType";

export interface IConfigSectionAddRemove {
    index: number
    type: EItemType
    style: string,
    content: string,
    action?: string,
    actionStyle?: string,
    actionType?: EItemType,
    actionContent?: string,
}