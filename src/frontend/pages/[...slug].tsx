import React from 'react'
import App from "./app";
import {useRouter} from "next/router";
import {useTranslation} from "next-i18next";
import {usePathname} from "next/navigation";

const Slug = ()=> {
    const router = useRouter()
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname()
    return (
        <App pathname={pathname} t={t} i18n={i18n} page={router.query.slug as string} />
    )
}

export default Slug;