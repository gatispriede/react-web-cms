import React from "react";
import {Button, Image} from "@chakra-ui/react";
import Text from '../components/common/Text'
import AddNewSectionItem from "./common/AddNewSectionItem";

enum EType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
}

const DynamicTabsContent = ({sections}) => {
    return (
        <div>
            <div>
                {
                    sections.map(section => {

                            return (
                                <div key={section.name}>
                                    {
                                        section.content.map((content, id) => {
                                            switch (content.type) {
                                                case EType.TEXT:
                                                    return (
                                                        <div key={id}>
                                                            <Text value={content.content as string}/>
                                                        </div>
                                                    )
                                                case EType.IMAGE:
                                                    return (
                                                        <div key={id}>
                                                            <Image src={content.content}/>
                                                        </div>
                                                    )
                                                default:
                                                    return '';
                                            }
                                        })
                                    }
                                </div>
                            )
                        }
                    )
                }
            </div>
            <div>
                <AddNewSectionItem />
            </div>
        </div>
    )
}

export default DynamicTabsContent