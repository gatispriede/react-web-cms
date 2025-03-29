import {Tabs, TabsProps} from "antd";
import AdminSettingsUsers from "./AdminSettings/Users";
import AdminSettingsLanguages from "./AdminSettings/Languages";
import AdminSettingsTheme from "./AdminSettings/Theme";
import {useTranslation} from "next-i18next";
import TranslationManager from "./TranslationManager";
import {TFunction} from "i18next";

const getItems = (t: TFunction<"common", undefined>, translationManager: TranslationManager, i18n: any, ): TabsProps['items'] => {
    return [
        {
            key: '1',
            label: t('Users'),
            children: <AdminSettingsUsers/>,
        },
        {
            key: '2',
            label: t('Languages'),
            children: <AdminSettingsLanguages t={t} i18n={i18n} translationManager={translationManager}/>,
        },
        {
            key: '3',
            label: t('Theme'),
            children: <AdminSettingsTheme/>,
        },
    ];
}

const AdminSettings = () => {
    const translationManager = new TranslationManager();

    const {t, i18n} = useTranslation('common')
    return (
        <Tabs defaultActiveKey="2" items={getItems(t, translationManager, i18n)}/>
    )
}
export default AdminSettings