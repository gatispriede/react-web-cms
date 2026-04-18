import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";

export interface ITimelineEntry {
    start: string;
    end: string;
    company: string;
    role: string;
    location?: string;
    achievements?: string[];
}

export interface ITimeline {
    entries: ITimelineEntry[];
}

export enum ETimelineStyle {
    Default = "default",
    Alternating = "alternating",
}

const defaults: ITimeline = {entries: []};

export class TimelineContent extends ContentManager {
    public _parsedContent: ITimeline = {...defaults};
    get data(): ITimeline {
        this.parse();
        return {entries: this._parsedContent?.entries ?? []};
    }
    set data(v: ITimeline) { this._parsedContent = v; }
    setField<K extends keyof ITimeline>(k: K, v: ITimeline[K]) { this._parsedContent[k] = v; }
}

const Timeline = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new TimelineContent(EItemType.Timeline, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);
    return (
        <div className={`timeline ${item.style ?? ''}`}>
            {c.entries.map((e, i) => (
                <RevealOnScroll key={i} className="timeline__entry" delay={i * 80}>
                    <div className="timeline__when">
                        {tr(e.start)} {e.end && <>— {tr(e.end)}</>}
                        {e.location && <> · {tr(e.location)}</>}
                    </div>
                    <div className="timeline__who">{tr(e.company)}</div>
                    <div className="timeline__role">{tr(e.role)}</div>
                    {e.achievements && e.achievements.length > 0 && (
                        <ul className="timeline__achievements">
                            {e.achievements.map((a, j) => <li key={j}>{tr(a)}</li>)}
                        </ul>
                    )}
                </RevealOnScroll>
            ))}
        </div>
    );
};

export default Timeline;
