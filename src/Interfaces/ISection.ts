import {IItem} from "./IItem";

export interface ISection {
    id?: string;
    type: number,
    page?: string,
    content: IItem[]
}