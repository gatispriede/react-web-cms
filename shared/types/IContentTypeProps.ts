import {JSX} from "react";
import {IItem} from "./IItem";
import {TFunction} from "i18next";

export interface IContentTypeProps {
    item: IItem,
    addButton: JSX.Element | string,
    admin: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}