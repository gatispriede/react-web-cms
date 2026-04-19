import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "../common/InlineTranslatable";
import RevealOnScroll from "../common/RevealOnScroll";

export interface IStatsCardStat {
    value: string;
    label: string;
}

export interface IStatsCardFeature {
    text: string;
}

export interface IStatsCard {
    /** Small pill label above the title (e.g. "KOPSAVILKUMS", "SUMMARY"). */
    tag?: string;
    /** Card heading. */
    title?: string;
    /** 2×N stat grid — each stat: big accent number + small mono label. */
    stats: IStatsCardStat[];
    /** Optional checklist below the stat grid — accent checkmark + feature line. */
    features?: IStatsCardFeature[];
}

export enum EStatsCardStyle {
    Default = "default",
    /** Industrial panel — dark panel, yellow accent rule on the left. */
    Panel = "panel",
}

const defaults: IStatsCard = {stats: []};

export class StatsCardContent extends ContentManager {
    public _parsedContent: IStatsCard = {...defaults};
    get data(): IStatsCard {
        this.parse();
        return {...defaults, ...this._parsedContent, stats: this._parsedContent?.stats ?? [], features: this._parsedContent?.features ?? []};
    }
    set data(v: IStatsCard) { this._parsedContent = v; }
    setField<K extends keyof IStatsCard>(k: K, v: IStatsCard[K]) { this._parsedContent[k] = v; }
}

const StatsCard = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new StatsCardContent(EItemType.StatsCard, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    return (
        <RevealOnScroll className={`stats-card ${item.style ?? ''}`}>
            {c.tag && <div className="stats-card__tag">{tr(c.tag)}</div>}
            {c.title && <h3 className="stats-card__title">{tr(c.title)}</h3>}
            {c.stats.length > 0 && (
                <div className="stats-card__grid">
                    {c.stats.map((s, i) => (
                        <div key={i} className="stats-card__stat">
                            <div className="stats-card__n">{tr(s.value)}</div>
                            <div className="stats-card__l">{tr(s.label)}</div>
                        </div>
                    ))}
                </div>
            )}
            {c.features && c.features.length > 0 && (
                <ul className="stats-card__features">
                    {c.features.map((f, i) => (
                        <li key={i}>{tr(f.text)}</li>
                    ))}
                </ul>
            )}
        </RevealOnScroll>
    );
};

export default StatsCard;
