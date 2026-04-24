import {htmlToBlocks} from "./htmlBlocks";
import {sanitizeKey} from "./stringFunctions";

export const extractTranslationsFromHTML = (html: string, tApp: (arg0: any) => any) => {
    if (typeof html !== 'string' || !html) {
        return '';
    }
    for (const block of htmlToBlocks(html)) {
        const key = sanitizeKey(block.text);
        const translated = tApp(key);
        // If i18next returns the key verbatim (missing translation), keep the
        // authored text so the output matches what the admin entered.
        const replacement = translated === key ? block.text : translated;
        html = html.replace(block.text, replacement);
    }
    return html;
}