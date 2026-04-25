import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IStatsCard} from "./StatsCard.types";
export type {IStatsCard, IStatsCardStat, IStatsCardFeature} from "./StatsCard.types";
export {EStatsCardStyle} from "./StatsCard.types";

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
            {c.title && <h3 id={slugifyAnchor(c.title)} className="stats-card__title">{tr(c.title)}</h3>}
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
