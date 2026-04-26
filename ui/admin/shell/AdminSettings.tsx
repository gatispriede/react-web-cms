import {Tabs, TabsProps} from "antd";
import {
    AppstoreOutlined,
    AuditOutlined,
    BgColorsOutlined,
    CloudUploadOutlined,
    DownloadOutlined,
    FileTextOutlined,
    MailOutlined,
    PictureOutlined,
    SearchOutlined,
    UserOutlined,
} from "@client/lib/icons";
import AdminSettingsUsers from "@admin/features/Users/Users";
import AdminSettingsTheme from "@admin/features/Themes/Theme";
import BundleSettings from "@admin/features/Bundle/Bundle";
import AdminSettingsPublishing from "@admin/features/Publishing/Publishing";
import AdminSettingsPosts from "@admin/features/Posts/Posts";
import AdminSettingsFooter from "@admin/features/Footer/Footer";
import AdminSettingsSEO from "@admin/features/Seo/SEO";
import AdminSettingsLogo from "@admin/features/Logo/LogoSettings";
import AdminSettingsLayout from "@admin/features/Navigation/Layout";
import AdminSettingsInquiries from "@admin/features/Inquiries/Inquiries";
import AuditTab from "@admin/features/Audit/AuditTab";
import {useTranslation} from "react-i18next";
import {useSession} from "next-auth/react";
import {TFunction} from "i18next";
import {UserRole} from "@interfaces/IUser";

const getItems = (
    t: TFunction<"translation", undefined>,
    role: UserRole,
): TabsProps['items'] => {
    const items: NonNullable<TabsProps['items']> = [];
    // Tab `icon` is rendered by AntD to the left of `label` automatically.
    // Icons are presentational — `label` stays the accessible name.
    if (role === 'admin') {
        items.push({
            key: '1',
            icon: <UserOutlined/>,
            label: t('Users'),
            children: <AdminSettingsUsers/>,
        });
    }
    items.push({
        key: '3',
        icon: <BgColorsOutlined/>,
        label: t('Theme'),
        children: <AdminSettingsTheme/>,
    });
    items.push({
        key: '9',
        icon: <PictureOutlined/>,
        label: t('Logo'),
        children: <AdminSettingsLogo/>,
    });
    items.push({
        key: '10',
        icon: <AppstoreOutlined/>,
        label: t('Layout'),
        children: <AdminSettingsLayout/>,
    });
    items.push({
        key: '8',
        icon: <SearchOutlined/>,
        label: t('SEO'),
        children: <AdminSettingsSEO/>,
    });
    items.push({
        key: '6',
        icon: <FileTextOutlined/>,
        label: t('Posts'),
        children: <AdminSettingsPosts/>,
    });
    // Footer tab — no dedicated "align-bottom" in lucide; a text document icon
    // reads adjacent to SEO / Posts and ties "Footer" to editable copy.
    items.push({
        key: '7',
        icon: <FileTextOutlined/>,
        label: t('Footer'),
        children: <AdminSettingsFooter/>,
    });
    if (role === 'admin') {
        items.push({
            key: '12',
            icon: <MailOutlined/>,
            label: t('Inquiries'),
            children: <AdminSettingsInquiries/>,
        });
        items.push({
            key: '4',
            icon: <DownloadOutlined/>,
            label: t('Bundle'),
            children: <BundleSettings t={t}/>,
        });
        items.push({
            key: '5',
            icon: <CloudUploadOutlined/>,
            label: t('Publishing'),
            children: <AdminSettingsPublishing/>,
        });
        items.push({
            key: '11',
            icon: <AuditOutlined/>,
            label: t('Audit'),
            children: <AuditTab/>,
        });
    }
    return items;
};

const AdminSettings = () => {
    const {t} = useTranslation()

    const {data: session} = useSession();
    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;

    return (
        <Tabs defaultActiveKey={role === 'admin' ? '1' : '3'} items={getItems(t, role)}/>
    )
}
export default AdminSettings