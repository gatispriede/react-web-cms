import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IPipelineFlow} from "./PipelineFlow.types";
export type {IPipelineFlow, IPipelineStep} from "./PipelineFlow.types";
export {EPipelineFlowStyle} from "./PipelineFlow.types";

const defaults: IPipelineFlow = {steps: [], sideNotes: []};

export class PipelineFlowContent extends ContentManager {
    public _parsedContent: IPipelineFlow = {...defaults};
    get data(): IPipelineFlow {
        this.parse();
        return {...defaults, ...this._parsedContent, steps: this._parsedContent?.steps ?? [], sideNotes: this._parsedContent?.sideNotes ?? []};
    }
    set data(v: IPipelineFlow) { this._parsedContent = v; }
    setField<K extends keyof IPipelineFlow>(k: K, v: IPipelineFlow[K]) { this._parsedContent[k] = v; }
}

const PipelineFlow = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new PipelineFlowContent(EItemType.PipelineFlow, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const steps = c.steps ?? [];
    const sideNotes = c.sideNotes ?? [];

    return (
        <RevealOnScroll className={`pipeline-flow ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="pipeline-flow__head">
                    {c.eyebrow && <div className="pipeline-flow__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 id={slugifyAnchor(c.title)} className="pipeline-flow__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="pipeline-flow__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}
            <div className={`pipeline-flow__body${sideNotes.length > 0 ? ' has-side' : ''}`}>
                <ol className="pipeline-flow__steps">
                    {steps.map((s, i) => (
                        <li key={i} className="pipeline-flow__step">
                            <div className="pipeline-flow__step-no">{String(i + 1).padStart(2, '0')}</div>
                            <div className="pipeline-flow__step-body">
                                <div className="pipeline-flow__step-row">
                                    <span className="pipeline-flow__step-label">{tr(s.label)}</span>
                                    {s.status && (
                                        <span className={`pipeline-flow__status pipeline-flow__status--${(s.status ?? '').toLowerCase()}`}>
                                            {s.status}
                                        </span>
                                    )}
                                    {s.meta && <span className="pipeline-flow__meta">{tr(s.meta)}</span>}
                                </div>
                                {s.notes && <div className="pipeline-flow__step-notes">{tr(s.notes)}</div>}
                            </div>
                        </li>
                    ))}
                </ol>
                {sideNotes.length > 0 && (
                    <aside className="pipeline-flow__aside">
                        {c.sideNotesLabel && <div className="pipeline-flow__sub">{tr(c.sideNotesLabel)}</div>}
                        <ul>
                            {sideNotes.map((n, i) => <li key={i}>{tr(n)}</li>)}
                        </ul>
                    </aside>
                )}
            </div>
        </RevealOnScroll>
    );
};

export default PipelineFlow;
