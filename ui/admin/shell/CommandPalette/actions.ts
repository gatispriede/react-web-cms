/**
 * Auto-population of kbar actions from the `adminUILoaderRegistry`.
 *
 * Each registered `AdminPaneDescriptor` becomes one `Go to <Title>`
 * navigate action. The shell binds `perform` to a router push so the
 * actions are independent of any React tree — kbar can register them
 * at provider-mount time.
 *
 * Cheatsheet + chord shortcuts (⌘S save, ⌘↵ publish, `?` cheatsheet,
 * `g h` etc.) are registered separately in `CommandPalette.tsx` via
 * `useRegisterActions` so they can capture closures over the live
 * document / list scope handlers.
 */
import type {Action} from 'kbar';
import {listAdminPanes} from '@admin/lib/loaders/adminUILoaderRegistry';

/** Translator shape — supplied by the caller so this file stays react-tree-free. */
type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** Side-effect navigation — uses `window.location.assign` to avoid pulling Next router. */
function navigate(route: string): void {
    if (typeof window === 'undefined') return;
    window.location.assign(route);
}

/** Open a public-site URL in a new tab — used by the preview / blog actions. */
function openExternal(href: string): void {
    if (typeof window === 'undefined') return;
    window.open(href, '_blank', 'noopener,noreferrer');
}

/**
 * Build navigate actions from every registered admin pane. Returns one
 * `nav-<id>` action per pane with keywords drawn from id + title so
 * fuzzy search ("themes", "themes config") catches both.
 *
 * Sourced entirely from `listAdminPanes()` — the same
 * `adminUILoaderRegistry` the shell dispatches panes off — so the
 * palette stays in lockstep with the registered feature set with zero
 * hand-maintained list. A new `*AdminUILoader` with an `adminPane`
 * descriptor shows up here automatically.
 */
export function buildNavigateActions(t: Translate): Action[] {
    return listAdminPanes().map((pane) => ({
        id: `nav-${pane.id}`,
        name: t('Go to {{title}}', {title: t(pane.title)}),
        keywords: `navigate ${pane.id} ${pane.title.toLowerCase()} ${pane.route}`,
        section: t('Navigation'),
        perform: () => navigate(pane.route),
    }));
}

/**
 * Cross-area utility actions that aren't a registered pane — open the
 * public site / blog in a new tab. `lang` is the operator's resolved
 * public-site locale so the preview lands on the right localised route.
 */
export function buildUtilityActions(t: Translate, lang: string): Action[] {
    return [
        {
            id: 'util-preview-site',
            name: t('Preview site'),
            keywords: 'preview public site open live',
            section: t('Global'),
            perform: () => openExternal(`/${lang}`),
        },
        {
            id: 'util-open-blog',
            name: t('Open blog'),
            keywords: 'blog public articles posts open',
            section: t('Global'),
            perform: () => openExternal(`/${lang}/blog`),
        },
    ];
}

/** Count of registered nav actions — handy for instrumentation / progress reporting. */
export function navigateActionCount(): number {
    return listAdminPanes().length;
}
