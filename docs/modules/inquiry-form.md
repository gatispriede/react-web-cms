# `InquiryForm` (`EItemType.InquiryForm`)

> Configurable contact form with topic chips, free-text fields (text / email / textarea), and a Send button. Submissions POST to `/api/inquiry` and SMTP-mail the recipient configured in `siteFlags.inquiryRecipientEmail`.

`item.type`: `INQUIRY_FORM` &nbsp;·&nbsp; `item.style`: `default` (one of [`EInquiryFormStyle`](../../ui/client/modules/InquiryForm/InquiryForm.types.ts))

---

## Content shape

```ts
{
    eyebrow?: string;                  // mono caps eyebrow (e.g. "INQUIRY · 002")
    title?: string;
    subtitle?: string;
    topicsLabel?: string;              // mono caps label above the topic chip row
    topics?: IInquiryFormTopic[];      // {value, label} radio-style chips
    fields?: IInquiryFormField[];      // form fields rendered in declaration order
    submitLabel?: string;              // defaults to "Send inquiry"
    sendingLabel?: string;             // defaults to "Sending…"
    successMessage?: string;           // defaults to "Thanks — we'll be in touch."
    sideNote?: string;                 // mono small caps side-note column
}

interface IInquiryFormField {
    name: string;                      // posted form field name
    label: string;                     // visible label
    placeholder?: string;
    kind?: 'text' | 'email' | 'textarea';   // defaults to "text"
    required?: boolean;
}

interface IInquiryFormTopic {
    value: string;                     // posted as `topic`
    label: string;
}
```

## Styles

| Value | Description |
|---|---|
| `default` | Standard form layout |
| `editorial` | Paper / editorial CV — dashed rules, mono labels |

Source: `EInquiryFormStyle` enum in [`InquiryForm.types.ts`](../../ui/client/modules/InquiryForm/InquiryForm.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/InquiryForm/InquiryFormEditor.tsx`](../../ui/admin/modules/InquiryForm/InquiryFormEditor.tsx)

Top-level fields:

- **Eyebrow** — `<Input>` placeholder `INQUIRY · 002`
- **Title** — `<Input>`
- **Subtitle** — `<Input>`
- **Side note** — `<Input>`
- **Submit label** — `<Input>` placeholder `Send inquiry`
- **Success message** — `<Input>`

**Topics label + chips** (sortable):

- Topics label — `<Input>` placeholder `WHAT'S THIS ABOUT`
- Per topic: value `<Input>`, label `<Input>`, delete button
- **Add topic** button

**Fields** (sortable):

- Per field: name `<Input>`, label `<Input>`, placeholder `<Input>`, kind `<Select>` (text/email/textarea), `req` `<Switch>`, delete button
- **Add field** button

**No `module-editor-primary-text-input`** — the editor doesn't tag any field as primary because the form's "main" content is structured (topics + fields). The e2e chain spec omits InquiryForm from the registry (see Sample content below), so the testid isn't required here.

## Public rendering

**File:** [`ui/client/modules/InquiryForm/InquiryForm.tsx`](../../ui/client/modules/InquiryForm/InquiryForm.tsx)

```html
<section class="inquiry-form default">
    <header class="inquiry-form__head">
        <div class="inquiry-form__eyebrow">{eyebrow}</div>
        <h2 class="inquiry-form__title">{title}</h2>
        <p class="inquiry-form__subtitle">{subtitle}</p>
    </header>
    <form class="inquiry-form__form">
        <div class="inquiry-form__topics">
            <div class="inquiry-form__topics-label">{topicsLabel}</div>
            <div class="inquiry-form__topic-row" role="radiogroup">
                <button class="inquiry-form__chip" role="radio" aria-checked="...">{topic.label}</button>
            </div>
        </div>
        <div class="inquiry-form__fields">
            <label class="inquiry-form__field">
                <span class="inquiry-form__label">{field.label}</span>
                <input name="{field.name}" type="text|email" required.../>
                <!-- or <textarea rows="5"> for kind=textarea -->
            </label>
        </div>
        <input type="text" name="website" /> <!-- honeypot, off-screen -->
        <div class="inquiry-form__footer">
            <div class="inquiry-form__sidenote">{sideNote}</div>
            <button type="submit" class="inquiry-form__submit">{submitLabel}</button>
            <div class="inquiry-form__error" role="alert">...</div>
        </div>
    </form>
</section>
```

Submission behaviour:

- POST `/api/inquiry` with JSON body `{topic, ...field values}`
- 25-second `AbortController` client-side timeout (server-side is ~15s).
- Honeypot `<input name="website">` is off-screen — bots that fill every field get a 200 with no SMTP send.
- Once `submitted === true`, the button text becomes `successMessage` and re-submission is blocked.
- Network / abort errors surface in `.inquiry-form__error` — abort gets a translated "Request timed out" message.

`<RevealOnScroll>` wraps the whole form. The `<h2>` gets an anchor `id` from `slugifyAnchor`.

**Theming tokens consumed (InquiryForm.scss):** input border / focus tokens, chip surface tokens, accent (chip selected, submit button), error red.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-inquiry-form` |
| Rendered module container (admin + public) | `section-module-row-inquiry-form` |
| Edit affordance on the section row (admin) | `section-module-edit-inquiry-form-btn` |
| Primary text input (admin) | **not surfaced** — InquiryForm is registry-omitted; the e2e chain spec doesn't fill it |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

**Omitted from the registry.** Reason: the form's full lifecycle (POST → SMTP send → audit log) requires the SMTP integration to be live, which isn't part of the unit / chain test environment. The module gets full picker / edit / save coverage indirectly through the structural admin tests, but the sample-add chain skips it.

`REGISTRY_OMISSIONS` in `moduleSamples.ts` lists `EItemType.InquiryForm` with the comment: `// form integration, separate spec needed`.

---

## MCP commands

```bash
# Adding without --sample requires explicit content; there's no sample to fall back on.
cms section add my-page INQUIRY_FORM --content '{"title":"Get in touch","topics":[{"value":"work","label":"Work"}],"fields":[{"name":"name","label":"Name","kind":"text","required":true},{"name":"email","label":"Email","kind":"email","required":true},{"name":"message","label":"Message","kind":"textarea","required":true}],"submitLabel":"Send inquiry"}'
cms section update <id> --style editorial
```

`cms module describe INQUIRY_FORM` returns the content schema + style enum (no sample, registry-omitted).

---

## Notes

- The recipient address is NOT in `content` — it's read from `siteFlags.inquiryRecipientEmail` server-side. The form doesn't expose addresses to the page.
- The 25s client-side abort is a hard ceiling. If the SMTP relay is slow but eventually succeeds, the visitor sees the timeout error even though the email may go through. Audit log captures both states.
- `topic` is the implicit first field in the POST payload — it's NOT one of the `fields[]` array. Always present in the body, defaults to first topic's `value`.
