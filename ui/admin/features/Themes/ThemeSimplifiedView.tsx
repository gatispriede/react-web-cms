import React, {useEffect} from 'react';
import {Button, Card, Col, Row, Space, Tag} from 'antd';
import {CheckCircleFilled} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {ITheme} from '@interfaces/ITheme';
import ThemePreviewFrame from './ThemePreviewFrame';
import {useRefreshView} from '@client/lib/refreshBus';
import {useViewModel} from '@client/lib/state/observable';
import {ThemesViewModel} from './ThemesViewModel';

/**
 * Simplified Themes pane — preset gallery only.
 *
 * Shows every theme as a preview card with one Activate button. No
 * editor modal, no New/Duplicate/Delete/Reset, no color picker, no
 * font picker. The author picks one and moves on. The advanced view
 * remains the only path for token-level edits.
 *
 * Shares the same `ThemesViewModel` as the advanced view so reads and
 * writes flow through one source of truth (admin-ui-modes decision 4
 * — VM is shared across modes).
 */
const ThemeSimplifiedView: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ThemesViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16}}>
            <Row gutter={[12, 12]}>
                {vm.themes.map((theme: ITheme) => {
                    const active = theme.id === vm.activeId;
                    return (
                        <Col xs={24} md={12} lg={8} key={theme.id}>
                            <Card
                                size="small"
                                title={
                                    <Space>
                                        {theme.name}
                                        {active && <Tag color="green" icon={<CheckCircleFilled/>}>{t('Active')}</Tag>}
                                    </Space>
                                }
                                extra={
                                    <Button
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
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
};

export default ThemeSimplifiedView;
