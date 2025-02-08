import {JSX} from "react";
import {IItem} from "./IItem";

export interface IContentTypeProps {
    item: IItem,
    addButton: JSX.Element | string,
    admin: boolean,
}