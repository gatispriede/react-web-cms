import React from "react";
import {Tag} from "antd";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {sanitizeKey} from "../../../utils/stringFunctions";
import RevealOnScroll from "../common/RevealOnScroll";

export interface ISkillPills {
    category: string;
    items: string[];
}

export enum ESkillPillsStyle {
    Default = "default",
    Compact = "compact",
}

const defaults: ISkillPills = {category: '', items: []};

export class SkillPillsContent extends ContentManager {
    public _parsedContent: ISkillPills = {...defaults};
    get data(): ISkillPills {
        this.parse();
        return {...defaults, ...this._parsedContent, items: this._parsedContent?.items ?? []};
    }
    set data(v: ISkillPills) { this._parsedContent = v; }
    setField<K extends keyof ISkillPills>(k: K, v: ISkillPills[K]) { this._parsedContent[k] = v; }
}

const SkillPills = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new SkillPillsContent(EItemType.SkillPills, item.content).data;
    const tr = (v: string) => v ? tApp(sanitizeKey(v)) : '';
    return (
        <RevealOnScroll className={`skill-pills ${item.style ?? ''}`}>
            {c.category && <div className="skill-pills__category">{tr(c.category)}</div>}
            <div className="skill-pills__list">
                {c.items.map((it, i) => (
                    <Tag key={i} color="geekblue" style={{transitionDelay: `${i * 30}ms`}}>{tr(it)}</Tag>
                ))}
            </div>
        </RevealOnScroll>
    );
};

export default SkillPills;
