import {Tabs, TabsProps} from "antd";
import AdminSettingsUsers from "./AdminSettings/Users";
import AdminSettingsLanguages from "./AdminSettings/Languages";
import AdminSettingsTheme from "./AdminSettings/Theme";
import {useTranslation} from "next-i18next";

const getItems = ({t}: { t: any}): TabsProps['items'] => {
    return [
        {
            key: '1',
            label: t('Users'),
            children: <AdminSettingsUsers/>,
        },
        {
            key: '2',
            label: t('Languages'),
            children: <AdminSettingsLanguages/>,
        },
        {
            key: '3',
            label: t('Theme'),
            children: <AdminSettingsTheme/>,
        },
    ];
}

const AdminSettings = () => {
    const t = useTranslation('common')
    return (
        <Tabs defaultActiveKey="1" items={getItems(t)}/>
    )
}
export default AdminSettings