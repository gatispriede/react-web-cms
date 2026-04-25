import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IArchitectureTiers} from "./ArchitectureTiers.types";
export type {IArchitectureTiers, IArchitectureTier, IArchitectureLifecycleStep} from "./ArchitectureTiers.types";
export {EArchitectureTiersStyle} from "./ArchitectureTiers.types";

const defaults: IArchitectureTiers = {tiers: []};

export class ArchitectureTiersContent extends ContentManager {
    public _parsedContent: IArchitectureTiers = {...defaults};
    get data(): IArchitectureTiers {
        this.parse();
        return {...defaults, ...this._parsedContent, tiers: this._parsedContent?.tiers ?? []};
    }
    set data(v: IArchitectureTiers) { this._parsedContent = v; }
    setField<K extends keyof IArchitectureTiers>(k: K, v: IArchitectureTiers[K]) { this._parsedContent[k] = v; }
}

const ArchitectureTiers = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ArchitectureTiersContent(EItemType.ArchitectureTiers, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const tiers = c.tiers ?? [];
    const lifecycle = c.lifecycleSteps ?? [];

    return (
        <RevealOnScroll className={`arch-tiers ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="arch-tiers__head">
                    {c.eyebrow && <div className="arch-tiers__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 id={slugifyAnchor(c.title)} className="arch-tiers__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="arch-tiers__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}

            {c.intro && (
                <div className="arch-tiers__intro">
                    <div className="arch-tiers__intro-label">DESIGN AIM</div>
                    <div className="arch-tiers__intro-body">{tr(c.intro)}</div>
                </div>
            )}

            {tiers.length > 0 && (
                <div className="arch-tiers__row">
                    {tiers.map((t, i) => (
                        <div key={i} className="arch-tiers__card">
                            <div className="arch-tiers__card-head">
                                {t.ord && <span className="arch-tiers__ord">{t.ord}</span>}
                                {t.concern && <span className="arch-tiers__concern">{tr(t.concern)}</span>}
                            </div>
                            {t.role && <div className="arch-tiers__role">{tr(t.role)}</div>}
                            <div className="arch-tiers__card-title">{tr(t.title)}</div>
                            {t.description && (
                                <p className="arch-tiers__card-desc">{tr(t.description)}</p>
                            )}
                            {t.pills && t.pills.length > 0 && (
                                <div className="arch-tiers__pills">
                                    {t.pills.map((p, j) => (
                                        <span key={j} className="arch-tiers__pill">{tr(p)}</span>
                                    ))}
                                </div>
                            )}
                            {t.modules && t.modules.length > 0 && (
                                <ul className="arch-tiers__modules">
                                    {t.modules.map((m, j) => (
                                        <li key={j}>
                                            <b>{tr(m.label)}</b>
                                            {m.tag && <span className="arch-tiers__module-tag">{tr(m.tag)}</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {(c.sharedTitle || c.sharedDescription) && (
                <div className="arch-tiers__shared">
                    {c.sharedTitle && <div className="arch-tiers__shared-title">{tr(c.sharedTitle)}</div>}
                    {c.sharedDescription && <div className="arch-tiers__shared-desc">{tr(c.sharedDescription)}</div>}
                    {c.sharedPills && c.sharedPills.length > 0 && (
                        <div className="arch-tiers__pills">
                            {c.sharedPills.map((p, j) => (
                                <span key={j} className="arch-tiers__pill">{tr(p)}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {lifecycle.length > 0 && (
                <div className="arch-tiers__lifecycle">
                    {(c.lifecycleLabel || c.lifecycleNote) && (
                        <div className="arch-tiers__lifecycle-head">
                            {c.lifecycleLabel && <div className="arch-tiers__lifecycle-label">{tr(c.lifecycleLabel)}</div>}
                            {c.lifecycleNote && <div className="arch-tiers__lifecycle-note">{tr(c.lifecycleNote)}</div>}
                        </div>
                    )}
                    <div className="arch-tiers__lifecycle-rail">
                        {lifecycle.map((s, i) => (
                            <div key={i} className={`arch-tiers__lifecycle-step${s.highlight ? ' is-hl' : ''}`}>
                                <div className="arch-tiers__lifecycle-n">{s.n}</div>
                                <div className="arch-tiers__lifecycle-title">{tr(s.title)}</div>
                                {s.sub && <div className="arch-tiers__lifecycle-sub">{tr(s.sub)}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </RevealOnScroll>
    );
};

export default ArchitectureTiers;
