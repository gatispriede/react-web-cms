import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import type {ITimeline} from "./Timeline.types";
export type {ITimeline, ITimelineEntry} from "./Timeline.types";
export {ETimelineStyle} from "./Timeline.types";

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
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const trStr = (v: string) => translateOrKeep(tApp, v);

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
                                {e.domain && <> <span className="timeline__domain">{e.domain}</span></>}
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
                                                <h5>{tr(e.experienceTitle && e.experienceTitle.trim() ? e.experienceTitle : trStr('Experience in'))}</h5>
                                                <ul>
                                                    {e.experience.map((x, j) => <li key={j}>{tr(x)}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {e.achievements && e.achievements.length > 0 && (
                                            <div>
                                                <h5>{tr(e.achievementsTitle && e.achievementsTitle.trim() ? e.achievementsTitle : trStr('Key achievements'))}</h5>
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
