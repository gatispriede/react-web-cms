import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import RevealOnScroll from "../common/RevealOnScroll";

/**
 * Manifesto — a huge display-serif paragraph with inline chip references
 * embedded mid-sentence (Studio design-v2 pattern).
 *
 * Body markup uses three inline helpers, mixed freely with prose:
 *   - `*word*`        → italic-accent (as in Hero / Services)
 *   - `{{chip:KEY:LABEL}}` → a rounded pill with a small `thumb` (text inside
 *                           the chip's left circle) and a body label. The KEY
 *                           picks up any matching entry in `chips[]` for
 *                           colour / thumb text; falls back to using LABEL.
 *
 * An optional `addendum` renders a smaller sans-serif paragraph underneath.
 */
export interface IManifestoChip {
    key: string;
    /** Short text inside the chip's left circle (e.g. "REACT", "JS·TS"). */
    thumb: string;
    /** CSS background for the circle (defaults to bg-inset). */
    color?: string;
}

export interface IManifesto {
    body: string;
    addendum?: string;
    chips?: IManifestoChip[];
}

export enum EManifestoStyle {
    Default = "default",
}

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
            return (
                <span key={i} className={`manifesto__chip`} data-chip-key={key}>
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

const Manifesto = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ManifestoContent(EItemType.Manifesto, item.content).data;
    const tr = (v: string) => translateOrKeep(tApp, v);

    return (
        <section className={`manifesto ${item.style ?? ''}`}>
            {c.body && (
                <RevealOnScroll as="p" className="manifesto__body">
                    {renderBody(c.body, c.chips ?? [], tr)}
                </RevealOnScroll>
            )}
            {c.addendum && (
                <RevealOnScroll as="p" className="manifesto__addendum" delay={120}>
                    {tr(c.addendum)}
                </RevealOnScroll>
            )}
        </section>
    );
};

export default Manifesto;
