import {Draggable} from "react-drag-reorder";
import React from "react";

interface IDraggableWrapper {
    admin: boolean,
    children: React.ReactNode,
    key: string,
    onPosChange: (oldIndex: number, newIndex: number) => void,
}

const DraggableWrapper = ({admin, children, key, onPosChange}: IDraggableWrapper) => {
    return (
        <>
            {
                admin ?
                    <Draggable
                        key={key}
                        onPosChange={onPosChange}
                        children={children}
                    />
                    :
                    <div key={key}>
                        {children}
                    </div>
            }
        </>
    )
}

export default DraggableWrapper