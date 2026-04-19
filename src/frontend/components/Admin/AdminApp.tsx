import React from 'react'
import {resolve} from "../../gqty";
import {Button, ConfigProvider, Layout, Menu, Popconfirm, Spin, Switch, Tag, message, theme as antdTheme} from 'antd';
import {BulbFilled, BulbOutlined, CloseOutlined, CloudUploadOutlined, EditOutlined, PlusOutlined} from "../common/icons";
import PublishApi from "../../api/PublishApi";
import AddNewDialogNavigation from "../common/Dialogs/AddNewDialogNavigation";
import DynamicTabsContent from "../DynamicTabsContent";
import {IPage} from "../../../Interfaces/IPage";
import staticTheme from '../../theme/themeConfig';
import {applyThemeCssVars} from '../../theme/applyThemeCssVars';
import ThemeApi from '../../api/ThemeApi';
import {IMongo} from "../../../Interfaces/IMongo";
import MongoApi from '../../api/MongoApi';
import Logo from "../common/Logo";
import {Session} from "next-auth";
import {INavigation} from "../../../Interfaces/INavigation";
import {TFunction} from "i18next";
import {UserRole} from "../../../Interfaces/IUser";
import AuditBadge from "./AuditBadge";
import UndoStatusPill from "./UndoStatusPill";
import {refreshBus} from "../../lib/refreshBus";

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
        void this.initialize()
        void this.loadPublishedMeta()
        void this.loadThemeVars()
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem('admin.darkMode');
            if (saved === '1') this.setState({darkMode: true});
        }
        this.refreshUnsub = refreshBus.subscribe(() => this.refreshView());
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

    deletePage = async (key: string) => {
        if (!this.canEditNav) return;
        const target = this.state.tabProps.find(t => t.key === key);
        if (!target) return;
        const newItems = this.state.tabProps.filter(t => t.key !== key);
        await this.MongoApi.deleteNavigation(target.page);
        const nextActive = newItems[0]?.key ?? '0';
        this.setState({tabProps: newItems, activeTab: nextActive, loading: false});
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
                        seo: itemSeo,
                        sections: item.sections,
                        editedBy: (item as any).editedBy,
                        editedAt: (item as any).editedAt,
                    })
                })
                return list
            }
        )
        const newTabsState = []
        if (pages[0]) {
            for (let id in pages) {
                if (pages[id]) {
                    const sectionsData: any[] = await this.MongoApi.loadSections(pages[id].page, pages)
                    newTabsState.push({
                        key: id,
                        page: pages[id].page,
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
        this.setState(newState)
    }

    renderMenuItems() {
        // Layout: page name + (below) audit badge stacked on the left, edit /
        // delete actions pinned to the right and always visible. Previously
        // the audit pill shared the row with the actions and pushed them out
        // of the menu-item's content box — making "Delete page" unreachable
        // once a badge was present.
        return this.state.tabProps.map((tp: any) => ({
            key: tp.key,
            label: (
                <div className="admin-sider-item" style={{
                    display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
                }}>
                    <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2}}>
                        <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase',
                            display: 'block',
                            lineHeight: 1.3,
                        }}>
                            {tp.page}
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
                            <Popconfirm
                                title={this.props.t('Delete page?')}
                                okText={this.props.t('Delete')}
                                cancelText={this.props.t('Cancel')}
                                okButtonProps={{danger: true}}
                                onConfirm={() => this.deletePage(tp.key)}
                            >
                                <Button
                                    size="small"
                                    type="text"
                                    danger
                                    icon={<CloseOutlined/>}
                                    onClick={e => e.stopPropagation()}
                                    aria-label={this.props.t('Delete page')}
                                />
                            </Popconfirm>
                        </span>
                    )}
                </div>
            ),
        }));
    }

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
                        {this.canEditNav && <UndoStatusPill t={this.props.t}/>}
                        {this.canPublish && (
                            <>
                                <Popconfirm
                                    title={this.props.t('Publish to production?')}
                                    description={this.props.t('This copies the current draft to the live published snapshot.')}
                                    okText={this.props.t('Publish')}
                                    cancelText={this.props.t('Cancel')}
                                    onConfirm={this.publish}
                                >
                                    <Button type="primary" icon={<CloudUploadOutlined/>} loading={this.state.publishing}>
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
                        <Switch
                            checked={this.state.darkMode}
                            onChange={this.toggleDarkMode}
                            checkedChildren={<BulbFilled/>}
                            unCheckedChildren={<BulbOutlined/>}
                        />
                    </div>
                    <AddNewDialogNavigation
                        t={this.props.t}
                        close={() => {
                            this.setState({addNewDialogOpen: false})
                        }}
                        activeNavigation={this.state.activeNavigation}
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