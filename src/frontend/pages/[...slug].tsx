import React from 'react'
import App from "./app";
import {useRouter} from "next/router";
import '@ant-design/v5-patch-for-react-19';
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const router = useRouter()
    const {t} = useTranslation('common');
    return (
        <App t={t} page={router.query.slug as string} />
    )
}

export default Slug;