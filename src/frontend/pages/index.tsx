import React from 'react'
import App from "./app";
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const {t, i18n} = useTranslation('app');
    return (
        <App i18n={i18n} t={t} page={'/'} />
    )
}
export default Slug;