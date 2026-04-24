import React, {useEffect} from 'react';
import {Button, Tooltip} from 'antd';
import {PictureOutlined} from '@client/lib/icons';
import ImageRail, {useImageRailState} from '@admin/features/Navigation/ImageRail';

const RAIL_OPEN_CLASS = 'admin-rail-open';

/**
 * Header button + rail mount. Keeps the state hook in a functional
 * component so `AdminApp` (class) can stay hook-free. Rail itself is
 * `position: fixed`; when open we add `admin-rail-open` to `document.body`
 * so SCSS can offset `Layout.Content` to prevent the rail from covering
 * the editing surface.
 */
const ImageRailDock: React.FC = () => {
    const [open, setOpen] = useImageRailState();

    useEffect(() => {
        document.body.classList.toggle(RAIL_OPEN_CLASS, open);
        return () => document.body.classList.remove(RAIL_OPEN_CLASS);
    }, [open]);

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
