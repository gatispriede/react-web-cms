import React from 'react';
import {Button, Popconfirm, Tag} from 'antd';
import {CloudUploadOutlined} from "@client/lib/icons";
import {TFunction} from "i18next";
import Logo from "@client/features/Logo/Logo";
import ImageRailDock from "@admin/features/Navigation/ImageRailDock";
import UndoStatusPill from "../UndoStatusPill";

interface AdminBuildHeaderProps {
    admin: boolean;
    t: TFunction<"translation", undefined>;
    canEditNav: boolean;
    canPublish: boolean;
    publishing?: boolean;
    publishedAt?: string;
    mode: 'simplified' | 'advanced' | null | undefined;
    onPublish: () => void;
}

/**
 * Top strip of the /admin/build page: brand logo, image rail, undo pill, and
 * the Publish popconfirm + last-published tag. Dark-mode toggle and admin-mode
 * switcher live in the higher-level UserStatusBar so they persist across all
 * admin routes — they are intentionally absent here.
 */
const AdminBuildHeader: React.FC<AdminBuildHeaderProps> = ({
    admin, t, canEditNav, canPublish, publishing, publishedAt, mode, onPublish,
}) => {
    return (
        <div className="admin-app-header" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', flexWrap: 'wrap',
        }}>
            <Logo admin={admin} t={t}/>
            <div style={{flex: 1}}/>
            {canEditNav && <ImageRailDock/>}
            {canEditNav && <UndoStatusPill t={t}/>}
            {canPublish && mode !== 'simplified' && (
                <>
                    <Popconfirm
                        title={t('Publish to production?')}
                        description={t('This copies the current draft to the live published snapshot.')}
                        okText={t('Publish')}
                        cancelText={t('Cancel')}
                        okButtonProps={{'data-testid': 'publishing-publish-confirm-btn'} as any}
                        onConfirm={onPublish}
                    >
                        <Button data-testid="publishing-publish-btn" type="primary" icon={<CloudUploadOutlined/>} loading={publishing}>
                            {t('Publish')}
                        </Button>
                    </Popconfirm>
                    {publishedAt ? (
                        <Tag color="green">
                            {t('Last published')}: {new Date(publishedAt).toLocaleString()}
                        </Tag>
                    ) : (
                        <Tag>{t('No published snapshot yet')}</Tag>
                    )}
                </>
            )}
            {/* Dark-mode toggle + AdminModeSwitcher live in
                the top-top bar (UserStatusBar) so they
                persist across every admin route, not just
                /admin/build. AdminApp still reads the
                localStorage flag on mount so the AntD
                ConfigProvider's `darkAlgorithm` flips. */}
        </div>
    );
};

export default AdminBuildHeader;
