import {Tabs, TabsProps} from "antd";
import AdminSettingsUsers from "./AdminSettings/Users";
import AdminSettingsLanguages from "./AdminSettings/Languages";
import AdminSettingsTheme from "./AdminSettings/Theme";
const onChange = (key: string) => {
    console.log(key);
};
const items: TabsProps['items'] = [
    {
        key: '1',
        label: 'Users',
        children: <AdminSettingsUsers />,
    },
    {
        key: '2',
        label: 'Languages',
        children: <AdminSettingsLanguages />,
    },
    {
        key: '3',
        label: 'Theme',
        children: <AdminSettingsTheme />,
    },
];

const AdminSettings = () => {
    return (
        <Tabs defaultActiveKey="1" items={items} onChange={onChange} />
    )
}
export default AdminSettings