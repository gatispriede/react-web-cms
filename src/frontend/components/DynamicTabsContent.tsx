import React from "react";
import {Box, Flex, Image} from "@chakra-ui/react";
import Text from '../components/common/Text'
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/AddNewSection";

enum EType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
}

enum ETypeWidth {
    '100%',
    '50%',
    '33%',
    '25%',
}

const DynamicTabsContent = ({sections}) => {
    return (
        <div>
            <Flex boxSizing="border-box" display="flex" flexDirection="column">
                {
                    sections.map(section => {
                            return (
                                <Box key={section.name} display="flex" width={ETypeWidth[section.type]} flexDirection="row">
                                    {
                                        section.content.map((content, id) => {
                                            switch (content.type) {
                                                case EType.TEXT:
                                                    return (
                                                        <EditWrapper key={id}>
                                                            <Text value={content.content as string}/>
                                                        </EditWrapper>
                                                    )
                                                case EType.IMAGE:
                                                    return (
                                                        <EditWrapper key={id}>
                                                            <Image src={content.content}/>
                                                        </EditWrapper>
                                                    )
                                                default:
                                                    return '';
                                            }
                                        })
                                    }
                                </Box>
                            )
                        }
                    )
                }
            </Flex>
            <Box>
                <AddNewSection/>
            </Box>
        </div>
    )
}

export default DynamicTabsContent