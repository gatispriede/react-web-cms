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
        return html = html.replace(item.text,tApp(sanitizeKey(item.text)))
    })
    return html
}