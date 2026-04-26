import React, {useState} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import RevealOnScroll from "@client/lib/RevealOnScroll";
import {slugifyAnchor} from "@utils/stringFunctions";
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
    const [sending, setSending] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (sending || submitted) return;

        const fd = new FormData(e.currentTarget);
        const payload: Record<string, string> = {topic: topic ?? ''};
        fd.forEach((v, k) => { payload[k] = String(v); });

        setSending(true);
        setErrorMsg(null);
        // Client-side hard timeout. The server-side nodemailer is also
        // capped at ~15s, but a network-layer hang (CDN, proxy, broken
        // pipe) would still leave the visitor staring at "Sending…"
        // forever. 25s is comfortably above the server's worst-case
        // latency yet short enough to feel responsive.
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 25_000);
        try {
            const res = await fetch('/api/inquiry', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                throw new Error(data.error || `Send failed (${res.status})`);
            }
            setSubmitted(true);
        } catch (err) {
            const name = (err as Error)?.name;
            if (name === 'AbortError') {
                setErrorMsg("Request timed out. Please try again or email directly.");
            } else {
                setErrorMsg(String((err as Error)?.message ?? err));
            }
        } finally {
            clearTimeout(t);
            setSending(false);
        }
    };

    return (
        <RevealOnScroll className={`inquiry-form ${item.style ?? ''}`}>
            {(c.eyebrow || c.title || c.subtitle) && (
                <header className="inquiry-form__head">
                    {c.eyebrow && <div className="inquiry-form__eyebrow">{tr(c.eyebrow)}</div>}
                    {c.title && <h2 id={slugifyAnchor(c.title)} className="inquiry-form__title">{tr(c.title)}</h2>}
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
                {/* Honeypot — invisible to humans (CSS-hidden + aria),
                    visible to scraping bots which dutifully fill every
                    field. Server treats a non-empty value as bot traffic
                    and 200s without sending. */}
                <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    style={{position: 'absolute', left: '-9999px', width: 0, height: 0, opacity: 0}}
                />
                <div className="inquiry-form__footer">
                    {c.sideNote && <div className="inquiry-form__sidenote">{tr(c.sideNote)}</div>}
                    <button
                        type="submit"
                        className="inquiry-form__submit"
                        disabled={submitted || sending}
                    >
                        {submitted
                            ? tr(c.successMessage ?? "Thanks — we'll be in touch.")
                            : sending
                                ? tr(c.sendingLabel ?? 'Sending…')
                                : tr(c.submitLabel ?? 'Send inquiry')}
                    </button>
                    {errorMsg && (
                        <div className="inquiry-form__error" role="alert" style={{color: '#b13', marginTop: 8}}>
                            {errorMsg}
                        </div>
                    )}
                </div>
            </form>
        </RevealOnScroll>
    );
};

export default InquiryForm;
