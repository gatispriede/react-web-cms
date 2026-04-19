import React from 'react';
import {Tooltip, Typography} from 'antd';
import {ClockCircleOutlined} from '../common/icons';

const formatRelative = (iso: string): string => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const diffMs = Date.now() - t;
    const s = Math.round(diffMs / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toISOString().slice(0, 10);
};

/**
 * Inline "last edited by X · 2m ago" badge shown next to section/page headers
 * in the admin. Reads the `editedBy` + `editedAt` audit stamps the services
 * now write on every content mutation.
 */
export const AuditBadge: React.FC<{editedBy?: string | null; editedAt?: string | null; compact?: boolean}> = ({
    editedBy, editedAt, compact,
}) => {
    if (!editedAt) return null;
    const relative = formatRelative(editedAt);
    const label = editedBy ? `${editedBy} · ${relative}` : relative;
    const full = editedBy ? `Last edited by ${editedBy} — ${new Date(editedAt).toLocaleString()}` : `Last edited ${new Date(editedAt).toLocaleString()}`;
    return (
        <Tooltip title={full}>
            <Typography.Text type="secondary" style={{fontSize: compact ? 11 : 12, fontWeight: 400, whiteSpace: 'nowrap'}}>
                <ClockCircleOutlined style={{marginRight: 4}}/>
                {label}
            </Typography.Text>
        </Tooltip>
    );
};

export default AuditBadge;
