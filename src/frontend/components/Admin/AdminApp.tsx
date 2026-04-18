import React from 'react'
import {resolve} from "../../gqty";
import {Button, ConfigProvider, Popconfirm, Spin, Switch, Tabs, Tag, message, theme as antdTheme} from 'antd';
import {BulbFilled, BulbOutlined, CloudUploadOutlined} from "@ant-design/icons";
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
import EditWrapper from "../common/EditWrapper";
import {EditOutlined} from "@ant-design/icons";
import {INavigation} from "../../../Interfaces/INavigation";
import {TFunction} from "i18next";
import {UserRole} from "../../../Interfaces/IUser";
import AuditBadge from "./AuditBadge";

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

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
    componentDidMount() {
        void this.initialize()
        void this.loadPublishedMeta()
        void this.loadThemeVars()
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem('admin.darkMode');
            if (saved === '1') this.setState({darkMode: true});
        }
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

    onEdit = async (targetKey: TargetKey, action: 'add' | 'remove') => {
        if (!this.canEditNav) return;
        if (action === 'add') {
            this.setState({addNewDialogOpen: true, activeNavigation: {}})
        } else {
            let page
            const newItems = this.state.tabProps.filter((item) => {
                if (item.key === targetKey) {
                    page = item.page
                }
                return item.key !== targetKey
            });
            if (page) {
                await this.MongoApi.deleteNavigation(page)
                this.setState({tabProps: newItems, activeTab: 1, loading: false})
            }
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
                        label:
                            <div className={'navigation-container'} style={{display: 'flex', alignItems: 'center', gap: 10}}>
                                <EditWrapper t={this.props.t} edit={true} editContent={<div>
                                    <Button onClick={() => {
                                        const pageIndex: number = parseInt(id);
                                        if (this.state.pages.length > 0) {
                                            const page = pages[pageIndex]
                                            this.setState({
                                                activeNavigation: page,
                                                addNewDialogOpen: true
                                            })
                                        }

                                    }}><EditOutlined/></Button>
                                </div>} admin={this.admin}>
                                    {pages[id].page}
                                </EditWrapper>
                                {this.admin && (
                                    <AuditBadge
                                        compact
                                        editedBy={(pages[id] as any).editedBy}
                                        editedAt={(pages[id] as any).editedAt}
                                    />
                                )}
                            </div>,
                        children: (
                            <DynamicTabsContent
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

    render() {
        return (
            <ConfigProvider theme={{
                ...staticTheme,
                algorithm: this.state.darkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}>
                <Spin spinning={this.state.loading}>
                    <Logo admin={this.admin} t={this.props.t}/>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px', justifyContent: 'flex-end'}}>
                        <Switch
                            checked={this.state.darkMode}
                            onChange={this.toggleDarkMode}
                            checkedChildren={<BulbFilled/>}
                            unCheckedChildren={<BulbOutlined/>}
                        />
                    </div>
                    {this.canPublish && (
                        <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px'}}>
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
                        </div>
                    )}
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
                    <Tabs
                        key={'tabs'}
                        type={this.canEditNav ? "editable-card" : "card"}
                        tabBarStyle={{
                            display: "flex",
                            justifyContent: "space-between",
                            textTransform: "uppercase"
                        }}
                        onEdit={this.onEdit}
                        onChange={(value) => {
                            this.setState({activeTab: value})
                        }}
                        activeKey={this.state.activeTab}
                        defaultActiveKey={"0"}
                        items={this.state.tabProps}
                    />
                </Spin>
            </ConfigProvider>
        );
    }
};

export default AdminApp;