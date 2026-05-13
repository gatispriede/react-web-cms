import React from 'react'
import {ConfigProvider, Layout, Modal, Spin, theme as antdTheme} from 'antd';
import {Toaster} from 'sonner';
import {notifyError, notifySuccess} from '@admin/lib/notify';
import PublishApi from "@services/api/client/PublishApi";
import AddNewDialogNavigation from "@admin/features/Navigation/AddNewDialogNavigation";
import {IPage} from "@interfaces/IPage";
import staticTheme from '@client/features/Themes/themeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import ThemeApi from '@services/api/client/ThemeApi';
import MongoApi from '@services/api/client/MongoApi';
import {GuardedAction} from '@admin/lib/useGuardedAction';
import {Session} from "next-auth";
import {INavigation} from "@interfaces/INavigation";
import {TFunction} from "i18next";
import {UserRole} from "@interfaces/IUser";
import {refreshBus} from "@client/lib/refreshBus";
import {setAnchors} from "@admin/lib/anchorRegistry";
import {getCachedMode} from "@admin/lib/adminMode";
import AdminBuildHeader from "./AdminBuild/AdminBuildHeader";
import AdminBuildSider from "./AdminBuild/AdminBuildSider";
import {buildPageMenuItems} from "./AdminBuild/pageMenuBuilder";
import {loadNavigationPages} from "./AdminBuild/loadNavigationPages";
import CommandPalette from "./CommandPalette/CommandPalette";
import InlineEditOverlay from "./InlineEdit/InlineEditOverlay";

interface IHomeState {
    loading: boolean,
    addNewDialogOpen: boolean,
    activeNavigation: INavigation,
    activeTab: string,
    pages: IPage[],
    tabProps: any[],
    publishedAt?: string,
    publishing?: boolean,
    darkMode: boolean,
    siderCollapsed: boolean,
    /** Sider parent rows that are currently expanded. Manual flattening
     *  (we don't pass `children` to AntD `<Menu items>`) means AntD's
     *  built-in SubMenu expand-on-title-click doesn't fire. That
     *  bought us option B from the click-parent design choice: the
     *  title click navigates (sets `activeTab`), the chevron button in
     *  the label toggles `openKeys`. */
    openKeys: string[],
}

class AdminApp extends React.Component<{
    session: Session,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}> {
    sections: any[] = []
    /** Section lookup populated on every `initialize()`. The inline-edit
     *  overlay reads this to dispatch a `data-edit-target` click through
     *  to the right section row when persisting. Map identity is reused
     *  so the overlay's useCallback memo isn't busted on every re-render. */
    private sectionsById: Map<string, any> = new Map()
    role: UserRole = 'viewer'
    admin: boolean = false
    canEditNav: boolean = false
    canPublish: boolean = false
    private MongoApi
    private PublishApi = new PublishApi()
    private ThemeApi = new ThemeApi()

    state: IHomeState = {
        loading: true,
        addNewDialogOpen: false,
        activeNavigation: {
            page: '',
            sections: [],
            type: '',
            id: '',
            seo: undefined
        },
        pages: [],
        tabProps: [],
        activeTab: '0',
        darkMode: false,
        siderCollapsed: typeof window !== 'undefined' && window.localStorage.getItem('admin.sider.collapsed') === '1',
        openKeys: [],
    }

    constructor(props: { session: any, t: TFunction<"translation", undefined>, tApp: TFunction<"translation", undefined> }) {
        super(props);
        this.MongoApi = new MongoApi()
        const role = ((props.session?.user as any)?.role ?? 'viewer') as UserRole;
        this.role = role;
        this.admin = role !== 'viewer';
        this.canEditNav = role === 'editor' || role === 'admin';
        this.canPublish = Boolean((props.session?.user as any)?.canPublishProduction) && this.canEditNav;
    }

    loadPublishedMeta = async () => {
        const meta = await this.PublishApi.getMeta();
        if (meta?.publishedAt) this.setState({publishedAt: meta.publishedAt});
    };

    publish = async () => {
        this.setState({publishing: true});
        try {
            const result = await this.PublishApi.publish();
            if (result.error) {
                notifyError(result.error);
                return;
            }
            notifySuccess(`Published at ${result.publishedAt}`);
            this.setState({publishedAt: result.publishedAt});
        } finally {
            this.setState({publishing: false});
        }
    };
    private refreshUnsub?: () => void;

    componentDidMount() {
        // Q7 — first-run guard. If the install is fresh (no admin yet),
        // bounce straight to the wizard. Runs once, on initial mount only,
        // and only when the user is on `/admin` or `/admin/build` (the two
        // landing routes a brand-new install can reach). The wizard route
        // itself short-circuits before this guard ever sees it.
        if (typeof window !== 'undefined') {
            const path = window.location.pathname;
            if (path === '/admin' || path === '/admin/build') {
                void this.checkFreshInstall();
            }
        }
        void this.initialize()
        void this.loadPublishedMeta()
        void this.loadThemeVars()
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem('admin.darkMode');
            if (saved === '1') this.setState({darkMode: true});
            document.documentElement.setAttribute('data-admin-theme', saved === '1' ? 'dark' : 'light');
        }
        this.refreshUnsub = refreshBus.subscribe(() => this.refreshView());
    }

    private async checkFreshInstall(): Promise<void> {
        // Q7 first-run guard. Hits a REST endpoint instead of gqty so a
        // missing-schema-field (when `npm run generate-schema` hasn't been
        // run after Q7 landed) doesn't poison the gqty client and leave
        // every subsequent query — including the build page's own
        // navigation fetch — stuck on a stale validation error.
        if (typeof window === 'undefined') return;
        try {
            const r = await fetch('/api/onboarding/is-fresh-install', {credentials: 'include'});
            if (!r.ok) return;
            const body = await r.json();
            if (body?.fresh === true) {
                window.location.replace('/admin/onboarding');
            }
        } catch { /* probe is best-effort — ignore wire errors */ }
    }

    componentWillUnmount() {
        this.refreshUnsub?.();
    }

    /** Called by the RefreshBus on any content mutation. Re-fetches nav + theme. */
    refreshView = async (): Promise<void> => {
        await this.initialize();
        await this.loadThemeVars();
        await this.loadPublishedMeta();
    }

    toggleDarkMode = (on: boolean) => {
        this.setState({darkMode: on});
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('admin.darkMode', on ? '1' : '0');
            // Stamp the document so custom SCSS (sider chrome, header
            // strip, drawer overlays — anything outside AntD's
            // ConfigProvider scope) can flip via
            // `[data-admin-theme="dark"]` selectors.
            document.documentElement.setAttribute('data-admin-theme', on ? 'dark' : 'light');
        }
    };

    loadThemeVars = async () => {
        const active = await this.ThemeApi.getActive();
        if (active?.tokens) applyThemeCssVars(active.tokens);
    };

    openAdd = () => {
        if (!this.canEditNav) return;
        this.setState({addNewDialogOpen: true, activeNavigation: {page: '', sections: [], type: '', id: '', seo: undefined}});
    }

    openEdit = (pageIndex: number) => {
        if (!this.canEditNav) return;
        const page = this.state.pages[pageIndex];
        if (!page) return;
        this.setState({activeNavigation: page as any, addNewDialogOpen: true});
    }

    /**
     * F2 destructive guard for the page-delete path. Re-entrant Modal
     * confirms (server slow, user double-OKs) collapse to a single
     * mutation; the fresh `idempotencyKey` lets the server collapse
     * network-level retries inside the TTL window.
     */
    private deletePageAction = new GuardedAction<[string]>(async ({idempotencyKey}, key) => {
        if (!this.canEditNav) return;
        const target = this.state.tabProps.find(t => t.key === key);
        if (!target) return;
        // Optimistic splice — the spec asserts the row disappears either
        // immediately or after a list refresh. Splicing before the await
        // makes the e2e (and humans) get instant feedback.
        const newItems = this.state.tabProps.filter(t => t.key !== key);
        const nextActive = newItems[0]?.key ?? '0';
        this.setState({tabProps: newItems, activeTab: nextActive, loading: false});
        try {
            await this.MongoApi.deleteNavigation(target.page, {idempotencyKey});
            notifySuccess(this.props.t('Page deleted'));
        } catch (err) {
            // Roll back the optimistic splice by reloading from server.
            notifyError(err);
            await this.initialize();
        }
    });

    deletePage = async (key: string) => {
        await this.deletePageAction.trigger(key);
    }

    toggleSider = (collapsed: boolean) => {
        this.setState({siderCollapsed: collapsed});
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('admin.sider.collapsed', collapsed ? '1' : '0');
        }
    }

    async initialize(): Promise<void> {
        let newState: IHomeState = {
            loading: false,
            addNewDialogOpen: false,
            pages: this.state.tabProps,
            tabProps: this.state.tabProps,
            activeTab: this.state.activeTab,
            darkMode: this.state.darkMode,
            siderCollapsed: this.state.siderCollapsed,
            openKeys: this.state.openKeys,
            activeNavigation: {
                id: '',
                page: '',
                sections: [],
                type: '',
                seo: undefined
            }
        }
        const {pages, tabProps: newTabsState, sectionsByPage} = await loadNavigationPages({
            mongoApi: this.MongoApi,
            t: this.props.t,
            tApp: this.props.tApp,
            admin: this.admin,
            onRefresh: async () => { await this.initialize(); },
        });

        newState.tabProps = newTabsState
        newState.pages = pages
        // Default-expand any sider row that has children, but only on
        // first load (don't clobber the operator's choice on refresh).
        if (this.state.openKeys.length === 0) {
            const parentKeys = newTabsState
                .filter((tp: any) => newTabsState.some((c: any) => c.parent && c.parent === tp.id))
                .map((tp: any) => tp.key);
            newState.openKeys = parentKeys;
        }
        // Refresh the link-target picker's options. Cheap walk over already-
        // loaded data — no extra fetches. See `anchorRegistry` + `LinkTargetPicker`.
        try {
            setAnchors(pages.map((p: any) => ({page: p.page})), sectionsByPage);
        } catch (err) {
            console.warn('anchorRegistry refresh failed:', err);
        }
        // Refresh the inline-edit overlay's section lookup. Re-uses the
        // same Map identity so the overlay's `useCallback` memoization
        // does not regenerate the save handler on every initialize().
        this.sectionsById.clear();
        for (const list of Object.values(sectionsByPage)) {
            for (const s of (list as any[])) {
                if (s?.id) this.sectionsById.set(s.id, s);
            }
        }
        this.setState(newState)
    }

    toggleOpenKey = (key: string) => {
        this.setState((s: IHomeState) => ({
            openKeys: s.openKeys.includes(key)
                ? s.openKeys.filter(k => k !== key)
                : [...s.openKeys, key],
        }));
    };

    /** F1 sub-pages — delete prompt that asks the operator what to do
     *  with children when the deleted page has any. Default: orphan
     *  (re-parent each direct child to root). Cascade: delete each
     *  child first via `cascadeDelete` then the parent. */
    confirmDelete = async (tp: any) => {
        if (!this.canEditNav) return;
        const children = this.state.tabProps.filter((t: any) => t.parent === tp.id);
        if (children.length === 0) {
            Modal.confirm({
                title: this.props.t('Delete page?'),
                okText: this.props.t('Delete'),
                cancelText: this.props.t('Cancel'),
                okButtonProps: {danger: true, 'data-testid': 'nav-page-delete-confirm-btn'} as any,
                onOk: () => this.deletePage(tp.key),
            });
            return;
        }
        Modal.confirm({
            title: this.props.t('Delete "{{name}}"?', {name: tp.page}),
            content: this.props.t(
                'This page has {{count}} child page(s). Move them to root, or cascade delete the entire subtree?',
                {count: children.length},
            ),
            okText: this.props.t('Move children to root'),
            cancelText: this.props.t('Cancel'),
            okButtonProps: {'data-testid': 'nav-page-delete-confirm-btn'} as any,
            onOk: async () => {
                // Default — orphan each direct child, then drop the parent.
                for (const c of children) {
                    await this.MongoApi.setNavigationParent(c.id, null);
                }
                await this.deletePage(tp.key);
            },
            // The third "cascade delete" option lives behind a secondary
            // modal so the destructive path is one extra click. Wired up
            // once `cascadeDelete` is integrated into the navigation
            // delete handler (see follow-ups in roadmap/sub-pages.md).
            footer: undefined,
        });
    };

    private setActiveTab = (key: string) => {
        this.setState({activeTab: key});
    };

    private closeAddDialog = () => {
        this.setState({addNewDialogOpen: false});
    };

    private refreshFromDialog = async () => {
        await this.initialize();
    };

    render() {
        const activeChildren = this.state.tabProps.find(t => t.key === this.state.activeTab)?.children
            ?? this.state.tabProps[0]?.children;
        const menuItems = buildPageMenuItems({
            tabProps: this.state.tabProps,
            openKeys: this.state.openKeys,
            siderCollapsed: this.state.siderCollapsed,
            isAdmin: this.admin,
            canEditNav: this.canEditNav,
            t: this.props.t,
            onToggleOpenKey: this.toggleOpenKey,
            onOpenEdit: this.openEdit,
            onConfirmDelete: this.confirmDelete,
        });
        return (
            <ConfigProvider theme={{
                ...staticTheme,
                cssVar: true,
                // hashed: false would drop the per-component CSS-in-JS hash
                // entirely; we keep hashed on (default) so AntD's own styles
                // still scope. cssVar:true gives us `--ant-color-*` CSS
                // custom properties that admin SCSS under
                // `[data-admin-theme="dark"]` can consume (see
                // `ui/admin/styles/Admin/AdminDarkMode.scss`). Without this,
                // the parallel SCSS layer and the AntD ConfigProvider are
                // two unrelated palettes — see admin-dark-mode-audit spec.
                algorithm: this.state.darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}>
                <Toaster richColors closeButton position="bottom-right" duration={4000} />
                <InlineEditOverlay
                    enabled={this.canEditNav}
                    t={this.props.t}
                    sectionsById={this.sectionsById}
                />
                <CommandPalette>
                <Spin spinning={this.state.loading}>
                    <AdminBuildHeader
                        admin={this.admin}
                        t={this.props.t}
                        canEditNav={this.canEditNav}
                        canPublish={this.canPublish}
                        publishing={this.state.publishing}
                        publishedAt={this.state.publishedAt}
                        mode={getCachedMode()}
                        onPublish={this.publish}
                    />
                    <AddNewDialogNavigation
                        t={this.props.t}
                        close={this.closeAddDialog}
                        activeNavigation={this.state.activeNavigation}
                        allPages={this.state.pages as any}
                        open={this.state.addNewDialogOpen}
                        refresh={this.refreshFromDialog}
                    />
                    <Layout style={{background: 'transparent'}}>
                        <AdminBuildSider
                            darkMode={this.state.darkMode}
                            siderCollapsed={this.state.siderCollapsed}
                            onToggleSider={this.toggleSider}
                            menuItems={menuItems}
                            activeTab={this.state.activeTab}
                            onActiveTabChange={this.setActiveTab}
                            canEditNav={this.canEditNav}
                            onAddPage={this.openAdd}
                            t={this.props.t}
                        />
                        <Layout.Content
                            key={this.state.activeTab}
                            style={{padding: 16, minHeight: '70vh'}}
                        >
                            {activeChildren}
                        </Layout.Content>
                    </Layout>
                </Spin>
                </CommandPalette>
            </ConfigProvider>
        );
    }
};

export default AdminApp;
