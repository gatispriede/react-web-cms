import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IProjectGrid} from "./ProjectGrid.types";
export type {IProjectGrid, IProjectGridItem} from "./ProjectGrid.types";
export {EProjectGridStyle} from "./ProjectGrid.types";

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
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    return (
        <section className={`project-grid ${item.style ?? ''}`}>
            {(c.sectionNumber || c.sectionTitle || c.sectionSubtitle) && (
                <header className="project-grid__head">
                    {c.sectionNumber && <div className="project-grid__num">{tr(c.sectionNumber)}</div>}
                    {c.sectionTitle && (
                        <h2 id={slugifyAnchor(c.sectionTitle)} className="project-grid__title">{renderAccentRuns(c.sectionTitle, trStr)}</h2>
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
                                {p.kind && <div className="project-grid__kind" dangerouslySetInnerHTML={{__html: trStr(p.kind)}}/>}
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
