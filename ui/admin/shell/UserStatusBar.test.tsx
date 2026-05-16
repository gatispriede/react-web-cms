// @vitest-environment jsdom
/**
 * Smoke tests for UserStatusBar. These are the safety net for an
 * upcoming refactor — they assert on the public surface the rest of the
 * admin shell relies on:
 *  - top-bar area buttons (Site / Content / Commerce / People / Analytics / System)
 *    rendered with `nav-area-<slug>-link` testids — admin-information-architecture
 *    jump (2026-05-16) replaced the legacy six (Build / Client config / Content
 *    / SEO / Release / System) with the new operator-mental-model taxonomy.
 *  - active-area highlight via antd's `type="primary"` (rendered as the
 *    `ant-btn-primary` class)
 *  - `<AreaNav/>` rail rendered when an area view is active, including
 *    the `adminOnly` filter behaviour
 *  - sign-out button wires to `signOut` from next-auth/react
 *  - presence/absence of common chrome (skip-to-content link, user name)
 *
 * Anything heavy (admin sub-pane components, API clients, the
 * AdminUILoader registry, the public-site `next-i18next` instance) is
 * mocked at the module boundary so the test can render the bar without
 * the full admin tree.
 */
import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ---- Mocks ----------------------------------------------------------------

// next-auth/react — capture signOut so the sign-out test can assert.
const signOutSpy = vi.fn();
vi.mock('next-auth/react', () => ({
    signOut: (...args: any[]) => signOutSpy(...args),
}));

// next-i18next/pages — supplies `useTranslation` (for the `common` ns
// fetch) and the `i18n` export the component reads to compute `lang`.
vi.mock('next-i18next/pages', () => {
    const i18n = {
        language: 'en',
        resolvedLanguage: 'en',
        use: () => i18n,
    };
    return {
        i18n,
        useTranslation: () => ({
            t: (k: string) => k,
            i18n,
        }),
    };
});

// i18next-http-backend — referenced via `i18nCommon.use(Backend)`. The
// `use()` call from the mocked i18n above accepts any arg, so this just
// needs to exist as a default export.
vi.mock('i18next-http-backend', () => ({default: class {}}));

// react-i18next — the inner uses `useTranslation` for `tAdmin` and
// `I18nextProvider` to wrap. Both must work; the provider can be a
// pass-through and `useTranslation` returns identity `t` + a stub i18n.
vi.mock('react-i18next', () => {
    const i18n = {language: 'en', resolvedLanguage: 'en'};
    return {
        I18nextProvider: ({children}: any) => <>{children}</>,
        useTranslation: () => ({t: (k: string) => k, i18n}),
    };
});

// adminI18n module — provides ADMIN_LOCALES, setAdminLocale, etc. Only
// the shape matters; the dropdown renders the labels.
vi.mock('@admin/i18n/adminI18n', () => ({
    default: {language: 'en'},
    ADMIN_LOCALES: [
        {code: 'en', label: 'English'},
        {code: 'lv', label: 'Latviešu'},
    ],
    setAdminLocale: vi.fn(),
    detectStoredOrNavigatorLocale: () => 'en',
}));

// SiteFlagsApi — `.get()` is awaited in a `useEffect`. Resolve with
// `{blogEnabled: true}` so the post-mount `setState` is harmless.
vi.mock('@services/api/client/SiteFlagsApi', () => ({
    default: class {
        get() {
            return Promise.resolve({blogEnabled: true});
        }
    },
}));

// UserApi — only invoked when the admin-locale dropdown changes; never
// called in these tests but the constructor must exist.
vi.mock('@services/api/client/UserApi', () => ({
    default: class {
        updateUser() {
            return Promise.resolve();
        }
    },
}));

// adminMode hook — return advanced by default; tests that need
// `simplified` would override but none of our smoke tests do.
vi.mock('@admin/lib/adminMode', () => ({
    useAdminMode: () => ({mode: 'advanced'}),
}));

// AdminUILoader registry — return null for every view, forcing the
// component down its legacy switch path. The legacy path renders `null`
// for area landings (`system`, `content`, …) which is exactly what the
// smoke tests want — area landing renders the AreaNav rail and an
// empty pane.
vi.mock('@admin/lib/loaders/adminUILoaderRegistry', () => ({
    findAdminPaneById: () => null,
}));

// reportError — the component dynamic-imports this. Stub to a no-op so
// the resolved module doesn't throw.
vi.mock('@client/lib/reportError', () => ({
    installErrorReporter: () => {},
}));

// CommandPalette — render-through provider placeholder + trigger stub.
// The kbar palette is mounted at the shell level; the test only needs
// it to render its children without pulling kbar into the test bundle.
vi.mock('@admin/shell/CommandPalette/CommandPalette', () => ({
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => <div data-testid="command-palette">{children}</div>,
    CommandPaletteTrigger: ({label}: {label: string}) => <button data-testid="cmdk-trigger">{label}</button>,
}));

// Chrome placeholders.
vi.mock('@admin/shell/AdminModeSwitcher', () => ({
    __esModule: true,
    default: () => <div data-testid="admin-mode-switcher"/>,
}));
vi.mock('@admin/shell/DarkModeSwitcher', () => ({
    __esModule: true,
    default: () => <div data-testid="dark-mode-switcher"/>,
}));

// Sub-pane / feature components — none of them are rendered for our
// view literals (`app`, `system`, `content`) so each stub is a tiny
// placeholder. They still need to import-resolve. Factories are inlined
// because `vi.mock` is hoisted above any top-level `const`.
vi.mock('./AdminApp', () => ({__esModule: true, default: () => <div/>}));
vi.mock('./AdminSettings', () => ({__esModule: true, default: () => <div/>}));
vi.mock('./TranslationManager', () => ({__esModule: true, default: class {}}));
vi.mock('@admin/features/Languages/Languages', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Themes/ThemeAdvancedView', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Logo/LogoSettings', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Navigation/Layout', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Posts/PostsAdvancedView', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Footer/Footer', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Products/Products', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Inventory/Inventory', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Orders/Orders', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Seo/SEO', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Publishing/Publishing', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Bundle/Bundle', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Audit/AuditTab', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Observability/ErrorLogPanel', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Analytics/AnalyticsPanel', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Users/Users', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Mcp/McpTokensPanel', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Platform/FeatureFlagsPanel', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@admin/features/Inquiries/Inquiries', () => ({__esModule: true, default: () => <div/>}));
vi.mock('@client/lib/preview/ModulesPreview', () => ({__esModule: true, default: () => <div/>}));

// ---- Imports under test ---------------------------------------------------

import UserStatusBar, {AdminView} from './UserStatusBar';

// Helper — minimal session shape with role on `user`.
const makeSession = (role: 'admin' | 'editor' | 'viewer' = 'admin', name = 'Ada') =>
    ({
        user: {id: 'u1', name, email: 'ada@example.com', role},
        expires: '',
    } as any);

const tStub = ((k: string) => k) as any;

const renderBar = (view: AdminView, role: 'admin' | 'editor' | 'viewer' = 'admin') =>
    render(
        <UserStatusBar
            session={makeSession(role)}
            view={view}
            t={tStub}
            tApp={tStub}
        />,
    );

// ---- Tests ----------------------------------------------------------------

describe('UserStatusBar', () => {
    beforeEach(() => {
        signOutSpy.mockClear();
    });

    it('renders without crashing on view="app" and shows the user name', () => {
        renderBar('app');
        expect(screen.getByText(/User: Ada/)).toBeInTheDocument();
        // Skip-to-content a11y affordance always present.
        expect(screen.getByText('Skip to content')).toBeInTheDocument();
        // All six new-taxonomy area buttons render (admin + advanced mode).
        expect(screen.getByTestId('nav-area-site-link')).toBeInTheDocument();
        expect(screen.getByTestId('nav-area-content-link')).toBeInTheDocument();
        expect(screen.getByTestId('nav-area-commerce-link')).toBeInTheDocument();
        expect(screen.getByTestId('nav-area-people-link')).toBeInTheDocument();
        expect(screen.getByTestId('nav-area-analytics-link')).toBeInTheDocument();
        expect(screen.getByTestId('nav-area-system-link')).toBeInTheDocument();
    });

    it('active area gets antd primary treatment (System highlighted on view="system")', () => {
        renderBar('system');
        const systemBtn = screen.getByTestId('nav-area-system-link');
        expect(systemBtn.className).toMatch(/ant-btn-primary/);
        // Sibling Site button is NOT primary.
        const siteBtn = screen.getByTestId('nav-area-site-link');
        expect(siteBtn.className).not.toMatch(/ant-btn-primary/);
    });

    it('System area rail renders the right sub-pages for an admin viewer', () => {
        renderBar('system', 'admin');
        const rail = screen.getByTestId('nav-system-rail');
        // Admin sees the system rail's adminOnly entries.
        expect(within(rail).getByTestId('nav-system-diagnostics-link')).toBeInTheDocument();
        expect(within(rail).getByTestId('nav-system-mcp-link')).toBeInTheDocument();
        expect(within(rail).getByTestId('nav-system-features-link')).toBeInTheDocument();
        expect(within(rail).getByTestId('nav-system-errors-link')).toBeInTheDocument();
    });

    it('System area rail filters adminOnly entries for non-admin viewers', () => {
        renderBar('system', 'viewer');
        // Every entry in the post-IA System rail is adminOnly — for a viewer
        // the rail is empty (or absent). `nav-system-rail` may still render
        // with zero items; the testids of the adminOnly entries should be
        // gone.
        expect(screen.queryByTestId('nav-system-diagnostics-link')).not.toBeInTheDocument();
        expect(screen.queryByTestId('nav-system-features-link')).not.toBeInTheDocument();
        expect(screen.queryByTestId('nav-system-errors-link')).not.toBeInTheDocument();
    });

    it('clicking Sign out invokes next-auth signOut()', () => {
        renderBar('app');
        const signOutBtn = screen.getByRole('link', {name: /Sign out/});
        signOutBtn.click();
        expect(signOutSpy).toHaveBeenCalledTimes(1);
    });

    it('no AreaNav rail on a legacy view (view="app")', () => {
        renderBar('app');
        // No area is active for `app`, so no rail should render.
        expect(screen.queryByTestId('nav-system-rail')).not.toBeInTheDocument();
        expect(screen.queryByTestId('nav-content-rail')).not.toBeInTheDocument();
        expect(screen.queryByTestId('nav-build-rail')).not.toBeInTheDocument();
    });

    it('AdminView union accepts the documented variant strings', () => {
        // Compile-time check: the assignments wouldn't typecheck if any
        // of these strings dropped out of the union.
        const variants: AdminView[] = [
            'app',
            'settings',
            'languages',
            'modules-preview',
            'build',
            'build/modules-preview',
            'client-config',
            'client-config/themes',
            'client-config/logo',
            'client-config/site-layout',
            'content',
            'content/translations',
            'content/posts',
            'content/footer',
            'content/products',
            'content/inventory',
            'content/orders',
            'seo',
            'seo/analytics',
            'release',
            'release/publishing',
            'release/bundle',
            'release/audit',
            'system',
            'system/users',
            'system/mcp',
            'system/analytics-filters',
            'system/inquiries',
            'system/features',
            'system/agent',
            'system/info',
            'system/email',
            'system/errors',
        ];
        // Runtime sanity — non-empty + unique.
        expect(variants.length).toBeGreaterThan(0);
        expect(new Set(variants).size).toBe(variants.length);
    });
});
