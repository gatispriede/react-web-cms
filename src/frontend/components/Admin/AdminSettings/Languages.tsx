import DataLoader from "../DataLoader";
import {Button, Layout, Menu, MenuProps, Spin} from 'antd';
import React, {Suspense, useState} from "react";
import {LoadingOutlined} from "@ant-design/icons";
import {ContentLoader} from "./ContentLoader";

const {Header, Content, Sider} = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const AdminSettingsLanguages = ({dataLoader, i18n}: { dataLoader: DataLoader, i18n: any }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [currentLanguageName, setCurrentLanguageName] = useState('Default');

    // languages
    const items: MenuItem[] = [
        {
            key: 'default',
            label: 'Default'
        }
    ];

    return (
        <div>
            <Layout style={{minHeight: '90vh'}}>
                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                    <Menu theme="dark" defaultSelectedKeys={['default']} onSelect={(SelectInfo) => {
                        setCurrentLanguage(SelectInfo.key)
                        const itemLabel: any = items.find((item) => item && item.key === SelectInfo.key)
                        if (itemLabel)
                            setCurrentLanguageName(itemLabel.label)
                    }} mode="inline" items={items}/>
                </Sider>
                <Layout>
                    <Header style={{padding: '0 16px', background: '#fff'}}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'flex-start'
                        }}>
                            <p style={{
                                margin: '0 16px'
                            }}>
                                Language: {currentLanguageName}
                            </p>
                            <Button type={'primary'}>Save</Button>
                        </div>
                    </Header>
                    <Content style={{margin: '16px', maxHeight: '80vh', overflow: 'auto'}}>
                        <Suspense fallback={<Spin indicator={<LoadingOutlined spin/>}/>}>
                            <ContentLoader i18n={i18n} dataLoader={dataLoader} currentLanguageKey={currentLanguage}
                                           dataPromise={dataLoader.loadData()}/>
                        </Suspense>
                    </Content>
                </Layout>
            </Layout>
        </div>
    )
}
export default AdminSettingsLanguages