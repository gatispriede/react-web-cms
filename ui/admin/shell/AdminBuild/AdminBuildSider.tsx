import React, {useState} from 'react';
import {Button, Drawer, Layout, Menu} from 'antd';
import {MenuOutlined, PlusOutlined} from "@client/lib/icons";
import {TFunction} from "i18next";
import {useIsMobile} from '@admin/lib/useIsMobile';

interface AdminBuildSiderProps {
    darkMode: boolean;
    siderCollapsed: boolean;
    onToggleSider: (collapsed: boolean) => void;
    menuItems: any[];
    activeTab: string;
    onActiveTabChange: (key: string) => void;
    canEditNav: boolean;
    onAddPage: () => void;
    t: TFunction<"translation", undefined>;
}

/**
 * Left sider for /admin/build — page tree menu + "New page" CTA. The menu
 * items are built upstream by `pageMenuBuilder` so this component stays a
 * pure presentational shell.
 *
 * Below the admin mobile breakpoint (768 px, see `useIsMobile`), the
 * sider becomes a `<Drawer>` slide-in with a top-bar hamburger trigger
 * — Wave 1 mobile-friendly admin. The desktop `<Layout.Sider>` keeps
 * its existing breakpoint="md" auto-collapse behavior at the AntD layer
 * for tablet-narrow widths above the mobile threshold; the drawer
 * pattern only kicks in below 768 px.
 */
const SIDER_BODY_CLASS = 'admin-build-sider-body';

const AdminBuildSider: React.FC<AdminBuildSiderProps> = ({
    darkMode, siderCollapsed, onToggleSider, menuItems,
    activeTab, onActiveTabChange, canEditNav, onAddPage, t,
}) => {
    const isMobile = useIsMobile();
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Shared body content — the menu + the New-page CTA. Rendered both
    // inside `<Layout.Sider>` (desktop) and `<Drawer>` (mobile) so the
    // operator gets the same set of controls regardless of viewport.
    const body = (
        <div data-testid={SIDER_BODY_CLASS} className={SIDER_BODY_CLASS}>
            <Menu
                mode="inline"
                theme={darkMode ? 'dark' : 'light'}
                selectedKeys={[activeTab]}
                onClick={({key}) => {
                    onActiveTabChange(key);
                    if (isMobile) setDrawerOpen(false); // dismiss after pick
                }}
                items={menuItems}
                style={{borderInlineEnd: 'none'}}
            />
            {canEditNav && (
                <div style={{padding: 12, textAlign: 'center'}}>
                    <Button
                        data-testid="nav-add-page-btn"
                        type="dashed"
                        icon={<PlusOutlined/>}
                        onClick={() => {
                            onAddPage();
                            if (isMobile) setDrawerOpen(false);
                        }}
                        block={!siderCollapsed || isMobile}
                    >
                        {(!siderCollapsed || isMobile) && t('New page')}
                    </Button>
                </div>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <>
                <Button
                    data-testid="admin-shell-drawer-toggle"
                    type="text"
                    icon={<MenuOutlined/>}
                    onClick={() => setDrawerOpen(true)}
                    aria-label={t('Open navigation')}
                    style={{position: 'fixed', top: 8, left: 8, zIndex: 50}}
                />
                <Drawer
                    data-testid="admin-shell-drawer"
                    data-state={drawerOpen ? 'open' : 'closed'}
                    placement="left"
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    width="80vw"
                    styles={{body: {padding: 0, background: darkMode ? '#1f1f1f' : undefined}}}
                    closeIcon={null}
                    title={t('Navigation')}
                >
                    {body}
                </Drawer>
            </>
        );
    }

    return (
        <Layout.Sider
            collapsible
            collapsed={siderCollapsed}
            onCollapse={onToggleSider}
            breakpoint="md"
            width={240}
            theme={darkMode ? 'dark' : 'light'}
            style={{borderRight: '1px solid rgba(0,0,0,0.06)', minHeight: '70vh'}}
        >
            {body}
        </Layout.Sider>
    );
};

export default AdminBuildSider;
