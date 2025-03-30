import React from 'react'
import App from "./app";
import {useTranslation} from "next-i18next";

const Slug = ()=> {
    const {t} = useTranslation('app');
    return (
        <App t={t} page={'/'} />
    )
}
export default Slug;