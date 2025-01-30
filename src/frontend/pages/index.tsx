import React, {useEffect, useState} from 'react'
import {Tabs} from "@chakra-ui/react"
import {Provider} from "../components/ui/provider";
import {NavigationLoader} from "../Classes/NavigationLoader";

let loader
const Home = () => {

    const [, setLoading] = useState(false)
    useEffect(() => {
        loader = new NavigationLoader((value: boolean) => {
            setLoading(value)
        });
    }, []);
    console.log(loader)

    return (
        <Provider>

            <Tabs.Root defaultValue="home">
                <Tabs.List>
                    {loader ? loader.pages.map(item => {
                        return (
                            <Tabs.Trigger value={item.page}>
                                <Tabs.Indicator/>
                                {item.page}
                            </Tabs.Trigger>
                        )
                    }) : ''}
                </Tabs.List>
                {loader ? loader.pages.map(item => {
                    return (
                        <Tabs.Content value={item.page}>
                            {
                                item.sections.map(section => {
                                    return (
                                        <div>
                                            <div>{section}</div>
                                        </div>
                                    )
                                })
                            }
                        </Tabs.Content>
                    )
                }) : ''}
            </Tabs.Root>
        </Provider>

    );
};

export default Home;