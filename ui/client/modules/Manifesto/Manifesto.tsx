import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {IManifesto, IManifestoChip} from "./Manifesto.types";
export type {IManifesto, IManifestoChip} from "./Manifesto.types";
export {EManifestoStyle} from "./Manifesto.types";

const defaults: IManifesto = {body: '', addendum: '', chips: []};

export class ManifestoContent extends ContentManager {
    public _parsedContent: IManifesto = {...defaults};
    get data(): IManifesto {
        this.parse();
        return {...defaults, ...this._parsedContent, chips: this._parsedContent?.chips ?? []};
    }
    set data(v: IManifesto) { this._parsedContent = v; }
    setField<K extends keyof IManifesto>(k: K, v: IManifesto[K]) { this._parsedContent[k] = v; }
}

/**
 * Tokenise the manifesto body into plain-text, italic-accent, and chip runs.
 * Regex captures either an `*italic*` pair or a `{{chip:…}}` token in one pass
 * so nested / overlapping forms can't accidentally collide.
 */
function renderBody(body: string, chips: IManifestoChip[], tr: (s: string) => string): React.ReactNode {
    const chipByKey = new Map(chips.map(c => [c.key, c]));
    const translated = tr(body);
    const tokens = translated.split(/(\*[^*]+\*|\{\{chip:[^}]+\}\})/g);
    return tokens.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={i} className="em-accent">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('{{chip:') && part.endsWith('}}')) {
            const inner = part.slice(7, -2);
            const [key, ...labelParts] = inner.split(':');
            const label = labelParts.join(':');
            const chip = chipByKey.get(key);
            // C13b — chip = the addressable unit inside a manifesto body.
            // The DOM id mirrors the slug rule the AnchorRegistry uses
            // (`manifesto-chip-${slugifyAnchor(key)}`) so deep-links of
            // the form `/about#manifesto-chip-react` resolve via native
            // hash-scroll without extra JavaScript.
            const anchorId = `manifesto-chip-${slugifyAnchor(key)}`;
            return (
                <span
                    key={i}
                    id={anchorId}
                    className={`manifesto__chip`}
                    data-chip-key={key}
                    data-testid={`manifesto-chip-${slugifyAnchor(key)}`}
                    style={{scrollMarginTop: 80}}
                >
                    <span className="manifesto__chip-thumb" style={chip?.color ? {background: chip.color} : undefined}>
                        {chip?.thumb ?? key}
                    </span>
                    {label}
                </span>
            );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

const Manifesto = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new ManifestoContent(EItemType.Manifesto, item.content).data;
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const editId = item.name || EItemType.Manifesto;

    return (
        <section className={`manifesto ${item.style ?? ''}`}>
            {c.body && (
                <RevealOnScroll as="p" className="manifesto__body" {...inlineEditAttr(admin, editId, 'body')}>
                    {renderBody(c.body, c.chips ?? [], trStr)}
                </RevealOnScroll>
            )}
            {c.addendum && (
                <RevealOnScroll as="p" className="manifesto__addendum" delay={120} {...inlineEditAttr(admin, editId, 'addendum')}>
                    {tr(c.addendum)}
                </RevealOnScroll>
            )}
        </section>
    );
};

export default Manifesto;
