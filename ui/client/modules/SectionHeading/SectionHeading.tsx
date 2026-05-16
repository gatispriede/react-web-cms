import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {ISectionHeading} from "./SectionHeading.types";
export type {ISectionHeading} from "./SectionHeading.types";
export {ESectionHeadingStyle} from "./SectionHeading.types";

const defaults: ISectionHeading = {heading: ''};

export class SectionHeadingContent extends ContentManager {
    public _parsedContent: ISectionHeading = {...defaults};
    get data(): ISectionHeading {
        this.parse();
        return {...defaults, ...this._parsedContent};
    }
    set data(v: ISectionHeading) { this._parsedContent = v; }
    setField<K extends keyof ISectionHeading>(k: K, v: ISectionHeading[K]) { this._parsedContent[k] = v; }
}

const SectionHeading = ({item, tApp, admin}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}) => {
    const c = new SectionHeadingContent(EItemType.SectionHeading, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const editId = item.name || EItemType.SectionHeading;
    const variant = item.style || 'editorial';
    // align: explicit override > variant default. The centered-marquee
    // variant centres by default; everything else aligns left.
    const align = c.align ?? (variant === 'centered-marquee' ? 'center' : 'left');
    if (!c.heading) return null;

    return (
        <RevealOnScroll className={`section-heading ${variant}`}>
            <section data-variant={variant} data-align={align} data-testid="section-heading">
                <div className="sh-root">
                    {c.eyebrow && (
                        <p className="sh-eyebrow" data-testid="sh-eyebrow"
                           {...inlineEditAttr(admin, editId, 'eyebrow')}>
                            {tr(c.eyebrow)}
                        </p>
                    )}
                    <h2 className="sh-heading" data-testid="sh-heading"
                        {...inlineEditAttr(admin, editId, 'heading')}>
                        {tr(c.heading)}
                    </h2>
                    {c.subtitle && (
                        <p className="sh-subtitle" data-testid="sh-subtitle"
                           {...inlineEditAttr(admin, editId, 'subtitle')}>
                            {tr(c.subtitle)}
                        </p>
                    )}
                </div>
            </section>
        </RevealOnScroll>
    );
};

export default SectionHeading;
