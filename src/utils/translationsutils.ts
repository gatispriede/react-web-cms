import {convertFromHTML} from "draft-js";
import {sanitizeKey} from "./stringFunctions";

export const extractTranslationsFromHTML = (html: string, tApp: (arg0: any) => any) => {
    if (typeof html !== 'string' || !html) {
        return '';
    }
    const tmp = convertFromHTML(html)
    const parsed = JSON.parse(JSON.stringify(tmp))
    const content = parsed.contentBlocks;
    content.map((item: { text: any | string | string[]; }) => {
        if (typeof item.text !== 'string' || !item.text) return item;
        const key = sanitizeKey(item.text);
        const translated = tApp(key);
        // If i18next returns the key verbatim (missing translation), keep the
        // authored text so the output matches what the admin entered.
        const replacement = translated === key ? item.text : translated;
        html = html.replace(item.text, replacement);
        return item;
    })
    return html
}