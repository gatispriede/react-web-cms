import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";

/**
 * Generic key/value list module. Rendered shape is driven by per-item style:
 *  - `default` (bulleted list): each item = label · value line.
 *  - `facts` (editorial key/value): mono-caps label left, value (link-optional)
 *    right, dashed rules — Dossier Contact / Signals.
 *  - `inline`: flex-row of label+value chips.
 *  - `cases` (project/case cards): 2-col card grid — each item's `prefix`
 *    renders as a big accent year, `label` as the big title, `meta` as a
 *    mono-caps sub-label, `value` as the description paragraph, `tags[]`
 *    as chip row. Drives the Industrial "projektu kartītes" layout.
 */
export interface IListItem {
    label: string;
    value?: string;
    href?: string;
    /** Accent-coloured prefix shown above the title (e.g. "2024"). */
    prefix?: string;
    /** Small secondary prefix underneath (e.g. "— TAGAD" / "— 2023"). */
    prefixSub?: string;
    /** Small mono/caps sub-label shown under the title. */
    meta?: string;
    /** Chip row rendered under the description. */
    tags?: string[];
}

export interface IList {
    title?: string;
    items: IListItem[];
}

export enum EListStyle {
    Default = "default",
    Facts = "facts",
    Inline = "inline",
    /** 2-col project / case-card grid (Industrial). */
    Cases = "cases",
}

const defaults: IList = {title: '', items: []};

export class ListContent extends ContentManager {
    public _parsedContent: IList = {...defaults};
    get data(): IList {
        this.parse();
        return {...defaults, ...this._parsedContent, items: this._parsedContent?.items ?? []};
    }
    set data(v: IList) { this._parsedContent = v; }
    setField<K extends keyof IList>(k: K, v: IList[K]) { this._parsedContent[k] = v; }
}

const List = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ListContent(EItemType.List, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);
    const style = item.style || EListStyle.Default;
    const isFacts = style === EListStyle.Facts;
    const isCases = style === EListStyle.Cases;

    return (
        <RevealOnScroll className={`list-module ${style}`}>
            {c.title && <div className="list-module__title">{tr(c.title)}</div>}
            {isCases ? (
                <div className="list-module__cases">
                    {c.items.map((it, i) => {
                        const inner = (
                            <>
                                <div className="list-module__case-prefix">
                                    <div className="list-module__case-prefix-main">{tr(it.prefix ?? '')}</div>
                                    {it.prefixSub && (
                                        <div className="list-module__case-prefix-sub">{tr(it.prefixSub)}</div>
                                    )}
                                </div>
                                <div className="list-module__case-body">
                                    <h3 className="list-module__case-title">{tr(it.label)}</h3>
                                    {it.meta && (
                                        <div className="list-module__case-meta">{tr(it.meta)}</div>
                                    )}
                                    {it.value && (
                                        <p className="list-module__case-desc">{tr(it.value)}</p>
                                    )}
                                    {it.tags && it.tags.length > 0 && (
                                        <div className="list-module__case-tags">
                                            {it.tags.map((tag, j) => (
                                                <span key={j} className="list-module__case-tag">{tr(tag)}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                        return it.href
                            ? <a key={i} href={it.href} className="list-module__case" rel="noopener">{inner}</a>
                            : <div key={i} className="list-module__case">{inner}</div>;
                    })}
                </div>
            ) : isFacts ? (
                <dl className="list-module__facts">
                    {c.items.map((it, i) => (
                        <div key={i} className="list-module__facts-row">
                            <dt>{tr(it.label)}</dt>
                            <dd>
                                {it.href
                                    ? <a href={it.href} rel="noopener">{tr(it.value ?? '')}</a>
                                    : tr(it.value ?? '')
                                }
                            </dd>
                        </div>
                    ))}
                </dl>
            ) : (
                <ul className="list-module__items">
                    {c.items.map((it, i) => (
                        <li key={i}>
                            <span className="list-module__label">{tr(it.label)}</span>
                            {it.value && (
                                <span className="list-module__value">
                                    {it.href
                                        ? <a href={it.href} rel="noopener">{tr(it.value)}</a>
                                        : tr(it.value)
                                    }
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </RevealOnScroll>
    );
};

export default List;
