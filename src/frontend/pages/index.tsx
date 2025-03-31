import React from 'react'
import App from "./app";
import {useTranslation} from "next-i18next";
import { usePathname } from 'next/navigation'

const Slug = ()=> {
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname()
    return (
        <App pathname={pathname} i18n={i18n} t={t} page={'/'} />
    )
}
export default Slug;