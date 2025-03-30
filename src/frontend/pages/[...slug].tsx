import React from 'react'
import App from "./app";
import {useRouter} from "next/router";
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const router = useRouter()
    const {t} = useTranslation('app');
    return (
        <App t={t} page={router.query.slug as string} />
    )
}

export default Slug;