import React from "react";
import {Tag} from "antd";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {ISkillPills, ISkillPillItem} from "./SkillPills.types";
import {ESkillPillsStyle} from "./SkillPills.types";
export type {ISkillPills, ISkillPillItem} from "./SkillPills.types";
export {ESkillPillsStyle} from "./SkillPills.types";

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

const normaliseItem = (raw: string | ISkillPillItem): ISkillPillItem =>
    typeof raw === 'string'
        ? {label: raw}
        : {label: raw.label ?? '', score: raw.score, featured: raw.featured, category: raw.category};

const SkillPills = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new SkillPillsContent(EItemType.SkillPills, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const isMatrix = item.style === ESkillPillsStyle.Matrix;
    const isStackGrid = item.style === ESkillPillsStyle.StackGrid;
    const editId = item.name || EItemType.SkillPills;

    return (
        <RevealOnScroll className={`skill-pills ${item.style ?? ''}`}>
            {c.category && (
                <div className="skill-pills__category">
                    <span {...inlineEditAttr(admin, editId, 'category')}>{tr(c.category)}</span>
                    {c.categoryMeta && <span className="skill-pills__category-meta" {...inlineEditAttr(admin, editId, 'categoryMeta')}>{tr(c.categoryMeta)}</span>}
                </div>
            )}
            {isMatrix ? (
                <div className="skill-pills__matrix">
                    {c.items.map((raw, i) => {
                        const it = normaliseItem(raw);
                        const pct = Math.max(0, Math.min(10, typeof it.score === 'number' ? it.score : 0)) * 10;
                        return (
                            <div
                                key={i}
                                className="skill-pills__row"
                                data-featured={it.featured ? '1' : '0'}
                                style={{
                                    // Drives the bar fill via CSS animation.
                                    ['--skill-pills-w' as any]: `${pct}%`,
                                    ['--skill-pills-d' as any]: `${i * 0.05}s`,
                                }}
                            >
                                <span className="skill-pills__label" {...inlineEditAttr(admin, editId, `items.${i}.label`)}>{tr(it.label)}</span>
                                <span className="skill-pills__bar"/>
                                <span className="skill-pills__score">{typeof it.score === 'number' ? it.score.toFixed(1) : ''}</span>
                            </div>
                        );
                    })}
                </div>
            ) : isStackGrid ? (
                <div className="skill-pills__stack-grid">
                    {c.items.map((raw, i) => {
                        const it = normaliseItem(raw);
                        return (
                            <div
                                key={i}
                                className="skill-pills__stack-cell"
                                data-featured={it.featured ? '1' : '0'}
                            >
                                {it.category && (
                                    <div className="skill-pills__stack-cat" {...inlineEditAttr(admin, editId, `items.${i}.category`)}>{tr(it.category)}</div>
                                )}
                                <div className="skill-pills__stack-name" {...inlineEditAttr(admin, editId, `items.${i}.label`)}>{tr(it.label)}</div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="skill-pills__list">
                    {c.items.map((raw, i) => {
                        const it = normaliseItem(raw);
                        return (
                            <Tag key={i} color="geekblue" style={{transitionDelay: `${i * 30}ms`}} {...inlineEditAttr(admin, editId, `items.${i}.label`)}>{tr(it.label)}</Tag>
                        );
                    })}
                </div>
            )}
        </RevealOnScroll>
    );
};

export default SkillPills;
