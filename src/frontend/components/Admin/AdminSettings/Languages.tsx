import TranslationManager from "../TranslationManager";
import {Button, Layout, Menu, Segmented, Spin, message} from 'antd';
import React, {Suspense, useCallback, useEffect, useMemo, useState} from "react";
import {LoadingOutlined, PlusCircleOutlined} from "../../common/icons";
import {ContentLoader} from "./ContentLoader";
import {ContentLoaderCompare} from "./ContentLoaderCompare";
import {TFunction} from "i18next";
import AddNewLanguageDialog from "./AddNewLanguageDialog";
import {useTranslation} from "next-i18next";
import {sanitizeKey} from "../../../../utils/stringFunctions";
import AuditBadge from "../AuditBadge";
import {INewLanguage} from "../../interfaces/INewLanguage";
import {useRefreshView} from "../../../lib/refreshBus";

const {Header, Content, Sider} = Layout;

interface MenuItem {
    key: string;
    label: React.ReactNode;
    name?: string;
}

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
    const [mode, setMode] = useState<'edit' | 'compare'>('edit');
    const [saving, setSaving] = useState(false);
    // Nonce bumps the ContentLoader's suspense key to force a re-read after
    // save/delete — without re-routing or reloading the whole page.
    const [reloadNonce, setReloadNonce] = useState(0);
    const dataPromise = useMemo(() => translationManager.loadData(), [translationManager, reloadNonce]);

    const {t} = useTranslation('app');
    const tApp = (data: string) => t(sanitizeKey(data));

    const [menuItems, setMenuItems] = useState<MenuItem[]>([{
        key: 'default',
        label: 'App Translations',
    }]);
    const [languages, setLanguages] = useState<Record<string, INewLanguage>>({});

    const refreshMenu = useCallback(async () => {
        const data = await translationManager.getLanguages();
        setLanguages(data);
        const items: MenuItem[] = [{key: 'default', label: tAdmin('App Translations'), name: 'App Translations'}];
        for (const id in data) {
            if (data[id].default) continue;
            items.push({
                key: data[id].symbol,
                name: data[id].label,
                label: data[id].label,
            });
        }
        setMenuItems(items);
        if (i18n.language) {
            const match = items.find(it => it.key === i18n.language);
            if (match) {
                setCurrentLanguage(i18n.language);
                setCurrentLanguageName(match.name ?? String(match.label));
            }
        }
    }, [translationManager, tAdmin, i18n.language]);

    useEffect(() => { void refreshMenu(); }, [refreshMenu]);
    useRefreshView(refreshMenu, 'settings');

    const setTranslationValue = (data: any) => setTranslation(data);

    const saveNewTranslation = async () => {
        if (currentLanguage === 'default') {
            message.warning(tAdmin('Select a non-default language before saving.'));
            return;
        }
        setSaving(true);
        try {
            await translationManager.saveNewTranslation(
                {label: currentLanguageName, symbol: currentLanguage},
                translation,
            );
            await i18n.reloadResources(currentLanguage);
            setReloadNonce(n => n + 1);
            message.success(tAdmin('Translations saved'));
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setSaving(false);
        }
    };

    const deleteTranslation = async () => {
        if (currentLanguage === 'default') return;
        setSaving(true);
        try {
            await translationManager.deleteTranslation({label: currentLanguageName, symbol: currentLanguage});
            await i18n.reloadResources();
            setCurrentLanguage('default');
            setCurrentLanguageName('App Translations');
            await refreshMenu();
            setReloadNonce(n => n + 1);
            message.success(tAdmin('Language deleted'));
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setSaving(false);
        }
    };

    const handleDialogClose = async (didSave: boolean) => {
        setDialogOpen(false);
        if (didSave) {
            await refreshMenu();
            await i18n.reloadResources();
            setReloadNonce(n => n + 1);
        }
    };

    return (
        <div>
            <div>
                <AddNewLanguageDialog
                    t={t}
                    open={dialogOpen}
                    close={handleDialogClose}
                />
            </div>
            <Layout style={{minHeight: '90vh'}}>
                <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={[currentLanguage]}
                        onSelect={async info => {
                            const match = menuItems.find(it => it.key === info.key);
                            if (!match) return;
                            // Load the target locale's resources BEFORE we
                            // flip the displayed key — otherwise ContentLoader
                            // reads i18n.store.data[newKey] which isn't loaded
                            // yet and falls through to the previous language,
                            // making the panel show Latvian while "English"
                            // is highlighted until a hard refresh.
                            try {
                                await i18n.changeLanguage(info.key);
                                await i18n.reloadResources(info.key);
                            } catch (err) {
                                console.error('switch language failed:', err);
                            }
                            setCurrentLanguage(info.key);
                            setCurrentLanguageName(match.name ?? String(match.label));
                            setReloadNonce(n => n + 1);
                        }}
                        items={menuItems.map(it => ({key: it.key, label: it.label}))}
                    />
                    <div style={{display: 'flex', justifyContent: 'center', padding: 16}}>
                        <Button type="default" onClick={() => setDialogOpen(true)}>
                            <PlusCircleOutlined/>{tAdmin('Add New Language')}
                        </Button>
                    </div>
                </Sider>
                <Layout>
                    <Header style={{padding: '0 16px', background: '#fff'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Segmented
                                value={mode}
                                onChange={v => setMode(v as 'edit' | 'compare')}
                                options={[
                                    {label: tAdmin('Edit'), value: 'edit'},
                                    {label: tAdmin('Compare all'), value: 'compare'},
                                ]}
                            />
                            {mode === 'edit' && (
                                <>
                                    <p style={{margin: '0 16px'}}>{currentLanguageName}</p>
                                    <Button type="primary" loading={saving} onClick={saveNewTranslation}>{tAdmin('Save')}</Button>
                                    <Button danger type="primary" loading={saving} onClick={deleteTranslation} disabled={currentLanguage === 'default'}>
                                        {tAdmin('Delete')}
                                    </Button>
                                    {currentLanguage !== 'default' && (
                                        <AuditBadge
                                            editedBy={languages[currentLanguage]?.editedBy}
                                            editedAt={languages[currentLanguage]?.editedAt}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </Header>
                    <Content style={{margin: 16, maxHeight: '80vh', overflow: 'auto'}}>
                        <Suspense fallback={<Spin indicator={<LoadingOutlined spin/>}/>}>
                            {mode === 'edit'
                                ? <ContentLoader
                                    key={`edit-${currentLanguage}-${reloadNonce}`}
                                    t={t} tApp={tApp} i18n={i18n} translationManager={translationManager}
                                    setTranslation={setTranslationValue} currentLanguageKey={currentLanguage}
                                    dataPromise={dataPromise}/>
                                : <ContentLoaderCompare
                                    key={`compare-${reloadNonce}`}
                                    translationManager={translationManager} dataPromise={dataPromise}/>
                            }
                        </Suspense>
                    </Content>
                </Layout>
            </Layout>
        </div>
    );
};

export default AdminSettingsLanguages;
