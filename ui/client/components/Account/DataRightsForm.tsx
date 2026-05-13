/**
 * DataRightsForm — W8b GDPR data-rights surface (download + delete +
 * cookie-consent reset), extracted from `/account/privacy` so it can
 * mount inline inside `/account/settings?tab=privacy`.
 *
 * Behaviour, testids and copy are unchanged — only the page chrome
 * (title bar, "Back" link, outer wrapper) moves up to the page that
 * embeds it. Inline <Alert> status preserved from the original.
 */
import React, {useState} from 'react';
import {Alert, Button, Card, Modal, Typography, Space} from 'antd';
import {STORAGE_KEY} from '@client/components/CookieConsent/consentStore';

const {Text, Paragraph} = Typography;

export interface DataRightsFormProps {
    /** Fires after a successful download or scheduled-delete. */
    onSave?: (kind: 'export' | 'delete') => void;
}

/**
 * Standalone privacy / data-rights form. Drop-in for the legacy
 * `/account/privacy` page and the inline settings tab.
 */
export const DataRightsForm: React.FC<DataRightsFormProps> = ({onSave}) => {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
    const [msg, setMsg] = useState<{type: 'success' | 'error' | 'info'; text: string} | null>(null);

    const exportData = async (): Promise<void> => {
        setBusy('export');
        setMsg(null);
        try {
            const r = await fetch('/api/account/data-export', {credentials: 'same-origin'});
            if (!r.ok) throw new Error(`Export failed: ${r.status}`);
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMsg({type: 'success', text: 'Download started.'});
            onSave?.('export');
        } catch (err) {
            setMsg({type: 'error', text: (err as Error).message});
        } finally {
            setBusy(null);
        }
    };

    const deleteAccount = async (): Promise<void> => {
        setBusy('delete');
        setMsg(null);
        try {
            const r = await fetch('/api/account/delete', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({confirm: 'DELETE'}),
            });
            if (!r.ok) {
                const j = await r.json().catch(() => ({}));
                throw new Error(j?.error || `Delete failed: ${r.status}`);
            }
            const j = await r.json();
            setMsg({
                type: 'success',
                text: `Account deletion scheduled. Your data will be permanently removed on ${new Date(j.scheduledFor).toLocaleDateString()}.`,
            });
            setConfirmOpen(false);
            onSave?.('delete');
        } catch (err) {
            setMsg({type: 'error', text: (err as Error).message});
        } finally {
            setBusy(null);
        }
    };

    const resetCookieChoice = (): void => {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        document.cookie = 'cookie_consent=; Path=/; Max-Age=0; SameSite=Lax';
        setMsg({type: 'info', text: 'Cookie preferences cleared — banner will re-show on next page load.'});
    };

    return (
        <div data-testid="account-privacy-page">
            {msg && <Alert style={{marginBottom: 16}} type={msg.type} showIcon message={msg.text}/>}

            <Card title="Download my data" style={{marginBottom: 16}}>
                <Paragraph>
                    Get a JSON copy of every record we hold under your account — profile,
                    orders, inquiries, addresses, notification preferences and marketing
                    attribution events.
                </Paragraph>
                <Button
                    type="primary"
                    loading={busy === 'export'}
                    onClick={exportData}
                    data-testid="account-privacy-export"
                >
                    Download my data
                </Button>
            </Card>

            <Card title="Cookie preferences" style={{marginBottom: 16}}>
                <Paragraph>
                    You can re-open the cookie consent banner to change your choices.
                </Paragraph>
                <Button onClick={resetCookieChoice} data-testid="account-privacy-reset-cookies">
                    Adjust cookie preferences
                </Button>
            </Card>

            <Card title="Delete my account" style={{marginBottom: 16, borderColor: '#d4380d'}}>
                <Paragraph>
                    Deletion soft-removes your data immediately and permanently purges it after
                    a <Text strong>30-day grace window</Text>. You can contact support during
                    that window to cancel.
                </Paragraph>
                <Paragraph type="secondary">
                    Note: order records required for tax + accounting are anonymised, not
                    erased, per legal retention rules.
                </Paragraph>
                <Button
                    danger
                    onClick={() => setConfirmOpen(true)}
                    data-testid="account-privacy-delete-open"
                >
                    Delete my account
                </Button>
            </Card>

            <Modal
                open={confirmOpen}
                title="Delete account?"
                okText="Yes, delete"
                okButtonProps={{danger: true, loading: busy === 'delete', 'data-testid': 'account-privacy-delete-confirm'} as never}
                cancelText="Cancel"
                onOk={deleteAccount}
                onCancel={() => setConfirmOpen(false)}
                data-testid="account-privacy-delete-modal"
            >
                <Space direction="vertical">
                    <Text>This is irreversible after the 30-day grace window.</Text>
                    <Text type="secondary">
                        Sister records (orders, inquiries, wishlist) will be moved to soft-trash
                        immediately and hard-deleted at the end of the window.
                    </Text>
                </Space>
            </Modal>
        </div>
    );
};

export default DataRightsForm;
