import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import type {IList} from "./List.types";
import {EListStyle} from "./List.types";
export type {IList, IListItem} from "./List.types";
export {EListStyle} from "./List.types";

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
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const style = item.style || EListStyle.Default;
    const isFacts = style === EListStyle.Facts;
    const isCases = style === EListStyle.Cases;
    const isPaperGrid = style === EListStyle.PaperGrid;

    return (
        <RevealOnScroll className={`list-module ${style}`}>
            {c.title && <div id={slugifyAnchor(c.title)} className="list-module__title">{tr(c.title)}</div>}
            {isPaperGrid ? (
                <div className="list-module__paper-grid">
                    {c.items.map((it, i) => {
                        const ord = it.prefix || String(i + 1).padStart(2, '0');
                        return (
                            <div key={i} className="list-module__pg-card">
                                <div className="list-module__pg-ord">{tr(ord)}</div>
                                <div className="list-module__pg-label">{tr(it.label)}</div>
                                {it.meta && <div className="list-module__pg-meta">{tr(it.meta)}</div>}
                                {it.value && (
                                    <p className="list-module__pg-value">
                                        {it.href
                                            ? <a href={it.href} rel="noopener">{tr(it.value)}</a>
                                            : tr(it.value)}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : isCases ? (
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
