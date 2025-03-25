import {InputMaybe} from "../frontend/gqty/schema.generated";
import {Maybe} from "graphql/jsutils/Maybe";

export interface IImage {
    id: string
    name: string
    location: string
    created: string
    type: string
    size: number
    tags: Maybe<string>[]
}
export interface InImage {
    created: string;
    id: string;
    location: string;
    name: string;
    size: number;
    tags: InputMaybe<InputMaybe<string>[]> | undefined;
    type: string;
}
export default IImage