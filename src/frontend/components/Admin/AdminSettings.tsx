import {Tabs, TabsProps} from "antd";
import AdminSettingsUsers from "./AdminSettings/Users";
import AdminSettingsTheme from "./AdminSettings/Theme";
import BundleSettings from "./AdminSettings/Bundle";
import AdminSettingsPublishing from "./AdminSettings/Publishing";
import AdminSettingsPosts from "./AdminSettings/Posts";
import AdminSettingsFooter from "./AdminSettings/Footer";
import AdminSettingsSEO from "./AdminSettings/SEO";
import AdminSettingsLogo from "./AdminSettings/LogoSettings";
import AdminSettingsLayout from "./AdminSettings/Layout";
import {useTranslation} from "next-i18next";
import {useSession} from "next-auth/react";
import {TFunction} from "i18next";
import Backend from 'i18next-http-backend';
import {UserRole} from "../../../Interfaces/IUser";

const getItems = (
    t: TFunction<"common", undefined>,
    role: UserRole,
): TabsProps['items'] => {
    const items: NonNullable<TabsProps['items']> = [];
    if (role === 'admin') {
        items.push({
            key: '1',
            label: t('Users'),
            children: <AdminSettingsUsers/>,
        });
    }
    items.push({
        key: '3',
        label: t('Theme'),
        children: <AdminSettingsTheme/>,
    });
    items.push({
        key: '9',
        label: t('Logo'),
        children: <AdminSettingsLogo/>,
    });
    items.push({
        key: '10',
        label: t('Layout'),
        children: <AdminSettingsLayout/>,
    });
    items.push({
        key: '8',
        label: t('SEO'),
        children: <AdminSettingsSEO/>,
    });
    items.push({
        key: '6',
        label: t('Posts'),
        children: <AdminSettingsPosts/>,
    });
    items.push({
        key: '7',
        label: t('Footer'),
        children: <AdminSettingsFooter/>,
    });
    if (role === 'admin') {
        items.push({
            key: '4',
            label: t('Bundle'),
            children: <BundleSettings t={t}/>,
        });
        items.push({
            key: '5',
            label: t('Publishing'),
            children: <AdminSettingsPublishing/>,
        });
    }
    return items;
};

const AdminSettings = () => {
    const {t, i18n} = useTranslation('common')
    i18n.use(Backend)

    const {data: session} = useSession();
    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;

    return (
        <Tabs defaultActiveKey={role === 'admin' ? '1' : '3'} items={getItems(t, role)}/>
    )
}
export default AdminSettings