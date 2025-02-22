import React from 'react'
import App from "./app";
import {useRouter} from "next/router";

const Slug = ()=> {
    const router = useRouter()

    return (
        <App page={router.query.slug as string} />
    )
}

export default Slug;