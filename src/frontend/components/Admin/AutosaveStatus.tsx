import React from 'react';
import {Typography, Tooltip} from 'antd';
import {CheckCircleFilled, CloseCircleFilled, LoadingOutlined, EditOutlined} from '../common/icons';
import type {AutosaveStatus as Status} from '../../lib/useAutosave';

/** Small inline pill that reads an `AutosaveStatus` and shows the right colour/icon/text. */
export const AutosaveStatusBadge: React.FC<{status: Status; error?: string}> = ({status, error}) => {
    if (status === 'idle') return null;
    if (status === 'dirty') {
        return <Typography.Text type="secondary" style={{fontSize: 12}}>
            <EditOutlined style={{marginRight: 4}}/> Editing…
        </Typography.Text>;
    }
    if (status === 'saving') {
        return <Typography.Text type="secondary" style={{fontSize: 12}}>
            <LoadingOutlined style={{marginRight: 4}}/> Saving
        </Typography.Text>;
    }
    if (status === 'saved') {
        return <Typography.Text style={{fontSize: 12, color: 'var(--theme-colorSuccess, #52c41a)'}}>
            <CheckCircleFilled style={{marginRight: 4}}/> Saved
        </Typography.Text>;
    }
    return (
        <Tooltip title={error}>
            <Typography.Text style={{fontSize: 12, color: 'var(--theme-colorError, #ff4d4f)'}}>
                <CloseCircleFilled style={{marginRight: 4}}/> Save failed
            </Typography.Text>
        </Tooltip>
    );
};

export default AutosaveStatusBadge;
