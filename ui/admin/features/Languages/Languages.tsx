import TranslationManager from "@admin/shell/TranslationManager";
import {Button, Layout, Menu, Segmented, Spin, message} from 'antd';
import React, {Suspense, useEffect, useMemo} from "react";
import {LoadingOutlined, PlusCircleOutlined} from "@client/lib/icons";
import {ContentLoader} from "@admin/features/Bundle/ContentLoader";
import {ContentLoaderCompare} from "@admin/features/Bundle/ContentLoaderCompare";
import {TFunction} from "i18next";
import AddNewLanguageDialog from "./AddNewLanguageDialog";
import {useTranslation} from "next-i18next/pages";
import {sanitizeKey} from "@utils/stringFunctions";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {TranslationsViewModel} from "@admin/features/Translations/TranslationsViewModel";

const {Header, Content, Sider} = Layout;

/**
 * Admin "Translations" pane (mounted at the legacy `Languages` route).
 *
 * Render-only shell over `TranslationsViewModel` — VM3 final pane,
 * 2026-05-02. Component holds NO `useState`. The vm owns sidebar
 * state, currently-edited language, dialog flag, mode, save flag,
 * reload nonce, languages dict, menu items, pending edits, and the
 * conflict surface. The component composes the AntD layout and
 * dispatches calls.
 */
const AdminSettingsLanguages = ({translationManager, i18n, tAdmin}: {
    translationManager: TranslationManager,
    i18n: any,
    tAdmin: TFunction<"common", undefined>
}) => {
    const vm = useViewModel(() => new TranslationsViewModel(translationManager, i18n, tAdmin as any));
    const {t} = useTranslation('app');

    // The data promise is a `useMemo` here because the underlying
    // `loadData()` call is the input to a Suspense boundary — we need a
    // stable promise reference per (manager, reloadNonce) tuple, and
    // memoising on those exact deps is the cheapest way to express that.
    const dataPromise = useMemo(
        () => translationManager.loadData(),
        [translationManager, vm.reloadNonce],
    );

    // `tApp` MUST resolve against the language the operator is editing
    // (`currentLanguage`), not whatever `i18n.language` happens to be —
    // those diverge whenever the admin UI runs in English while the
    // operator clicks "Latviešu" in the sidebar to translate it. The
    // bare `t` from `useTranslation` is bound to `i18n.language`, so a
    // stale closure would seed the editor's inputs from the wrong
    // locale (showing blanks because `t('Home')` returns 'Home' under
    // `en`, which the seeding fix treats as missing).
    //
    // `getFixedT(lng, ns)` returns a fresh resolver pinned to the
    // language we actually care about. Re-derived per render so that
    // late-arriving `reloadResources()` calls show through.
    const tApp = useMemo(() => {
        const fixed = i18n.getFixedT(vm.currentLanguage, 'app');
        return (data: string) => fixed(sanitizeKey(data));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vm.currentLanguage, vm.reloadNonce, i18n]);

    useEffect(() => { void vm.refreshMenu(); }, [vm]);
    useRefreshView(vm.refreshMenu, 'settings');

    return (
        <div>
            <div>
                <AddNewLanguageDialog
                    t={t}
                    open={vm.dialogOpen}
                    close={vm.handleDialogClose}
                />
            </div>
            <Layout style={{minHeight: '90vh'}}>
                <Sider collapsible collapsed={vm.collapsed} onCollapse={vm.setCollapsed}>
                    <Menu
                        theme="dark"
                        mode="inline"
                        selectedKeys={[vm.currentLanguage]}
                        onSelect={info => { void vm.selectLanguage(info.key); }}
                        items={vm.menuItems.map(it => ({
                            key: it.key,
                            // Wrap label in a span carrying the per-language
                            // testid so e2e specs can target a specific
                            // language tab without depending on `i18n` text.
                            label: <span data-testid={`translations-language-tab-${String(it.key).toLowerCase()}`}>{it.label}</span>,
                        }))}
                    />
                    <div style={{display: 'flex', justifyContent: 'center', padding: 16}}>
                        <Button type="default" onClick={vm.openDialog}>
                            <PlusCircleOutlined/>{tAdmin('Add New Language')}
                        </Button>
                    </div>
                </Sider>
                <Layout>
                    <Header style={{padding: '0 16px', background: '#fff'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Segmented
                                value={vm.mode}
                                onChange={v => vm.setMode(v as 'edit' | 'compare')}
                                options={[
                                    {label: tAdmin('Edit'), value: 'edit'},
                                    {label: tAdmin('Compare all'), value: 'compare'},
                                ]}
                            />
                            {vm.mode === 'edit' && (
                                <>
                                    <p style={{margin: '0 16px'}}>{vm.currentLanguageName}</p>
                                    <Button data-testid="translations-save-btn" type="primary" loading={vm.saving} onClick={vm.saveNewTranslation}>{tAdmin('Save')}</Button>
                                    <Button
                                        loading={vm.saving}
                                        onClick={vm.setAsDefault}
                                        disabled={vm.currentLanguage === 'default' || !!vm.languages[vm.currentLanguage]?.default}
                                        title={vm.languages[vm.currentLanguage]?.default ? tAdmin('Already the default language.') as string : undefined}
                                    >
                                        {vm.languages[vm.currentLanguage]?.default ? tAdmin('Default') : tAdmin('Set as Default')}
                                    </Button>
                                    <Button danger type="primary" loading={vm.saving} onClick={vm.deleteTranslation}
                                        disabled={vm.currentLanguage === 'default' || !!vm.languages[vm.currentLanguage]?.default}>
                                        {tAdmin('Delete')}
                                    </Button>
                                    {vm.currentLanguage !== 'default' && (
                                        <AuditBadge
                                            editedBy={vm.languages[vm.currentLanguage]?.editedBy}
                                            editedAt={vm.languages[vm.currentLanguage]?.editedAt}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </Header>
                    <Content style={{margin: 16, maxHeight: '80vh', overflow: 'auto'}}>
                        <Suspense fallback={<Spin indicator={<LoadingOutlined spin/>}/>}>
                            {vm.mode === 'edit'
                                ? <ContentLoader
                                    key={`edit-${vm.currentLanguage}-${vm.reloadNonce}`}
                                    t={t} tApp={tApp} i18n={i18n} translationManager={translationManager}
                                    setTranslation={vm.setTranslationValue} currentLanguageKey={vm.currentLanguage}
                                    dataPromise={dataPromise}/>
                                : <ContentLoaderCompare
                                    key={`compare-${vm.reloadNonce}`}
                                    translationManager={translationManager} dataPromise={dataPromise}/>
                            }
                        </Suspense>
                    </Content>
                </Layout>
            </Layout>
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={tAdmin('Language')}
                        peerVersion={vm.conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={() => { void vm.takeTheirs(); }}
                        onKeepMine={async () => {
                            try { await vm.conflict?.retry(); }
                            catch (err) { message.error(String((err as Error)?.message ?? err)); vm.dismissConflict(); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default AdminSettingsLanguages;
