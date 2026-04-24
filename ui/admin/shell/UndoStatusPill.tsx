import React from 'react';
import {Button, Space, Tag, Tooltip} from 'antd';
import {RedoOutlined, UndoOutlined} from '@client/lib/icons';
import {TFunction} from 'i18next';
import {undoStack, useUndoHotkey, useUndoStack} from '@client/lib/undoStack';

const UndoStatusPill: React.FC<{t: TFunction<'translation', undefined>}> = ({t}) => {
    useUndoHotkey(true);
    const {size, redoSize, lastLabel} = useUndoStack();
    const undoHint = lastLabel
        ? `${t('Undo')}: ${lastLabel} (Ctrl+Z)`
        : `${t('Nothing to undo')} (Ctrl+Z)`;
    return (
        <Space size={4}>
            <Tooltip title={undoHint}>
                <Button
                    size="small"
                    type="text"
                    icon={<UndoOutlined/>}
                    disabled={size === 0}
                    onClick={() => { void undoStack.undo(); }}
                    aria-label={t('Undo')}
                />
            </Tooltip>
            <Tooltip title={`${t('Redo')} (Ctrl+Shift+Z)`}>
                <Button
                    size="small"
                    type="text"
                    icon={<RedoOutlined/>}
                    disabled={redoSize === 0}
                    onClick={() => { void undoStack.redo(); }}
                    aria-label={t('Redo')}
                />
            </Tooltip>
            {size > 0 && <Tag style={{margin: 0}}>{size}</Tag>}
        </Space>
    );
};

export default UndoStatusPill;
