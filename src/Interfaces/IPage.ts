import {ISeo} from "./ISeo";

export interface IPage {
    page: string,
    seo: ISeo,
    sections: string[]
}