import React from 'react';
import {Button, Tooltip} from 'antd';
import {PictureOutlined} from '../common/icons';
import ImageRail, {useImageRailState} from './ImageRail';

/**
 * Header button + rail mount. Keeps the state hook in a functional
 * component so `AdminApp` (class) can stay hook-free. Rail itself is
 * `position: fixed`, so rendering it here doesn't affect layout flow.
 */
const ImageRailDock: React.FC = () => {
    const [open, setOpen] = useImageRailState();
    return (
        <>
            <Tooltip title={open ? 'Hide image library' : 'Show image library (drag images onto modules)'}>
                <Button
                    type={open ? 'primary' : 'default'}
                    icon={<PictureOutlined/>}
                    onClick={() => setOpen(!open)}
                    aria-pressed={open}
                    aria-label="Toggle image library"
                />
            </Tooltip>
            <ImageRail open={open} onClose={() => setOpen(false)}/>
        </>
    );
};

export default ImageRailDock;
