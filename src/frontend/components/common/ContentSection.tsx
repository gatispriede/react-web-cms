import React from "react";
import {TFunction} from "i18next";
import {getItemTypeDefinition} from "../itemTypes/registry";

export const ContentSection = ({selected, content, setContent, t}: {
    content: string,
    selected: string,
    setContent: (value: string) => void,
    t: TFunction<"translation", undefined>
}) => {
    const def = getItemTypeDefinition(selected);
    if (!def) return <></>;
    const {Editor} = def;
    return <Editor t={t} content={content} setContent={setContent}/>;
};
