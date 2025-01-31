import React, {useEffect, useState} from 'react'
import {Button, Tabs} from "@chakra-ui/react"
import {Provider} from "../components/ui/provider";
import {NavigationLoader} from "../Classes/NavigationLoader";
import DynamicTabsContent from "../components/DynamicTabsContent";
import AddNewDialogNavigation from "../components/common/AddNewDialog";

let loader
const Home = () => {

    const [, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('')
    useEffect(() => {
        loader = new NavigationLoader((value: boolean) => {
            setLoading(value)
        });
    }, []);

    useEffect(() => {
        if(loader){
            setActiveTab(loader.activePage)
        }
    }, [loader]);

    return (
        <Provider>
            <Tabs.Root key={"root"} value={activeTab} onValueChange={(e) => {
                loader.loadSections(e.value)
            }} defaultValue={activeTab}>
                <Tabs.List>
                    {loader ? loader.pages.map(item => {
                        return (
                            <Tabs.Trigger key={`tab-${item.page}`} value={item.page}>
                                <Tabs.Indicator/>
                                {item.page}
                            </Tabs.Trigger>
                        )
                    }) : ''}
                    {
                        <div>
                            <AddNewDialogNavigation />
                        </div>
                    }
                </Tabs.List>
                {loader ? loader.pages.map((item: { page: string; sections: any[]; }) => {
                    return (
                        <Tabs.Content key={`content-${item.page}`} value={item.page}>
                            <DynamicTabsContent sections={loader ? loader.sections : []} />
                        </Tabs.Content>
                    )
                }) : ''}
            </Tabs.Root>
        </Provider>

    );
};

export default Home;