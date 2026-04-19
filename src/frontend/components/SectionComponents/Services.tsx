import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import {InlineTranslatable} from "../common/InlineTranslatable";
import RevealOnScroll from "../common/RevealOnScroll";

export interface IServiceRow {
    number: string;
    title: string;
    description: string;
    ctaLabel?: string;
    ctaHref?: string;
    /** Short text/emoji glyph rendered inside a bordered icon square (Industrial grid style). */
    iconGlyph?: string;
    /** Tag chips shown on the card (Industrial grid style). */
    tags?: string[];
}

export interface IServices {
    /** Small mono label above the title (e.g. "§ 03"). Optional. */
    sectionNumber?: string;
    /** Display heading. Words wrapped in `*asterisks*` render as italic-accent. */
    sectionTitle?: string;
    /** Right-aligned short description shown next to the title. Optional. */
    sectionSubtitle?: string;
    rows: IServiceRow[];
}

export enum EServicesStyle {
    Default = "default",
    /** Numbered rows (design-v2 "What I do" layout). */
    Numbered = "numbered",
    /** 3-col card grid with icon + tags (design-v4 Industrial). */
    Grid = "grid",
}

const defaults: IServices = {rows: []};

export class ServicesContent extends ContentManager {
    public _parsedContent: IServices = {...defaults};
    get data(): IServices {
        this.parse();
        return {...defaults, ...this._parsedContent, rows: this._parsedContent?.rows ?? []};
    }
    set data(v: IServices) { this._parsedContent = v; }
    setField<K extends keyof IServices>(k: K, v: IServices[K]) { this._parsedContent[k] = v; }
}

/**
 * Render a string with `*italic-accent*` emphasis runs. Keeps the plain
 * string schema so content is easy to author — no richtext editor needed —
 * while still supporting the design's "Solutions *architecture*" treatment.
 */
function renderAccentRuns(text: string, tr: (s: string) => string): React.ReactNode {
    const translated = tr(text);
    const parts = translated.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={i} className="em-accent">{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

const Services = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new ServicesContent(EItemType.Services, item.content).data;
    // trStr: string-returning, used inside renderAccentRuns which splits on
    // the translated value. tr: JSX-returning, wraps the string in
    // `<InlineTranslatable>` so Alt-click editors can find it.
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    return (
        <section className={`services-module ${item.style ?? ''}`}>
            {(c.sectionNumber || c.sectionTitle || c.sectionSubtitle) && (
                <header className="services-module__head">
                    {c.sectionNumber && <div className="services-module__num">{tr(c.sectionNumber)}</div>}
                    {c.sectionTitle && (
                        <h2 className="services-module__title">{renderAccentRuns(c.sectionTitle, trStr)}</h2>
                    )}
                    {c.sectionSubtitle && (
                        <div className="services-module__sub">{tr(c.sectionSubtitle)}</div>
                    )}
                </header>
            )}
            <div className="services-module__rows">
                {c.rows.map((r, i) => (
                    <RevealOnScroll key={i} className="services-module__row" delay={i * 60}>
                        {r.iconGlyph && (
                            <div className="services-module__row-icon" aria-hidden>{r.iconGlyph}</div>
                        )}
                        <div className="services-module__row-num">{tr(r.number)}</div>
                        <h3 className="services-module__row-title">{renderAccentRuns(r.title, trStr)}</h3>
                        <div className="services-module__row-desc">{tr(r.description)}</div>
                        {r.tags && r.tags.length > 0 && (
                            <div className="services-module__row-tags">
                                {r.tags.map((tag, j) => (
                                    <span key={j} className="services-module__tag">{tr(tag)}</span>
                                ))}
                            </div>
                        )}
                        {r.ctaLabel && (
                            <div className="services-module__row-cta">
                                {r.ctaHref
                                    ? <a href={r.ctaHref}>{tr(r.ctaLabel)}&nbsp;<span className="services-module__arr">→</span></a>
                                    : <span>{tr(r.ctaLabel)}&nbsp;<span className="services-module__arr">→</span></span>
                                }
                            </div>
                        )}
                    </RevealOnScroll>
                ))}
            </div>
        </section>
    );
};

export default Services;
