import React from 'react'
import {resolve} from "@services/api/generated";
import {Button, ConfigProvider, Layout, Menu, Modal, Popconfirm, Spin, Tag, message, theme as antdTheme} from 'antd';
import {CloseOutlined, CloudUploadOutlined, DownOutlined, EditOutlined, FileOutlined, PlusOutlined} from "@client/lib/icons";
import PublishApi from "@services/api/client/PublishApi";
import AddNewDialogNavigation from "@admin/features/Navigation/AddNewDialogNavigation";
import DynamicTabsContent from "@client/lib/DynamicTabsContent";
import {IPage} from "@interfaces/IPage";
import staticTheme from '@client/features/Themes/themeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import ThemeApi from '@services/api/client/ThemeApi';
import {IMongo} from "@interfaces/IMongo";
import MongoApi from '@services/api/client/MongoApi';
import {GuardedAction} from '@admin/lib/useGuardedAction';
import Logo from "@client/features/Logo/Logo";
import {Session} from "next-auth";
import {INavigation} from "@interfaces/INavigation";
import {TFunction} from "i18next";
import {UserRole} from "@interfaces/IUser";
import AuditBadge from "./AuditBadge";
import UndoStatusPill from "./UndoStatusPill";
import {refreshBus} from "@client/lib/refreshBus";
import ImageRailDock from "@admin/features/Navigation/ImageRailDock";
import {setAnchors} from "@admin/lib/anchorRegistry";
import {getCachedMode} from "@admin/lib/adminMode";

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
                message.error(result.error);
                return;
            }
            message.success(`Published at ${result.publishedAt}`);
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
        const newItems = this.state.tabProps.filter(t => t.key !== key);
        await this.MongoApi.deleteNavigation(target.page, {idempotencyKey});
        const nextActive = newItems[0]?.key ?? '0';
        this.setState({tabProps: newItems, activeTab: nextActive, loading: false});
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
        const pages = await resolve(
            ({query}) => {
                const list: any[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                    let itemSeo
                    if (item.seo) {
                        itemSeo = {
                            description: item.seo.description,
                            keywords: item.seo.keywords,
                            viewport: item.seo.viewport,
                            charSet: item.seo.charSet,
                            url: item.seo.url,
                            image: item.seo.image,
                            image_alt: item.seo.image_alt,
                            author: item.seo.author,
                            locale: item.seo.locale,
                        }
                    }

                    return list.push({
                        page: item.page,
                        id: item.id,
                        type: item.type,
                        // F1 sub-pages — `parent` and `slug` feed the sider
                        // tree builder + breadcrumb. Reads return undefined
                        // for legacy rows, treated as roots.
                        parent: (item as any).parent,
                        slug: (item as any).slug,
                        seo: itemSeo,
                        sections: item.sections,
                        editedBy: (item as any).editedBy,
                        editedAt: (item as any).editedAt,
                    })
                })
                return list
            }
        )
        // F1 sub-pages — gqty doesn't yet expose `parent` / `slug` on
        // INavigation (regen pending). Pull them via raw GraphQL and
        // graft onto each page so the sider tree builds correctly.
        try {
            const ps = await this.MongoApi.fetchNavigationParentSlugMap();
            for (const p of pages) {
                const extra = ps.get((p as any).id);
                if (extra) {
                    (p as any).parent = extra.parent;
                    (p as any).slug = extra.slug;
                }
            }
        } catch (err) { console.warn('parent/slug graft failed', err); }

        const newTabsState: any[] = []
        const sectionsByPage: Record<string, any[]> = {};
        if (pages[0]) {
            for (let id in pages) {
                if (pages[id]) {
                    const sectionsData: any[] = await this.MongoApi.loadSections(pages[id].page, pages)
                    sectionsByPage[pages[id].page] = sectionsData;
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
                        // F1 sub-pages — carry id/parent so `renderMenuItems`
                        // can build the nested submenu structure and
                        // `deletePage` can offer the cascade prompt.
                        id: (pages[id] as any).id,
                        parent: (pages[id] as any).parent,
                        editedBy: (pages[id] as any).editedBy,
                        editedAt: (pages[id] as any).editedAt,
                        // Key by page name so React remounts `DynamicTabsContent` when the
                        // admin switches pages in the sidebar — the class stores
                        // `sections` on mount and never re-syncs from props.
                        children: (
                            <DynamicTabsContent
                                key={`page-${pages[id].page}`}
                                t={this.props.t}
                                tApp={this.props.tApp}
                                page={pages[id].page}
                                admin={this.admin}
                                sections={sectionsData}
                                refresh={async () => {
                                    await this.initialize()
                                }}
                            />
                        )
                    })
                }
            }

        }


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
        this.setState(newState)
    }

    toggleOpenKey = (key: string) => {
        this.setState((s: IHomeState) => ({
            openKeys: s.openKeys.includes(key)
                ? s.openKeys.filter(k => k !== key)
                : [...s.openKeys, key],
        }));
    };

    renderMenuItems() {
        // F1 sub-pages + click-parent-edits (option B) — `tabProps` is a
        // flat list (one entry per page). Build a parent → children tree
        // off `id` / `parent`, then *flatten back to a single-level list*
        // with depth-based indent. The flatten is deliberate: if we hand
        // AntD `<Menu items[].children>`, AntD renders a SubMenu and
        // intercepts the title click for expand/collapse — meaning a
        // click on a parent page can no longer set `activeTab` (i.e.
        // navigate to edit the parent itself). We want title click =
        // navigate, separate chevron = expand. Doing the flatten here
        // gives us full control over both interactions. Orphans
        // (parent points at a missing page) surface as roots.
        const byId = new Map<string, any>();
        for (const tp of this.state.tabProps) {
            if (tp.id) byId.set(tp.id, {...tp, kids: []});
        }
        const roots: any[] = [];
        for (const node of byId.values()) {
            if (node.parent && byId.has(node.parent)) {
                byId.get(node.parent)!.kids.push(node);
            } else {
                roots.push(node);
            }
        }
        const buildLabel = (tp: any, depth: number, hasKids: boolean, isOpen: boolean) => (
                <div
                    className="admin-sider-item"
                    data-testid={`nav-page-row-${String(tp.page).toLowerCase()}`}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                        paddingLeft: depth * 20,
                    }}
                >
                    <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2}}>
                        <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            lineHeight: 1.3,
                        }}>
                            {hasKids ? (
                                <Button
                                    size="small"
                                    type="text"
                                    aria-label={isOpen ? this.props.t('Collapse') : this.props.t('Expand')}
                                    aria-expanded={isOpen}
                                    data-testid={`nav-page-toggle-${String(tp.page).toLowerCase()}`}
                                    onClick={e => { e.stopPropagation(); this.toggleOpenKey(tp.key); }}
                                    icon={
                                        <DownOutlined
                                            style={{
                                                transition: 'transform 120ms',
                                                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            }}
                                        />
                                    }
                                    style={{flex: '0 0 auto', width: 20, height: 20, padding: 0, opacity: 0.7}}
                                />
                            ) : (
                                /* Generic per-page icon. A future per-page `iconName`
                                   (set via the navigation editor) would slot in here. */
                                <FileOutlined aria-hidden="true" style={{flex: '0 0 auto', opacity: 0.7}}/>
                            )}
                            <span style={{overflow: 'hidden', textOverflow: 'ellipsis'}}>{tp.page}</span>
                        </span>
                        {!this.state.siderCollapsed && this.admin && tp.editedAt && (
                            <span style={{lineHeight: 1.1, fontSize: 10, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                <AuditBadge compact editedBy={tp.editedBy} editedAt={tp.editedAt}/>
                            </span>
                        )}
                    </div>
                    {!this.state.siderCollapsed && this.canEditNav && (
                        <span
                            className="admin-sider-actions"
                            style={{display: 'inline-flex', gap: 2, flex: '0 0 auto'}}
                            onClick={e => e.stopPropagation()}
                        >
                            <Button
                                size="small"
                                type="text"
                                icon={<EditOutlined/>}
                                onClick={e => { e.stopPropagation(); this.openEdit(Number(tp.key)); }}
                                aria-label={this.props.t('Edit page')}
                            />
                            <Button
                                data-testid="nav-page-delete-btn"
                                size="small"
                                type="text"
                                danger
                                icon={<CloseOutlined/>}
                                onClick={e => { e.stopPropagation(); void this.confirmDelete(tp); }}
                                aria-label={this.props.t('Delete page')}
                            />
                        </span>
                    )}
                </div>
            );
        const out: any[] = [];
        const walk = (node: any, depth: number) => {
            const hasKids = node.kids.length > 0;
            const isOpen = this.state.openKeys.includes(node.key);
            out.push({
                key: node.key,
                label: buildLabel(node, depth, hasKids, isOpen),
            });
            if (hasKids && isOpen) {
                for (const c of node.kids) walk(c, depth + 1);
            }
        };
        for (const r of roots) walk(r, 0);
        return out;
    }

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

    render() {
        const activeChildren = this.state.tabProps.find(t => t.key === this.state.activeTab)?.children
            ?? this.state.tabProps[0]?.children;
        return (
            <ConfigProvider theme={{
                ...staticTheme,
                algorithm: this.state.darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}>
                <Spin spinning={this.state.loading}>
                    <div className="admin-app-header" style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', flexWrap: 'wrap',
                    }}>
                        <Logo admin={this.admin} t={this.props.t}/>
                        <div style={{flex: 1}}/>
                        {this.canEditNav && <ImageRailDock/>}
                        {this.canEditNav && <UndoStatusPill t={this.props.t}/>}
                        {this.canPublish && getCachedMode() !== 'simplified' && (
                            <>
                                <Popconfirm
                                    title={this.props.t('Publish to production?')}
                                    description={this.props.t('This copies the current draft to the live published snapshot.')}
                                    okText={this.props.t('Publish')}
                                    cancelText={this.props.t('Cancel')}
                                    okButtonProps={{'data-testid': 'publishing-publish-confirm-btn'} as any}
                                    onConfirm={this.publish}
                                >
                                    <Button data-testid="publishing-publish-btn" type="primary" icon={<CloudUploadOutlined/>} loading={this.state.publishing}>
                                        {this.props.t('Publish')}
                                    </Button>
                                </Popconfirm>
                                {this.state.publishedAt ? (
                                    <Tag color="green">
                                        {this.props.t('Last published')}: {new Date(this.state.publishedAt).toLocaleString()}
                                    </Tag>
                                ) : (
                                    <Tag>{this.props.t('No published snapshot yet')}</Tag>
                                )}
                            </>
                        )}
                        {/* Dark-mode toggle + AdminModeSwitcher live in
                            the top-top bar (UserStatusBar) so they
                            persist across every admin route, not just
                            /admin/build. AdminApp still reads the
                            localStorage flag on mount so the AntD
                            ConfigProvider's `darkAlgorithm` flips. */}
                    </div>
                    <AddNewDialogNavigation
                        t={this.props.t}
                        close={() => {
                            this.setState({addNewDialogOpen: false})
                        }}
                        activeNavigation={this.state.activeNavigation}
                        allPages={this.state.pages as any}
                        open={this.state.addNewDialogOpen}
                        refresh={async () => {
                            await this.initialize()
                        }}
                    />
                    <Layout style={{background: 'transparent'}}>
                        <Layout.Sider
                            collapsible
                            collapsed={this.state.siderCollapsed}
                            onCollapse={this.toggleSider}
                            breakpoint="md"
                            width={240}
                            theme={this.state.darkMode ? 'dark' : 'light'}
                            style={{borderRight: '1px solid rgba(0,0,0,0.06)', minHeight: '70vh'}}
                        >
                            <Menu
                                mode="inline"
                                theme={this.state.darkMode ? 'dark' : 'light'}
                                selectedKeys={[this.state.activeTab]}
                                onClick={({key}) => this.setState({activeTab: key})}
                                items={this.renderMenuItems()}
                                style={{borderInlineEnd: 'none'}}
                            />
                            {this.canEditNav && (
                                <div style={{padding: 12, textAlign: 'center'}}>
                                    <Button
                                        data-testid="nav-add-page-btn"
                                        type="dashed"
                                        icon={<PlusOutlined/>}
                                        onClick={this.openAdd}
                                        block={!this.state.siderCollapsed}
                                    >
                                        {!this.state.siderCollapsed && this.props.t('New page')}
                                    </Button>
                                </div>
                            )}
                        </Layout.Sider>
                        <Layout.Content
                            key={this.state.activeTab}
                            style={{padding: 16, minHeight: '70vh'}}
                        >
                            {activeChildren}
                        </Layout.Content>
                    </Layout>
                </Spin>
            </ConfigProvider>
        );
    }
};

export default AdminApp;