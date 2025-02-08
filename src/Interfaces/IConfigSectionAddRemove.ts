import {EItemType} from "../enums/EItemType";

export interface IConfigSectionAddRemove {
    index: number
    type: EItemType
    content: string,
    actionType: EItemType,
    actionContent: string,
}