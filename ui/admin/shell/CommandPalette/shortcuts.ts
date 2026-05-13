/**
 * Keyboard shortcut catalogue — single source of truth.
 *
 * Every shortcut surfaced in the admin lives here. The `?` cheatsheet
 * modal renders straight off this list, so adding a binding requires
 * one entry and zero further plumbing.
 *
 * Shortcut strings follow kbar's tinykeys idiom:
 *   - `$mod+k`      → Cmd on macOS, Ctrl elsewhere
 *   - `$mod+s`      → Cmd/Ctrl + S
 *   - `$mod+Enter`  → Cmd/Ctrl + Return
 *   - `Shift+?`     → literal `?`
 *   - `g h`         → chord (press g, then h)
 */
export interface ShortcutEntry {
    /** Stable id used by kbar's action graph. */
    readonly id: string;
    /** tinykeys-style binding (e.g. `$mod+k`, `g h`). */
    readonly keys: readonly string[];
    /** Section label for the cheatsheet — translated at render time. */
    readonly section: 'Navigation' | 'Document' | 'List' | 'Global';
    /** Default English label — translated via the admin i18n bundle. */
    readonly label: string;
    /** Scope hint — purely informational, shown in the cheatsheet. */
    readonly scope: 'Global' | 'Document' | 'List';
}

export const SHORTCUTS: readonly ShortcutEntry[] = [
    {id: 'palette-open', keys: ['$mod+k'], section: 'Global', label: 'Open command palette', scope: 'Global'},
    {id: 'cheatsheet', keys: ['Shift+?'], section: 'Global', label: 'Open shortcut cheatsheet', scope: 'Global'},
    {id: 'doc-save', keys: ['$mod+s'], section: 'Document', label: 'Save active document', scope: 'Document'},
    {id: 'doc-publish', keys: ['$mod+Enter'], section: 'Document', label: 'Publish active document', scope: 'Document'},
    {id: 'doc-preview', keys: ['$mod+Shift+p'], section: 'Document', label: 'Preview active document', scope: 'Document'},
    {id: 'list-search', keys: ['/'], section: 'List', label: 'Focus list search input', scope: 'List'},
    {id: 'nav-home', keys: ['g h'], section: 'Navigation', label: 'Go to home / dashboard', scope: 'Global'},
    {id: 'nav-pages', keys: ['g p'], section: 'Navigation', label: 'Go to Pages', scope: 'Global'},
    {id: 'nav-themes', keys: ['g t'], section: 'Navigation', label: 'Go to Themes', scope: 'Global'},
];

/** Chord targets — chord id → route to push. */
export const CHORD_NAV_TARGETS: Readonly<Record<string, string>> = {
    'nav-home': '/admin/build',
    'nav-pages': '/admin/build',
    'nav-themes': '/admin/client-config/themes',
};
