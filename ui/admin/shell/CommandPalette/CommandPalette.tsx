import React from 'react';
import {
    KBarAnimator,
    KBarPortal,
    KBarPositioner,
    KBarProvider,
    KBarResults,
    KBarSearch,
    useKBar,
    useMatches,
    useRegisterActions,
    type Action,
} from 'kbar';
import {useTranslation} from 'react-i18next';
import {buildNavigateActions} from './actions';
import {CHORD_NAV_TARGETS, SHORTCUTS} from './shortcuts';
import Cheatsheet from './Cheatsheet';

/**
 * Admin command palette — ⌘K / Ctrl+K from anywhere inside the admin
 * shell. Mounted once at the AdminApp root (see `AdminApp.tsx`). The
 * action graph auto-populates from `adminUILoaderRegistry` via
 * `buildNavigateActions`; per-feature panes augment with
 * `useRegisterActions` from inside their own view.
 *
 * Pairs with Sonner (`@admin/lib/notify`) — async actions wrap the
 * promise in `notifyPromise` so the operator gets toast feedback. The
 * palette itself stays lean and doesn't render toasts directly.
 */
export interface CommandPaletteProps {
    children: React.ReactNode;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({children}) => {
    const {t} = useTranslation();
    const initialActions = React.useMemo<Action[]>(() => buildNavigateActions(t), [t]);

    return (
        <KBarProvider actions={initialActions} options={{enableHistory: false}}>
            <PaletteShortcutBindings/>
            <KBarPortal>
                <KBarPositioner className="cmdk-positioner">
                    <KBarAnimator className="cmdk-animator">
                        <KBarSearch
                            className="cmdk-search"
                            placeholder={t('Type a command…')}
                            data-testid="cmdk-search"
                        />
                        <PaletteResults/>
                    </KBarAnimator>
                </KBarPositioner>
            </KBarPortal>
            <MobileFab/>
            {children}
        </KBarProvider>
    );
};

const PaletteResults: React.FC = () => {
    const {results} = useMatches();
    return (
        <KBarResults
            items={results}
            onRender={({item, active}) =>
                typeof item === 'string' ? (
                    <div className="cmdk-section-label" data-testid={`cmdk-section-${item}`}>{item}</div>
                ) : (
                    <div
                        className={`cmdk-result${active ? ' cmdk-result--active' : ''}`}
                        data-testid={`cmdk-result-${item.id}`}
                    >
                        <span>{item.name}</span>
                        {item.shortcut?.length ? (
                            <span style={{marginLeft: 'auto', opacity: 0.7, fontFamily: 'ui-monospace, monospace'}}>
                                {item.shortcut.join(' ')}
                            </span>
                        ) : null}
                    </div>
                )
            }
        />
    );
};

/**
 * Owns the cross-cutting shortcut bindings — cheatsheet trigger plus the
 * `g h` / `g p` / `g t` navigation chords. Lives inside `KBarProvider`
 * so `useRegisterActions` is in scope.
 *
 * Document-scope bindings (⌘S / ⌘↵ / ⌘⇧P) and list-scope `/` are
 * registered by the active editor / list view via `useRegisterActions`
 * from their own React tree, where the save / publish handlers exist.
 */
const PaletteShortcutBindings: React.FC = () => {
    const {t} = useTranslation();
    const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false);

    const chordActions = React.useMemo<Action[]>(() => {
        return SHORTCUTS
            .filter((s) => s.id.startsWith('nav-') && CHORD_NAV_TARGETS[s.id])
            .map((s) => ({
                id: s.id,
                name: t(s.label),
                shortcut: [...s.keys],
                section: t('Navigation'),
                keywords: `chord ${s.id}`,
                perform: () => {
                    if (typeof window !== 'undefined') window.location.assign(CHORD_NAV_TARGETS[s.id]);
                },
            }));
    }, [t]);

    const cheatsheetAction = React.useMemo<Action[]>(() => [{
        id: 'cheatsheet',
        name: t('Open shortcut cheatsheet'),
        shortcut: ['Shift+?'],
        keywords: 'help shortcuts keyboard ?',
        section: t('Global'),
        perform: () => setCheatsheetOpen(true),
    }], [t]);

    useRegisterActions([...chordActions, ...cheatsheetAction], [chordActions, cheatsheetAction]);

    return <Cheatsheet open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)}/>;
};

/** Mobile floating action button — pointer:coarse only via CSS, kept render-light. */
const MobileFab: React.FC = () => {
    const {query} = useKBar();
    const {t} = useTranslation();
    return (
        <button
            type="button"
            className="cmdk-fab"
            aria-label={t('Open command palette')}
            data-testid="cmdk-mobile-fab"
            onClick={() => query.toggle()}
        >
            {'⌘'}
        </button>
    );
};

export default CommandPalette;
