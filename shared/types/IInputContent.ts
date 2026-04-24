import {TFunction} from "i18next";

export interface IInputContent {
    setContent: (value: string) => void,
    content: string,
    t: TFunction<"translation", undefined>
}