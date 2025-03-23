import React from 'react'
import App from "./app";
import {useRouter} from "next/router";
import '@ant-design/v5-patch-for-react-19';
const Slug = ()=> {
    const router = useRouter()

    return (
        <App page={router.query.slug as string} />
    )
}

export default Slug;