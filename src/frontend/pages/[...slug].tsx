import React from 'react'
import App from "./app";
import {useRouter} from "next/router";
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const router = useRouter()
    const {t, i18n} = useTranslation('app');
    return (
        <App t={t} i18n={i18n} page={router.query.slug as string} />
    )
}

export default Slug;