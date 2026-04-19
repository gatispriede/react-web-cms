import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "../../../utils/translateOrKeep";
import {InlineTranslatable} from "../common/InlineTranslatable";
import RevealOnScroll from "../common/RevealOnScroll";

export interface ITestimonial {
    quote: string;
    name: string;
    role?: string;
    /** Single-letter avatar glyph (defaults to first character of `name`). */
    avatarInitial?: string;
}

export interface ITestimonials {
    /** Display heading. Supports `*italic accent*` runs. */
    sectionTitle?: string;
    /** Short paragraph next to the heading (right column on wide viewports). */
    sectionSubtitle?: string;
    items: ITestimonial[];
}

export enum ETestimonialsStyle {
    Default = "default",
    /** 3-col card grid (design-v2). */
    Cards = "cards",
}

const defaults: ITestimonials = {items: []};

export class TestimonialsContent extends ContentManager {
    public _parsedContent: ITestimonials = {...defaults};
    get data(): ITestimonials {
        this.parse();
        return {...defaults, ...this._parsedContent, items: this._parsedContent?.items ?? []};
    }
    set data(v: ITestimonials) { this._parsedContent = v; }
    setField<K extends keyof ITestimonials>(k: K, v: ITestimonials[K]) { this._parsedContent[k] = v; }
}

function renderAccentRuns(text: string, tr: (s: string) => string): React.ReactNode {
    const translated = tr(text);
    return translated.split(/(\*[^*]+\*)/g).map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return <em key={i} className="em-accent">{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

const Testimonials = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new TestimonialsContent(EItemType.Testimonials, item.content).data;
    const trStr = (v: string) => translateOrKeep(tApp, v);
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;

    return (
        <section className={`testimonials-module ${item.style ?? ''}`}>
            {(c.sectionTitle || c.sectionSubtitle) && (
                <header className="testimonials-module__head">
                    {c.sectionTitle && (
                        <h2 className="testimonials-module__title">{renderAccentRuns(c.sectionTitle, trStr)}</h2>
                    )}
                    {c.sectionSubtitle && (
                        <div className="testimonials-module__sub">{tr(c.sectionSubtitle)}</div>
                    )}
                </header>
            )}
            <div className="testimonials-module__grid">
                {c.items.map((q, i) => (
                    <RevealOnScroll key={i} className="testimonials-module__card" delay={i * 80}>
                        <blockquote className="testimonials-module__quote">{tr(q.quote)}</blockquote>
                        <div className="testimonials-module__who">
                            <div className="testimonials-module__avatar" aria-hidden>
                                {(q.avatarInitial ?? q.name?.[0] ?? '').toUpperCase()}
                            </div>
                            <div>
                                <div className="testimonials-module__name">{tr(q.name)}</div>
                                {q.role && <div className="testimonials-module__role">{tr(q.role)}</div>}
                            </div>
                        </div>
                    </RevealOnScroll>
                ))}
            </div>
        </section>
    );
};

export default Testimonials;
