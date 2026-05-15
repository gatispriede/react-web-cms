import React from 'react';
import {Tooltip} from 'antd';
import {useTranslation} from 'react-i18next';
import {LockOutlined} from '@client/lib/icons';

interface Props {
    /** Section id — drives `data-testid` so e2e specs can scope to a row. */
    sectionId?: string;
    /** Either an i18n key (prefix `section.locked.`) or a literal string. */
    reason?: string;
}

/**
 * Visual lock affordance for system-managed sections (Phase 0a).
 *
 * Stateless. Renders a small antd `<Tooltip>` wrapping a `<LockOutlined>`
 * icon next to a section title. Resolves `reason` through `t()` when it
 * looks like an i18n key (`section.locked.*`) — otherwise treats it as a
 * literal so callers can pass either a static label or a translation key
 * without forking call sites.
 *
 * Consumed by `EditWrapper` whenever the host section has `locked: true`.
 * See `docs/architecture/section-lock-affordance.md` for the pattern.
 */
const LockedSectionAffordance: React.FC<Props> = ({sectionId, reason}) => {
    const {t} = useTranslation('admin');
    const isI18nKey = typeof reason === 'string' && reason.startsWith('section.locked.');
    const resolved = reason
        ? (isI18nKey ? (t(reason) as string) : reason)
        : (t('section.locked.tooltip') as string);
    const testid = sectionId
        ? `section-locked-affordance-${sectionId}`
        : 'section-locked-affordance';
    return (
        <Tooltip title={resolved}>
            <span data-testid={testid} aria-label={resolved} style={{display: 'inline-flex', alignItems: 'center', color: '#8c8c8c'}}>
                <LockOutlined/>
            </span>
        </Tooltip>
    );
};

export default LockedSectionAffordance;
