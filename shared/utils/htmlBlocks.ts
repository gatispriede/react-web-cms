/**
 * Split HTML into block-level text segments.
 *
 * Replaces `draft-js`'s `convertFromHTML(...).contentBlocks` for the narrow
 * use case of "give me one text string per visual paragraph so I can look it
 * up in the translation table". Keeps the public shape `{ text: string }[]`
 * so call sites don't need to change.
 */
const BLOCK_BOUNDARY = /<\/(?:p|div|h[1-6]|li|blockquote|pre|tr|td|th|section|article|header|footer|aside|nav)[^>]*>|<br\s*\/?>/gi;

export interface HtmlBlock {
    text: string;
}

export function htmlToBlocks(raw: unknown): HtmlBlock[] {
    if (typeof raw !== 'string' || !raw) return [];
    const parts = raw.split(BLOCK_BOUNDARY);
    const blocks: HtmlBlock[] = [];
    for (const part of parts) {
        const stripped = part.replace(/<[^>]*>/g, '');
        const decoded = stripped
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .trim();
        if (decoded) blocks.push({text: decoded});
    }
    return blocks;
}
