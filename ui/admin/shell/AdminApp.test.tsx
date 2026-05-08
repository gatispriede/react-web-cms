// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, act, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// Module mocks. AdminApp pulls in a thick stack (gqty resolve, MongoApi,
// ThemeApi, PublishApi, refreshBus, theme css applier, icons, dynamic tabs).
// Every mock here is the smallest surface that satisfies AdminApp's calls —
// nothing reaches a real network or Mongo.
// ---------------------------------------------------------------------------

// Per-test seam for `resolve()` so individual tests can swap the page list.
const navRowsRef: {current: any[]} = {current: []};
vi.mock('@services/api/generated', () => ({
    __esModule: true,
    resolve: vi.fn(async (cb: any) => {
        // AdminApp's callback walks `query.mongo.getNavigationCollection.map(...)`
        // and pushes synthesised entries onto a local list. We feed it a
        // stand-in `query` whose `getNavigationCollection` is `navRowsRef.current`,
        // and let AdminApp do the mapping itself — that way the production
        // shape-mapping code path is exercised.
        const fakeQuery = {mongo: {getNavigationCollection: navRowsRef.current}};
        return cb({query: fakeQuery});
    }),
}));

// MongoApi — every method AdminApp calls on it. `loadSections` resolves to
// an empty list (no per-page sections needed for these smoke tests),
// `fetchNavigationParentSlugMap` returns an empty Map (parent/slug already
// graft-able from the rows themselves), and the destructive paths are spies
// so the delete test can assert on them.
const mongoSpies = {
    loadSections: vi.fn(async () => []),
    deleteNavigation: vi.fn(async () => undefined),
    setNavigationParent: vi.fn(async () => undefined),
    fetchNavigationParentSlugMap: vi.fn(async () => new Map()),
};
vi.mock('@services/api/client/MongoApi', () => ({
    __esModule: true,
    default: class {
        loadSections = mongoSpies.loadSections;
        deleteNavigation = mongoSpies.deleteNavigation;
        setNavigationParent = mongoSpies.setNavigationParent;
        fetchNavigationParentSlugMap = mongoSpies.fetchNavigationParentSlugMap;
    },
}));

vi.mock('@services/api/client/ThemeApi', () => ({
    __esModule: true,
    default: class {
        getActive = vi.fn(async () => ({tokens: {}}));
    },
}));

const publishSpies = {
    getMeta: vi.fn(async () => ({publishedAt: undefined})),
    publish: vi.fn(async () => ({publishedAt: '2026-05-08T00:00:00Z'})),
};
vi.mock('@services/api/client/PublishApi', () => ({
    __esModule: true,
    default: class {
        getMeta = publishSpies.getMeta;
        publish = publishSpies.publish;
    },
}));

// refreshBus — capture the subscriber + return a spy unsubscribe so the
// mount/unmount lifecycle test can assert both halves.
const refreshBusSpies = {
    subscribe: vi.fn(),
    unsub: vi.fn(),
};
vi.mock('@client/lib/refreshBus', () => ({
    refreshBus: {
        subscribe: (fn: any) => {
            refreshBusSpies.subscribe(fn);
            return refreshBusSpies.unsub;
        },
    },
}));

vi.mock('@client/features/Themes/applyThemeCssVars', () => ({
    applyThemeCssVars: vi.fn(),
}));

// GuardedAction — re-export the real one. AdminApp wires `deletePage`
// through it; the destructive path test wants the real trigger semantics
// (idempotency key forwarded into MongoApi.deleteNavigation).
vi.mock('@admin/lib/useGuardedAction', async () => {
    const actual = await vi.importActual<any>('@admin/lib/useGuardedAction');
    return actual;
});

vi.mock('@admin/lib/anchorRegistry', () => ({setAnchors: vi.fn()}));

// adminMode — mode toggle gates the publish button alongside canPublish.
const adminModeRef: {current: 'simplified' | 'advanced' | undefined} = {current: undefined};
vi.mock('@admin/lib/adminMode', () => ({
    getCachedMode: () => adminModeRef.current,
}));

// Icon barrel — no-op fragments. The icon shapes are not under test.
vi.mock('@client/lib/icons', () => {
    const Stub = (props: any) => React.createElement('span', props);
    return {
        CloseOutlined: Stub,
        CloudUploadOutlined: Stub,
        DownOutlined: Stub,
        EditOutlined: Stub,
        FileOutlined: Stub,
        PlusOutlined: Stub,
    };
});

// DynamicTabsContent renders the active page contents — stub it so the
// content area is identifiable and we don't pull in the entire content
// renderer stack (which would in turn import every module type's editor).
vi.mock('@client/lib/DynamicTabsContent', () => ({
    __esModule: true,
    default: (props: any) =>
        React.createElement('div', {'data-testid': 'dynamic-tabs'}, props.page),
}));

// Quiet the Logo / Image rail / undo pill / audit badge / dialogs so we
// don't import their dependency graph (they each pull translations,
// gqty, antd-pro chrome). The Logo render-target is asserted via
// data-testid.
vi.mock('@client/features/Logo/Logo', () => ({
    __esModule: true,
    default: (props: any) =>
        React.createElement('div', {'data-testid': 'logo', 'data-admin': String(!!props.admin)}, 'logo'),
}));
vi.mock('@admin/features/Navigation/ImageRailDock', () => ({
    __esModule: true,
    default: () => React.createElement('div', {'data-testid': 'image-rail'}),
}));
vi.mock('./UndoStatusPill', () => ({
    __esModule: true,
    default: () => React.createElement('div', {'data-testid': 'undo-pill'}),
}));
vi.mock('./AuditBadge', () => ({
    __esModule: true,
    default: () => React.createElement('span', {'data-testid': 'audit-badge'}),
}));
vi.mock('@admin/features/Navigation/AddNewDialogNavigation', () => ({
    __esModule: true,
    default: (props: any) =>
        props.open
            ? React.createElement('div', {'data-testid': 'add-new-dialog'})
            : null,
}));

// `Modal.confirm` — capture the most-recent call config so the
// confirmDelete test can introspect title/content/okText. We patch the
// real antd Modal with a partial spread so AntD's other exports
// (notifications, useApp, etc.) keep working at import time.
const modalConfirmSpy = vi.fn();
vi.mock('antd', async () => {
    const actual = await vi.importActual<any>('antd');
    return {
        ...actual,
        Modal: {
            ...actual.Modal,
            confirm: (cfg: any) => {
                modalConfirmSpy(cfg);
                return {destroy: () => {}, update: () => {}} as any;
            },
        },
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseSession = (overrides?: any): any => ({
    user: {role: 'admin', canPublishProduction: true, ...(overrides ?? {})},
    expires: '',
});

const t = ((k: string, vars?: any) => {
    if (!vars) return k;
    // Mimic i18next interpolation just enough for the assert on
    // count-aware copy in the cascade-delete prompt.
    return k.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
}) as any;

/** Wait for any queued microtasks (resolve() promise + setStates) to settle. */
const flush = async () => {
    await act(async () => {
        await new Promise(r => setTimeout(r, 0));
        await new Promise(r => setTimeout(r, 0));
    });
};

// Import AdminApp lazily so module mocks above are in place first.
const importAdminApp = async () => (await import('./AdminApp')).default;

beforeEach(() => {
    navRowsRef.current = [];
    adminModeRef.current = undefined;
    window.localStorage.clear();
    // jsdom defaults pathname to '/'; tests that need a specific path
    // override it via `Object.defineProperty(window, 'location', ...)`.
    modalConfirmSpy.mockClear();
    refreshBusSpies.subscribe.mockClear();
    refreshBusSpies.unsub.mockClear();
    publishSpies.getMeta.mockClear();
    publishSpies.publish.mockClear();
    mongoSpies.loadSections.mockClear();
    mongoSpies.deleteNavigation.mockClear();
    mongoSpies.setNavigationParent.mockClear();
    mongoSpies.fetchNavigationParentSlugMap.mockClear();
    // Default `fetch` — fresh-install probe answers "not fresh" unless a
    // test overrides. Every other call falls back to a 200/empty body.
    (globalThis as any).fetch = vi.fn(async () => ({
        ok: true,
        json: async () => ({fresh: false}),
    }));
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminApp — smoke (refactor safety net)', () => {
    it('renders without crashing for an admin session', async () => {
        const AdminApp = await importAdminApp();
        render(<AdminApp session={baseSession()} t={t} tApp={t}/>);
        await flush();
        // Header brand + admin chrome are always present for an editor.
        expect(screen.getByTestId('logo')).toBeInTheDocument();
        expect(screen.getByTestId('image-rail')).toBeInTheDocument();
        expect(screen.getByTestId('undo-pill')).toBeInTheDocument();
        // The "New page" CTA in the sider footer confirms canEditNav was true.
        expect(screen.getByTestId('nav-add-page-btn')).toBeInTheDocument();
    });

    it('siderCollapsed reads from localStorage on mount and toggleSider writes back', async () => {
        window.localStorage.setItem('admin.sider.collapsed', '1');
        const AdminApp = await importAdminApp();
        const ref = React.createRef<any>();
        render(<AdminApp ref={ref} session={baseSession()} t={t} tApp={t}/>);
        await flush();
        // Mounted in the collapsed state because the flag was set.
        expect(ref.current?.state.siderCollapsed).toBe(true);
        // toggleSider(false) flips state + persists '0'. Calling the method
        // directly avoids hunting for AntD Sider's internal collapse trigger
        // (which renders inside an antd-internal portal).
        act(() => ref.current.toggleSider(false));
        expect(ref.current.state.siderCollapsed).toBe(false);
        expect(window.localStorage.getItem('admin.sider.collapsed')).toBe('0');
    });

    it('openKeys defaults to all parent ids when first loading a tree', async () => {
        // Two pages: "Root" with id=r1, and "Child" parented to r1.
        navRowsRef.current = [
            {id: 'r1', page: 'Root', type: 'navigation', sections: [], seo: undefined, parent: undefined, slug: 'root'},
            {id: 'c1', page: 'Child', type: 'navigation', sections: [], seo: undefined, parent: 'r1', slug: 'child'},
        ];
        const AdminApp = await importAdminApp();
        const ref = React.createRef<any>();
        render(<AdminApp ref={ref} session={baseSession()} t={t} tApp={t}/>);
        await flush();
        // Two tabProps entries, the parent's `key` is in openKeys, and both
        // sider rows are rendered (because the parent is open by default).
        expect(ref.current.state.tabProps).toHaveLength(2);
        const parentTab = ref.current.state.tabProps.find((tp: any) => tp.id === 'r1');
        expect(ref.current.state.openKeys).toContain(parentTab.key);
        expect(screen.getByTestId('nav-page-row-root')).toBeInTheDocument();
        expect(screen.getByTestId('nav-page-row-child')).toBeInTheDocument();
    });

    it('publish button visibility tracks canPublish + adminMode', async () => {
        // Visible: admin role, canPublishProduction=true, mode=undefined.
        adminModeRef.current = undefined;
        const AdminApp = await importAdminApp();
        const {unmount} = render(
            <AdminApp session={baseSession({canPublishProduction: true})} t={t} tApp={t}/>,
        );
        await flush();
        expect(screen.getByTestId('publishing-publish-btn')).toBeInTheDocument();
        unmount();

        // Hidden when mode is "simplified" — even with full publish rights.
        adminModeRef.current = 'simplified';
        render(<AdminApp session={baseSession({canPublishProduction: true})} t={t} tApp={t}/>);
        await flush();
        expect(screen.queryByTestId('publishing-publish-btn')).not.toBeInTheDocument();

        // Hidden for a viewer regardless of mode.
        adminModeRef.current = undefined;
        render(<AdminApp session={baseSession({role: 'viewer', canPublishProduction: true})} t={t} tApp={t}/>);
        await flush();
        // Two trees rendered above each had a publish-btn or not. Filter to
        // the freshly mounted (third) by counting: should still equal 1
        // because only the very first tree had the button visible.
        const buttons = screen.queryAllByTestId('publishing-publish-btn');
        expect(buttons).toHaveLength(0);
    });

    it('confirmDelete shows a different prompt when the page has children', async () => {
        navRowsRef.current = [
            {id: 'r1', page: 'Root', type: 'navigation', sections: [], seo: undefined, parent: undefined, slug: 'root'},
            {id: 'c1', page: 'Child', type: 'navigation', sections: [], seo: undefined, parent: 'r1', slug: 'child'},
        ];
        const AdminApp = await importAdminApp();
        const ref = React.createRef<any>();
        render(<AdminApp ref={ref} session={baseSession()} t={t} tApp={t}/>);
        await flush();

        const root = ref.current.state.tabProps.find((tp: any) => tp.id === 'r1');
        const child = ref.current.state.tabProps.find((tp: any) => tp.id === 'c1');

        // Root has 1 child → cascade-aware prompt (title interpolates page
        // name, content interpolates child count, okText flips to "Move
        // children to root").
        await act(async () => { await ref.current.confirmDelete(root); });
        expect(modalConfirmSpy).toHaveBeenCalledTimes(1);
        const cfgWithKids = modalConfirmSpy.mock.calls[0][0];
        expect(cfgWithKids.title).toBe('Delete "Root"?');
        expect(cfgWithKids.content).toContain('child page(s)');
        expect(cfgWithKids.okText).toBe('Move children to root');

        // Child has no kids → simple delete prompt: title="Delete page?",
        // okText="Delete", and no `content`.
        modalConfirmSpy.mockClear();
        await act(async () => { await ref.current.confirmDelete(child); });
        expect(modalConfirmSpy).toHaveBeenCalledTimes(1);
        const cfgNoKids = modalConfirmSpy.mock.calls[0][0];
        expect(cfgNoKids.title).toBe('Delete page?');
        expect(cfgNoKids.okText).toBe('Delete');
        expect(cfgNoKids.content).toBeUndefined();
    });

    it('subscribes to refreshBus on mount and unsubscribes on unmount', async () => {
        const AdminApp = await importAdminApp();
        const {unmount} = render(<AdminApp session={baseSession()} t={t} tApp={t}/>);
        await flush();
        expect(refreshBusSpies.subscribe).toHaveBeenCalledTimes(1);
        expect(refreshBusSpies.unsub).not.toHaveBeenCalled();
        unmount();
        expect(refreshBusSpies.unsub).toHaveBeenCalledTimes(1);
    });

    it('redirects to /admin/onboarding when the install is fresh and we are on /admin/build', async () => {
        // Replace `window.location` with a configurable stand-in. jsdom's
        // `Location` is read-only by default, so we delete + redefine.
        const replace = vi.fn();
        const originalLocation = window.location;
        delete (window as any).location;
        (window as any).location = {pathname: '/admin/build', replace};

        (globalThis as any).fetch = vi.fn(async (url: string) => {
            if (typeof url === 'string' && url.includes('/api/onboarding/is-fresh-install')) {
                return {ok: true, json: async () => ({fresh: true})} as any;
            }
            return {ok: true, json: async () => ({})} as any;
        });

        const AdminApp = await importAdminApp();
        render(<AdminApp session={baseSession()} t={t} tApp={t}/>);
        await flush();

        expect(replace).toHaveBeenCalledWith('/admin/onboarding');

        // Restore so subsequent tests / teardown don't see the stub.
        (window as any).location = originalLocation;
    });
});
