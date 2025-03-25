import React from 'react'
import App from "./app";
import '@ant-design/v5-patch-for-react-19';
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const {t} = useTranslation('common');
    return (
        <App t={t} page={'/'} />
    )
}
export default Slug;