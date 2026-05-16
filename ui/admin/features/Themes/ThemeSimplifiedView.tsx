import React, {useEffect, ReactNode} from 'react';
import {Button, Card, Col, Row, Space, Tag} from 'antd';
import {CheckCircleFilled} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {ITheme} from '@interfaces/ITheme';
import ThemePreviewFrame from './ThemePreviewFrame';
import {useRefreshView} from '@client/lib/useRefreshView';
import {useViewModel} from '@client/lib/state/observable';
import EmptyState from '@admin/lib/EmptyState';
import {ThemesViewModel} from './ThemesViewModel';

interface Props {
    /** Slot for additional toolbar buttons (Create / Refresh / Bulk delete in advanced mode). */
    headerExtra?: ReactNode;
    /** Per-card extra actions; called with the theme + active flag. Advanced mode passes Edit/Duplicate/Delete/Reset buttons. */
    renderCardActions?: (theme: ITheme, isActive: boolean) => ReactNode;
    /**
     * Optional shared VM (advanced mode owns one with editor / conflict
     * state and passes it down). Falls back to a fresh VM in pure
     * simplified mode (admin-ui-modes decision 4 — VM is shared).
     */
    vm?: ThemesViewModel;
    /**
     * Mode the pane is rendering as. Drives the mode-prefixed card
     * testid (`themes-simplified-card-{id}` vs `themes-advanced-card-{id}`)
     * per the AUI hierarchy spec (2026-05-07). Defaults to 'simplified'
     * — the advanced view passes 'advanced' when composing this base.
     */
    mode?: 'simplified' | 'advanced';
    /** Optional extras rendered after the gallery (modal editors, conflict dialog). */
    children?: ReactNode;
}

/**
 * Simplified Themes pane — preset gallery only.
 *
 * Shows every theme as a preview card with one Activate button. No
 * editor modal, no New/Duplicate/Delete/Reset, no color picker, no
 * font picker. The author picks one and moves on.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07) this is the **base
 * component**: the advanced view composes it via `headerExtra` +
 * `renderCardActions` slots and an optional shared `vm`. Cards keep
 * their `themes-list-row-{id}` testids so e2e specs target the same
 * surface in both modes.
 */
const ThemeSimplifiedView: React.FC<Props> = ({headerExtra, renderCardActions, vm: vmProp, mode = 'simplified', children}) => {
    const {t} = useTranslation();
    const ownVm = useViewModel(() => new ThemesViewModel(undefined, t));
    const vm = vmProp ?? ownVm;

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16}}>
            {headerExtra && (
                <Space style={{marginBottom: 16}} align="center" wrap>
                    {headerExtra}
                </Space>
            )}
            {vm.themes.length === 0 ? (
                <EmptyState
                    testId={`themes-${mode}-empty-state`}
                    title={t('empty.themes.title')}
                    description={t('empty.themes.description')}
                    art="themes"
                    primary={{
                        label: t('empty.themes.primary'),
                        onClick: () => void vm.refresh(),
                        testId: 'themes-empty-primary-btn',
                    }}
                />
            ) : null}
            <Row gutter={[12, 12]}>
                {vm.themes.map((theme: ITheme) => {
                    const active = theme.id === vm.activeId;
                    return (
                        <Col xs={24} md={12} lg={8} key={theme.id}>
                            <Card
                                data-testid={`themes-${mode}-card-${theme.id}`}
                                data-legacy-testid={`themes-list-row-${theme.id}`}
                                size="small"
                                title={
                                    <Space>
                                        {theme.name}
                                        {!theme.custom && <Tag color="blue">{t('Preset')}</Tag>}
                                        {active && <Tag color="green" icon={<CheckCircleFilled/>}>{t('Active')}</Tag>}
                                    </Space>
                                }
                                extra={
                                    <Button
                                        data-testid="themes-set-active-btn"
                                        size="small"
                                        type="primary"
                                        disabled={active}
                                        onClick={() => vm.activate(theme.id)}
                                    >
                                        {t('Activate')}
                                    </Button>
                                }
                            >
                                <ThemePreviewFrame tokens={theme.tokens} themeName={theme.name} width={260}/>
                                {renderCardActions && (
                                    <div style={{marginTop: 10}}>
                                        {renderCardActions(theme, active)}
                                    </div>
                                )}
                            </Card>
                        </Col>
                    );
                })}
            </Row>
            {children}
        </div>
    );
};

export default ThemeSimplifiedView;
