import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {IKeyValueDossier, IKeyValueDossierItem} from "./KeyValueDossier.types";
export type {IKeyValueDossier, IKeyValueDossierItem} from "./KeyValueDossier.types";
export {EKeyValueDossierStyle} from "./KeyValueDossier.types";

const defaults: IKeyValueDossier = {items: []};

export class KeyValueDossierContent extends ContentManager {
    public _parsedContent: IKeyValueDossier = {...defaults};
    get data(): IKeyValueDossier {
        this.parse();
        return {
            ...defaults,
            ...this._parsedContent,
            items: this._parsedContent?.items ?? [],
        };
    }
    set data(v: IKeyValueDossier) { this._parsedContent = v; }
    setField<K extends keyof IKeyValueDossier>(k: K, v: IKeyValueDossier[K]) {
        this._parsedContent[k] = v;
    }
}

const KeyValueDossier = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new KeyValueDossierContent(EItemType.KeyValueDossier, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const items: IKeyValueDossierItem[] = c.items ?? [];
    const editId = item.name || EItemType.KeyValueDossier;
    // `data-variant` attribute drives the per-theme look. Defaults to
    // editorial; admin can pick via item.style → matches EKeyValueDossierStyle.
    const variant = item.style || 'editorial';
    if (items.length === 0) return null;

    return (
        <RevealOnScroll className={`key-value-dossier ${variant}`}>
            <section data-variant={variant} data-testid="key-value-dossier">
                <div className="kvd-root">
                    {c.title && (
                        <h4 className="kvd-title" {...inlineEditAttr(admin, editId, 'title')}>
                            {tr(c.title)}
                        </h4>
                    )}
                    <dl className="kvd-list">
                        {items.map((it, i) => (
                            <div key={i} className="kvd-row" data-testid="kv-row">
                                <dt {...inlineEditAttr(admin, editId, `items.${i}.label`)}>
                                    {tr(it.label)}
                                </dt>
                                <dd {...inlineEditAttr(admin, editId, `items.${i}.value`)}>
                                    {it.href ? (
                                        <a href={it.href}>{tr(it.value)}</a>
                                    ) : tr(it.value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </section>
        </RevealOnScroll>
    );
};

export default KeyValueDossier;
