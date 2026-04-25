import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import type {IStatsStrip} from "./StatsStrip.types";
export type {IStatsStrip, IStatsStripCell} from "./StatsStrip.types";
export {EStatsStripStyle} from "./StatsStrip.types";

const defaults: IStatsStrip = {cells: []};

export class StatsStripContent extends ContentManager {
    public _parsedContent: IStatsStrip = {...defaults};
    get data(): IStatsStrip {
        this.parse();
        return {...defaults, ...this._parsedContent, cells: this._parsedContent?.cells ?? []};
    }
    set data(v: IStatsStrip) { this._parsedContent = v; }
    setField<K extends keyof IStatsStrip>(k: K, v: IStatsStrip[K]) { this._parsedContent[k] = v; }
}

const StatsStrip = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new StatsStripContent(EItemType.StatsStrip, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const cells = c.cells ?? [];
    if (cells.length === 0) return null;

    return (
        <RevealOnScroll className={`stats-strip ${item.style ?? ''}`}>
            <div className="stats-strip__row">
                {cells.map((cell, i) => (
                    <div key={i} className={`stats-strip__cell${cell.highlight ? ' is-hl' : ''}`}>
                        <div className="stats-strip__v">
                            {cell.value}
                            {cell.unit && <span className="stats-strip__unit">{tr(cell.unit)}</span>}
                        </div>
                        {cell.label && <div className="stats-strip__k">{tr(cell.label)}</div>}
                    </div>
                ))}
            </div>
        </RevealOnScroll>
    );
};

export default StatsStrip;
