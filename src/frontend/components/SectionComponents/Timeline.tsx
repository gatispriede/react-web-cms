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
    /** Website domain shown after the company, e.g. "scichart.com". */
    domain?: string;
    /** Contract / permanent hint, e.g. "Contract", "Permanent". */
    contractType?: string;
    /** "Experience in" bullets — responsibilities/day-to-day. */
    experience?: string[];
    /** "Key achievements" bullets. */
    achievements?: string[];
    /** Optional pull-quote at the bottom of the detail panel. */
    quote?: string;
}

export interface ITimeline {
    entries: ITimelineEntry[];
}

export enum ETimelineStyle {
    Default = "default",
    Alternating = "alternating",
    Editorial = "editorial",
    /** Collapses the left period column — just renders the body lines inline.
     *  Used for Dossier "Education" where years live inside each body. */
    Minimal = "minimal",
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
            {c.entries.map((e, i) => {
                const hasDetail = Boolean(
                    (e.experience && e.experience.length > 0)
                    || (e.achievements && e.achievements.length > 0)
                    || e.quote,
                );
                return (
                    <RevealOnScroll key={i} className="timeline__entry" delay={i * 80}>
                        <div className="timeline__when">
                            {tr(e.start)} {e.end && <>— {tr(e.end)}</>}
                            {e.location && <span className="timeline__location">{tr(e.location)}</span>}
                        </div>
                        <div className="timeline__body">
                            <h3 className="timeline__who">
                                {tr(e.company)}
                                {e.domain && <span className="timeline__domain">{e.domain}</span>}
                            </h3>
                            <div className="timeline__role">
                                <b>{tr(e.role)}</b>
                                {e.contractType && <> · {tr(e.contractType)}</>}
                            </div>

                            {hasDetail && (
                                <div className="timeline__detail">
                                    <div className="timeline__detail-grid">
                                        {e.experience && e.experience.length > 0 && (
                                            <div>
                                                <h5>Experience in</h5>
                                                <ul>
                                                    {e.experience.map((x, j) => <li key={j}>{tr(x)}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {e.achievements && e.achievements.length > 0 && (
                                            <div>
                                                <h5>Key achievements</h5>
                                                <ul>
                                                    {e.achievements.map((a, j) => <li key={j}>{tr(a)}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {e.quote && (
                                            <div className="timeline__quote">“{tr(e.quote)}”</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </RevealOnScroll>
                );
            })}
        </div>
    );
};

export default Timeline;
