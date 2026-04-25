import React, {useState} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import type {IInquiryForm} from "./InquiryForm.types";
export type {IInquiryForm, IInquiryFormField, IInquiryFormTopic} from "./InquiryForm.types";
export {EInquiryFormStyle} from "./InquiryForm.types";

const defaults: IInquiryForm = {topics: [], fields: []};

export class InquiryFormContent extends ContentManager {
    public _parsedContent: IInquiryForm = {...defaults};
    get data(): IInquiryForm {
        this.parse();
        return {
            ...defaults,
            ...this._parsedContent,
            topics: this._parsedContent?.topics ?? [],
            fields: this._parsedContent?.fields ?? [],
        };
    }
    set data(v: IInquiryForm) { this._parsedContent = v; }
    setField<K extends keyof IInquiryForm>(k: K, v: IInquiryForm[K]) { this._parsedContent[k] = v; }
}

const InquiryForm = ({item, tApp}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new InquiryFormContent(EItemType.InquiryForm, item.content).data;
    const tr = (v: string) => <InlineTranslatable tApp={tApp as any} source={v}/>;
    const topics = c.topics ?? [];
    const fields = c.fields ?? [];
    const [topic, setTopic] = useState<string | undefined>(topics[0]?.value);
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const payload: Record<string, FormDataEntryValue> = {topic: topic ?? ''};
        fd.forEach((v, k) => { payload[k] = v; });
        // Real submission lives in a separate backend roadmap; stub for now.
        // eslint-disable-next-line no-console
        console.info('[InquiryForm] stub submit', payload);
        setSubmitted(true);
    };

    return (
        <RevealOnScroll className={`inquiry-form ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="inquiry-form__head">
                    {c.eyebrow && <div className="inquiry-form__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 className="inquiry-form__title">{tr(c.title)}</h2>}
                    {c.subtitle && <p className="inquiry-form__subtitle">{tr(c.subtitle)}</p>}
                </header>
            )}
            <form className="inquiry-form__form" onSubmit={onSubmit}>
                {topics.length > 0 && (
                    <div className="inquiry-form__topics">
                        {c.topicsLabel && (
                            <div className="inquiry-form__topics-label">{tr(c.topicsLabel)}</div>
                        )}
                        <div className="inquiry-form__topic-row" role="radiogroup">
                            {topics.map(tp => (
                                <button
                                    type="button"
                                    key={tp.value}
                                    className={`inquiry-form__chip${topic === tp.value ? ' is-active' : ''}`}
                                    role="radio"
                                    aria-checked={topic === tp.value}
                                    onClick={() => setTopic(tp.value)}
                                >
                                    {tr(tp.label)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="inquiry-form__fields">
                    {fields.map((f, i) => {
                        const labelNode = <span className="inquiry-form__label">{tr(f.label)}</span>;
                        if (f.kind === 'textarea') {
                            return (
                                <label key={i} className="inquiry-form__field inquiry-form__field--textarea">
                                    {labelNode}
                                    <textarea
                                        name={f.name}
                                        placeholder={f.placeholder ?? ''}
                                        required={!!f.required}
                                        rows={5}
                                    />
                                </label>
                            );
                        }
                        return (
                            <label key={i} className="inquiry-form__field">
                                {labelNode}
                                <input
                                    name={f.name}
                                    type={f.kind === 'email' ? 'email' : 'text'}
                                    placeholder={f.placeholder ?? ''}
                                    required={!!f.required}
                                />
                            </label>
                        );
                    })}
                </div>
                <div className="inquiry-form__footer">
                    {c.sideNote && <div className="inquiry-form__sidenote">{tr(c.sideNote)}</div>}
                    <button type="submit" className="inquiry-form__submit" disabled={submitted}>
                        {submitted
                            ? tr(c.successMessage ?? 'Thanks — we\'ll be in touch.')
                            : tr(c.submitLabel ?? 'Send inquiry')}
                    </button>
                </div>
            </form>
        </RevealOnScroll>
    );
};

export default InquiryForm;
