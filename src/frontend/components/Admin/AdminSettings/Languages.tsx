import TranslationManager from "../TranslationManager";
import {Button,Layout, Menu, MenuProps, Spin} from 'antd';
import React, {Suspense, useEffect, useState} from "react";
import {LoadingOutlined, PlusCircleOutlined} from "@ant-design/icons";
import {ContentLoader} from "./ContentLoader";
import {TFunction} from "i18next";
import AddNewLanguageDialog from "./AddNewLanguageDialog";

const {Header, Content, Sider} = Layout;

type MenuItem = Required<MenuProps>['items'][number];

const AdminSettingsLanguages = ({translationManager, i18n, t}: { translationManager: TranslationManager, i18n: any, t: TFunction<"common", undefined> }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState('default');
    const [currentLanguageName, setCurrentLanguageName] = useState('App Translations');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [menuItems, setMenuItems] = useState([{
        key: 'default',
        label: 'App Translations'
    }])

    useEffect(() => {
        Promise.resolve(translationManager.getLanguages()).then(data => {
            const newMenuItems: any[] = [
                {
                    key: 'default',
                    label: 'App Translations'
                }
            ];
            for(let id in data){
                if(data[id].default === 'default') continue;
                newMenuItems.push({
                    key: data[id].symbol,
                    label: data[id].label
                })
            }
            setMenuItems(newMenuItems)
        })
    }, []);

    return (
        <div>
            <div>
                <AddNewLanguageDialog t={t} open={dialogOpen} close={() => {
                    setDialogOpen(false)
                }} />
            </div>
            <Layout style={{minHeight: '90vh'}}>
                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                    <Menu theme="dark" defaultSelectedKeys={['default']} onSelect={(SelectInfo) => {
                        setCurrentLanguage(SelectInfo.key)
                        const itemLabel: any = menuItems.find((item: { key: string; }) => item && item.key === SelectInfo.key)
                        if (itemLabel)
                            setCurrentLanguageName(itemLabel.label)
                    }} mode="inline" items={menuItems}/>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '16px'
                    }}>
                        <Button type={"default"} onClick={() => {
                            // Add new language
                            console.log('add new language')
                            setDialogOpen(true)
                        }}>
                            <PlusCircleOutlined />Add New Language
                        </Button>
                    </div>
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
                                {currentLanguageName}
                            </p>
                            <Button type={'primary'}>Save</Button>
                        </div>
                    </Header>
                    <Content style={{margin: '16px', maxHeight: '80vh', overflow: 'auto'}}>
                        <Suspense fallback={<Spin indicator={<LoadingOutlined spin/>}/>}>
                            <ContentLoader i18n={i18n} translationManager={translationManager} currentLanguageKey={currentLanguage}
                                           dataPromise={translationManager.loadData()}/>
                        </Suspense>
                    </Content>
                </Layout>
            </Layout>
        </div>
    )
}
export default AdminSettingsLanguages