import React from "react";


const DynamicTabsContent = ({sections}) => {
    return (
        sections.map(section => (
            <div key={section.name}>
                {
                    section.content.map((content, id) => {
                        return <div key={id.name}>{content.content}</div>
                    })
                }
            </div>
        ))
    )
}

export default DynamicTabsContent