/**
 * W6a — Saved-search alert.
 *
 * Sent to a customer when a saved search picks up new matches since the
 * last scan (faceted-filter system — W6b — saved searches + alerts).
 * The job is to pull the customer back with a focused list preview of
 * what's new, then one CTA to the filter URL with the search pre-applied.
 *
 * No visual progress timeline — this isn't an order. The preview list of
 * new matches IS the content; the filter-URL button is the single
 * focused CTA.
 *
 * Note: the saved-search backend does not exist in the codebase yet —
 * only a UI type stub (`ui/client/modules/SavedSearchList`). This
 * template ships ahead of its trigger (the saved-search delta scanner)
 * so the wiring drops in cleanly once W6b lands.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

/** One new match the saved-search scan turned up. */
export interface SavedSearchResult {
    /** Listing / product title. */
    title: string;
    /** Absolute URL to the listing detail page. */
    url: string;
    /** Optional pre-formatted price string — e.g. "€12,999". */
    price?: string;
    /** Optional one-line summary — e.g. "2018 · 84,000 km · Diesel". */
    summary?: string;
    /** Optional thumbnail URL. */
    imageUrl?: string;
}

export interface SavedSearchAlertInput {
    customerName?: string;
    /** The operator/customer-given name of the saved search. */
    searchName: string;
    /** New matches since the last scan — the email's content. */
    results: SavedSearchResult[];
    /** Total new-match count — may exceed `results.length` when truncated. */
    newMatchCount: number;
    /** Absolute URL to the search results with the filter pre-applied. */
    filterUrl: string;
    /** Optional URL to manage / pause this saved search. */
    manageUrl?: string;
    /** Unsubscribe URL stamped by `sendWithPreference` (W8f). */
    unsubscribeUrl?: string;
}

/** One result row — image-left, mobile-first. */
function resultRow(r: SavedSearchResult, t: IEmailTheme): string {
    const img = r.imageUrl
        ? `<td width="64" valign="top" style="padding-right:12px;"><img src="${escape(r.imageUrl)}" alt="" width="56" height="56" style="display:block;border-radius:6px;width:56px;height:56px;object-fit:cover;"></td>`
        : '';
    return `<tr><td style="padding:8px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${img}<td valign="top" style="font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInk};">
<a href="${escape(r.url)}" style="color:${t.colorInk};text-decoration:none;font-weight:600;">${escape(r.title)}</a>
${r.summary ? `<br><span style="color:${t.colorInkMuted};font-size:12px;">${escape(r.summary)}</span>` : ''}
</td>${r.price ? `<td valign="top" align="right" style="font-family:${t.fontFamilyBody};font-size:14px;font-weight:700;color:${t.colorInk};white-space:nowrap;">${escape(r.price)}</td>` : ''}</tr>
</table>
</td></tr>`;
}

export const savedSearchAlertTemplate = {
    id: 'saved-search-alert',
    subject: (input: SavedSearchAlertInput): string => {
        const n = input.newMatchCount;
        return `${n} new match${n === 1 ? '' : 'es'} for "${input.searchName}"`;
    },
    html: (input: SavedSearchAlertInput, theme: IEmailTheme): string => {
        const rows = input.results.map(r => resultRow(r, theme)).join('');
        const hiddenCount = input.newMatchCount - input.results.length;
        return emailShell({
            title: savedSearchAlertTemplate.subject(input),
            theme,
            preheader: `${input.newMatchCount} new result${input.newMatchCount === 1 ? '' : 's'} matched your saved search.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">New matches for you, ${escape(input.customerName ?? 'there')}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Your saved search <strong>${escape(input.searchName)}</strong> picked up ${escape(input.newMatchCount)} new match${input.newMatchCount === 1 ? '' : 'es'} since we last checked.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
${rows}
</table>
${hiddenCount > 0 ? `<p style="margin:4px 0 0 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">+ ${escape(hiddenCount)} more — see them all below.</p>` : ''}
${button({label: 'See all matches', href: input.filterUrl}, theme)}
${input.manageUrl ? `${divider(theme)}
<p style="margin:8px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Getting too many of these? <a href="${escape(input.manageUrl)}" style="color:${theme.colorAccent};text-decoration:underline;">Manage this saved search</a>.</p>` : ''}
</td></tr>
${input.unsubscribeUrl ? `<tr><td align="center" style="padding:12px 16px;font-family:${theme.fontFamilyBody};font-size:11px;color:${theme.colorInkMuted};">
You're receiving this because you set up a saved-search alert. <a href="${escape(input.unsubscribeUrl)}" style="color:${theme.colorInkMuted};">Unsubscribe</a>.
</td></tr>` : ''}
            `,
        });
    },
    text: (input: SavedSearchAlertInput): string => {
        const lines = input.results
            .map(r => `  ${r.title}${r.price ? ` — ${r.price}` : ''}${r.summary ? `\n    ${r.summary}` : ''}\n    ${r.url}`)
            .join('\n');
        const hiddenCount = input.newMatchCount - input.results.length;
        return `New matches for you, ${input.customerName ?? 'there'},

Your saved search "${input.searchName}" picked up ${input.newMatchCount} new match${input.newMatchCount === 1 ? '' : 'es'} since we last checked.

${lines}
${hiddenCount > 0 ? `\n  + ${hiddenCount} more\n` : ''}
See all matches: ${input.filterUrl}
${input.manageUrl ? `Manage this saved search: ${input.manageUrl}\n` : ''}`;
    },
    requiredFields: ['searchName', 'results', 'newMatchCount', 'filterUrl'] as const,
};
