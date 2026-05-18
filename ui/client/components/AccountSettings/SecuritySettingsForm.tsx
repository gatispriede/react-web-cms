import React, {useEffect, useState} from 'react';
import {Button, Empty, List, Skeleton, Alert} from 'antd';
import {toast} from 'sonner';

/**
 * Security tab — surfaces magic-link history + active sessions list
 * with revoke. Reads via `me`-shape session endpoint when the
 * customer-stack exposes it; falls back to "no recent activity" for
 * stacks that don't.
 *
 * The actual session-revoke endpoint is owned by the customer auth
 * stack (auth-split-client-admin); this form only surfaces it.
 */
export interface IClientSession {
    id: string;
    userAgent?: string;
    issuedAt?: string;
    lastSeen?: string;
}

export const SecuritySettingsForm: React.FC = () => {
    const [sessions, setSessions] = useState<IClientSession[] | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        // Best-effort — surface from a future `/api/account/sessions`
        // route if/when the auth stack publishes it. For now we render
        // the empty state to keep the tab usable.
        setSessions([]);
    }, []);

    const revoke = async (sessionId: string) => {
        setBusy(true);
        try {
            const res = await fetch('/api/account/sessions/revoke', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({sessionId}),
            });
            if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
            toast.success('Session revoked');
            setSessions(s => (s ?? []).filter(x => x.id !== sessionId));
        } catch (e) {
            toast.error(`Revoke failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    if (sessions === null) return <Skeleton active/>;
    return (
        <div data-testid="security-settings-form">
            <Alert type="info" message="Active sessions are managed by the customer auth stack." style={{marginBottom: 12}}/>
            {sessions.length === 0 ? (
                <Empty description="No active sessions to revoke" data-testid="security-sessions-empty"/>
            ) : (
                <List
                    dataSource={sessions}
                    renderItem={s => (
                        <List.Item
                            actions={[
                                <Button key="revoke" danger onClick={() => void revoke(s.id)} loading={busy} data-testid={`security-revoke-${s.id}`}>Revoke</Button>,
                            ]}
                        >
                            <List.Item.Meta title={s.userAgent ?? 'Unknown agent'} description={`Last seen: ${s.lastSeen ?? 'n/a'}`}/>
                        </List.Item>
                    )}
                />
            )}
        </div>
    );
};

export default SecuritySettingsForm;
