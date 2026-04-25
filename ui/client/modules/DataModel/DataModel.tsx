import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import type {IDataModel} from "./DataModel.types";
export type {IDataModel, IDataModelField, IDataModelCollection, IDataModelAudit} from "./DataModel.types";
export {EDataModelStyle} from "./DataModel.types";

const defaults: IDataModel = {fields: [], collections: [], audits: []};

export class DataModelContent extends ContentManager {
    public _parsedContent: IDataModel = {...defaults};
    get data(): IDataModel {
        this.parse();
        return {
            ...defaults,
            ...this._parsedContent,
            fields: this._parsedContent?.fields ?? [],
            collections: this._parsedContent?.collections ?? [],
            audits: this._parsedContent?.audits ?? [],
        };
    }
    set data(v: IDataModel) { this._parsedContent = v; }
    setField<K extends keyof IDataModel>(k: K, v: IDataModel[K]) { this._parsedContent[k] = v; }
}

const DataModel = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new DataModelContent(EItemType.DataModel, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    return (
        <RevealOnScroll className={`data-model ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="data-model__head">
                    {c.eyebrow && <div className="data-model__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 className="data-model__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="data-model__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}
            <div className="data-model__body">
                <div className="data-model__table-wrap">
                    {c.tableTitle && <div className="data-model__sub">{tr(c.tableTitle)}</div>}
                    <table className="data-model__table">
                        <thead>
                            <tr>
                                <th>field</th>
                                <th>type</th>
                                <th>nullable</th>
                                <th>notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(c.fields ?? []).map((f, i) => (
                                <tr key={i}>
                                    <td><code>{f.name}</code></td>
                                    <td><span className="data-model__type">{f.type}</span></td>
                                    <td>
                                        <span className={`data-model__pill data-model__pill--${(f.nullable ?? '').toLowerCase()}`}>
                                            {f.nullable ?? '—'}
                                        </span>
                                    </td>
                                    <td>{f.notes ? tr(f.notes) : null}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <aside className="data-model__aside">
                    {c.collectionsTitle && <div className="data-model__sub">{tr(c.collectionsTitle)}</div>}
                    <ul className="data-model__collections">
                        {(c.collections ?? []).map((col, i) => (
                            <li key={i}>
                                <span className="data-model__col-name">{tr(col.name)}</span>
                                {col.count && <span className="data-model__col-count">{tr(col.count)}</span>}
                            </li>
                        ))}
                    </ul>
                    {c.asideNote && <p className="data-model__aside-note">{tr(c.asideNote)}</p>}
                </aside>
            </div>
            {(c.audits?.length ?? 0) > 0 && (
                <div className="data-model__audits">
                    {(c.audits ?? []).map((a, i) => (
                        <div key={i} className="data-model__audit">
                            {a.tag && <div className="data-model__audit-tag">{tr(a.tag)}</div>}
                            <div className="data-model__audit-title">{tr(a.title)}</div>
                            <div className="data-model__audit-body">{tr(a.body)}</div>
                        </div>
                    ))}
                </div>
            )}
        </RevealOnScroll>
    );
};

export default DataModel;
