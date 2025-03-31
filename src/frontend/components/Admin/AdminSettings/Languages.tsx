import TranslationManager from "../TranslationManager";
import {Button, Layout, Menu, Spin} from 'antd';
import React, {Suspense, useEffect, useState} from "react";
import {LoadingOutlined, PlusCircleOutlined} from "@ant-design/icons";
import {ContentLoader} from "./ContentLoader";
import {TFunction} from "i18next";
import AddNewLanguageDialog from "./AddNewLanguageDialog";
import {useTranslation} from "next-i18next";
import {sanitizeKey} from "../../../../utils/stringFunctions";

const {Header, Content, Sider} = Layout;

let translation = {}

const AdminSettingsLanguages = ({translationManager, i18n, tAdmin}: {
    translationManager: TranslationManager,
    i18n: any,
    tAdmin: TFunction<"common", undefined>
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
    const [currentLanguageName, setCurrentLanguageName] = useState('App Translations');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [translation, setTranslation] = useState(Object);

    const {t} = useTranslation('app')
    const tApp = (data: string) => {
        return t(sanitizeKey(data))
    }
    const [menuItems, setMenuItems] = useState([{
        key: 'default',
        label: 'App Translations'
    }])

    const setTranslationValue = (data: any) => {
        setTranslation(data);
    }
    const saveNewTranslation = async () => {
        await translationManager.saveNewTranslation({
            label: currentLanguageName,
            symbol: currentLanguage
        }, translation)
        i18n.reloadResources();
    }

    const deleteTranslation = async () => {
        await translationManager.deleteTranslation({
            label: currentLanguageName,
            symbol: currentLanguage
        })
        i18n.reloadResources();
        i18n.changeLanguage('en');
        window.location.replace("/admin/settings");
    }

    useEffect(() => {
        Promise.resolve(translationManager.getLanguages()).then(data => {
            const newMenuItems: any[] = [
                {
                    key: 'default',
                    label: tAdmin('App Translations')
                }
            ];
            for (let id in data) {
                if (data[id].default === 'default') continue;
                newMenuItems.push({
                    key: data[id].symbol,
                    name: data[id].label,
                    label: <a href={`/${data[id].symbol}/admin/settings`}>
                        {data[id].label}
                    </a>
                })
            }
            setMenuItems(newMenuItems)
            if(i18n.language){
                const item = newMenuItems.find((item: any) => item && item.key === i18n.language)
                setCurrentLanguage(i18n.language)
                setCurrentLanguageName(item && item.name)
            }
        })
    }, []);

    return (
        <div>
            <div>
                <AddNewLanguageDialog t={t} open={dialogOpen} close={() => {
                    setDialogOpen(false)
                    window.location.reload()
                }}/>
            </div>
            <Layout style={{minHeight: '90vh'}}>
                <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
                    <Menu theme="dark" defaultSelectedKeys={[currentLanguage]} onSelect={(SelectInfo) => {
                        setCurrentLanguage(SelectInfo.key)
                        const itemLabel: any = menuItems.find((item: {
                            key: string;
                        }) => item && item.key === SelectInfo.key)
                        if (itemLabel) {
                            setCurrentLanguageName(itemLabel.label)
                            i18n.changeLanguage(SelectInfo.key)
                        }
                    }} mode="inline" items={menuItems}/>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '16px'
                    }}>
                        <Button type={"default"} onClick={() => {
                            setDialogOpen(true)
                        }}>
                            <PlusCircleOutlined/>{tAdmin('Add New Language')}
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
                            <Button type={'primary'} onClick={saveNewTranslation}>{tAdmin('Save')}</Button>
                            <Button danger={true} type={'primary'} onClick={deleteTranslation}>{tAdmin('Delete')}</Button>
                        </div>
                    </Header>
                    <Content style={{margin: '16px', maxHeight: '80vh', overflow: 'auto'}}>
                        <Suspense fallback={<Spin indicator={<LoadingOutlined spin/>}/>}>
                            <ContentLoader t={t} tApp={tApp} i18n={i18n} translationManager={translationManager}
                                           setTranslation={setTranslationValue} currentLanguageKey={currentLanguage}
                                           dataPromise={translationManager.loadData()}/>
                        </Suspense>
                    </Content>
                </Layout>
            </Layout>
        </div>
    )
}
export default AdminSettingsLanguages