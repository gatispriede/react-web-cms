import {ISeo} from "./ISeo";

export interface INavigation {
    id: string
    type: string;
    page: string,
    seo: ISeo,
    sections: string[]
}