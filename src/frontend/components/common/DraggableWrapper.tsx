import {Draggable} from "react-drag-reorder";
import React from "react";

interface IDraggableWrapper {
    admin: boolean,
    children: React.ReactNode,
    id: string,
    onPosChange: (oldIndex: number, newIndex: number) => void,
}


const DraggableWrapper = ({admin, children, id, onPosChange}: IDraggableWrapper) => {
    return (
        <div key={id}>
            {
                admin ?
                    <Draggable
                        key={`${id}-inner`}
                        onPosChange={onPosChange}
                        children={children}
                    />
                    :
                    <div key={`${id}-inner`}>
                        {children}
                    </div>
            }
        </div>
    )
}

export default DraggableWrapper