import {Tabs, TabsProps} from "antd";
import AdminSettingsUsers from "./AdminSettings/Users";
import AdminSettingsLanguages from "./AdminSettings/Languages";
import AdminSettingsTheme from "./AdminSettings/Theme";
import {useTranslation} from "next-i18next";
import DataLoader from "./DataLoader";

const getItems = (t: any, dataLoader: DataLoader, i18n: any, ): TabsProps['items'] => {
    return [
        {
            key: '1',
            label: t('Users'),
            children: <AdminSettingsUsers/>,
        },
        {
            key: '2',
            label: t('Languages'),
            children: <AdminSettingsLanguages i18n={i18n} dataLoader={dataLoader}/>,
        },
        {
            key: '3',
            label: t('Theme'),
            children: <AdminSettingsTheme/>,
        },
    ];
}

const AdminSettings = () => {
    const dataLoader = new DataLoader();
    const {t, i18n} = useTranslation('common')
    return (
        <Tabs defaultActiveKey="2" items={getItems(t, dataLoader, i18n)}/>
    )
}
export default AdminSettings