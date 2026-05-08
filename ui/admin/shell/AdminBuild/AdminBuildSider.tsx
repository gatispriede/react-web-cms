import React from 'react';
import {Button, Layout, Menu} from 'antd';
import {PlusOutlined} from "@client/lib/icons";
import {TFunction} from "i18next";

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
 */
const AdminBuildSider: React.FC<AdminBuildSiderProps> = ({
    darkMode, siderCollapsed, onToggleSider, menuItems,
    activeTab, onActiveTabChange, canEditNav, onAddPage, t,
}) => {
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
            <Menu
                mode="inline"
                theme={darkMode ? 'dark' : 'light'}
                selectedKeys={[activeTab]}
                onClick={({key}) => onActiveTabChange(key)}
                items={menuItems}
                style={{borderInlineEnd: 'none'}}
            />
            {canEditNav && (
                <div style={{padding: 12, textAlign: 'center'}}>
                    <Button
                        data-testid="nav-add-page-btn"
                        type="dashed"
                        icon={<PlusOutlined/>}
                        onClick={onAddPage}
                        block={!siderCollapsed}
                    >
                        {!siderCollapsed && t('New page')}
                    </Button>
                </div>
            )}
        </Layout.Sider>
    );
};

export default AdminBuildSider;
