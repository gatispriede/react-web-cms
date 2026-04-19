import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";

export interface IProjectGridItem {
    /** Project name shown under the cover. */
    title: string;
    /** Short stack / domain string under the title. */
    stack?: string;
    /** 2-line sublabel on the right (e.g. "Contract<br/>UK / USA"). */
    kind?: string;
    /** Year or range shown on the cover pill (e.g. "2024 — PRESENT"). */
    year?: string;
    /** Short letters rendered inside the cover (e.g. "SC"). Defaults to first 2 chars of title. */
    coverArt?: string;
    /** CSS `background` value for the cover (gradient, image URL, etc.). */
    coverColor?: string;
    /** "View engagement ↗" label at the bottom. */
    moreLabel?: string;
    /** Project detail URL. */
    href?: string;
}

export interface IProjectGrid {
    /** Section head — title / sub / number (matches Studio s-head treatment). */
    sectionNumber?: string;
    sectionTitle?: string;
    sectionSubtitle?: string;
    items: IProjectGridItem[];
}

export enum EProjectGridStyle {
    Default = "default",
    /** Studio — 2-col cards with colored gradient covers + art letters. */
    Studio = "studio",
}

const defaults: IProjectGrid = {items: []};

export class ProjectGridContent extends ContentManager {
    public _parsedContent: IProjectGrid = {...defaults};
    get data(): IProjectGrid {
        this.parse();
        return {...defaults, ...this._parsedContent, items: this._parsedContent?.items ?? []};
    }
    set data(v: IProjectGrid) { this._parsedContent = v; }
    setField<K extends keyof IProjectGrid>(k: K, v: IProjectGrid[K]) { this._parsedContent[k] = v; }
}

/** Same `*word*` italic-accent run renderer used by Hero / Services / Testimonials. */
function renderAccentRuns(text: string, tr: (s: string) => string): React.ReactNode {
    const translated = tr(text);
    return translated.split(/(\*[^*]+\*)/g).map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={i} className="em-accent">{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

const ProjectGrid = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ProjectGridContent(EItemType.ProjectGrid, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);

    return (
        <section className={`project-grid ${item.style ?? ''}`}>
            {(c.sectionNumber || c.sectionTitle || c.sectionSubtitle) && (
                <header className="project-grid__head">
                    {c.sectionNumber && <div className="project-grid__num">{tr(c.sectionNumber)}</div>}
                    {c.sectionTitle && (
                        <h2 className="project-grid__title">{renderAccentRuns(c.sectionTitle, tr)}</h2>
                    )}
                    {c.sectionSubtitle && (
                        <div className="project-grid__sub">{tr(c.sectionSubtitle)}</div>
                    )}
                </header>
            )}
            <div className="project-grid__items">
                {c.items.map((p, i) => {
                    const art = p.coverArt ?? (p.title ?? '').slice(0, 2).toUpperCase();
                    const inner = (
                        <>
                            <div
                                className="project-grid__cover"
                                style={p.coverColor ? {background: p.coverColor} : undefined}
                            >
                                {p.year && <span className="project-grid__year">{tr(p.year)}</span>}
                                <span className="project-grid__art" aria-hidden>{art}</span>
                            </div>
                            <div className="project-grid__meta">
                                <div className="project-grid__meta-main">
                                    <h3 className="project-grid__card-title">{tr(p.title)}</h3>
                                    {p.stack && <div className="project-grid__stack">{tr(p.stack)}</div>}
                                </div>
                                {p.kind && <div className="project-grid__kind" dangerouslySetInnerHTML={{__html: tr(p.kind)}}/>}
                            </div>
                            {p.moreLabel && (
                                <div className="project-grid__more">{tr(p.moreLabel)}</div>
                            )}
                        </>
                    );
                    return (
                        <RevealOnScroll key={i} className="project-grid__item-wrap" delay={i * 60}>
                            {p.href
                                ? <a className="project-grid__item" href={p.href}>{inner}</a>
                                : <div className="project-grid__item">{inner}</div>
                            }
                        </RevealOnScroll>
                    );
                })}
            </div>
        </section>
    );
};

export default ProjectGrid;
