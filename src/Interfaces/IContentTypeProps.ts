import {EItemType} from "../enums/EItemType";
import {JSX} from "react";

export interface IContentTypeProps {
    type: EItemType,
    content: string,
    addButton: JSX.Element | string,
    admin: boolean,
}