import React from "react";

const PlainText = ({content}:{content: string}) => {
    return (
        <div className={'plain-text'}>
            {content}
        </div>
    )
}

export default PlainText