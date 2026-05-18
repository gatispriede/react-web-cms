/**
 * NotificationPreferencesForm — W8f notification preference center,
 * extracted from `/account/notifications` so it can be mounted inline
 * inside the `/account/settings?tab=notifications` tab.
 *
 * Behaviour, testids and copy are identical to the original page —
 * this component just makes the surface reusable. State is local
 * (fine for customer-facing screens) and load + save go through the
 * same `myNotificationPreferences` / `setMyNotificationPreferences`
 * GraphQL pair as before. Save status surfaces via inline <Alert>
 * (no sonner — matches the original behaviour to avoid changing test
 * expectations).
 */
import React, {useEffect, useState} from 'react';
import {Alert, Button, Card, Form, Select, Spin, TimePicker, Typography, Tag} from 'antd';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';
import {gql} from '@client/lib/account/gqlClient';
import {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_ROUTINGS,
    DIGEST_CADENCES,
    DEFAULT_NOTIFICATION_PREFERENCES,
    type INotificationPreferences,
    type NotificationCategory,
    type NotificationRouting,
    isMandatoryCategory,
} from '@interfaces/INotificationPreferences';

const {Text} = Typography;

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
    transactional: 'Order receipts & account security',
    'order-update': 'Order updates (shipping, delivery, refund)',
    marketing: 'Marketing & newsletters',
    'inquiry-reply': 'Replies to your inquiries',
    'low-stock': 'Back-in-stock & price-drop',
    'comment-reply': 'Replies to your comments',
};

const ROUTING_LABEL: Record<NotificationRouting, string> = {
    both: 'Email + in-app inbox',
    email: 'Email only',
    inbox: 'In-app inbox only',
    off: 'Off (no notifications)',
};

const TIMEZONES = [
    'Europe/Riga', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'America/New_York', 'America/Los_Angeles', 'UTC',
];

function parseHHmm(s: string | undefined): Dayjs | null {
    if (!s) return null;
    return dayjs(s, 'HH:mm');
}

export interface NotificationPreferencesFormProps {
    /** Optional initial preferences — when omitted the form fetches via gql on mount. */
    initialPrefs?: INotificationPreferences;
    /** Fires after a successful save (parent can refresh / toast). */
    onSave?: (prefs: INotificationPreferences) => void;
}

/**
 * Standalone notification preferences form. Drop-in for the legacy
 * `/account/notifications` page and the inline settings tab.
 */
export const NotificationPreferencesForm: React.FC<NotificationPreferencesFormProps> = ({initialPrefs, onSave}) => {
    const [loading, setLoading] = useState(!initialPrefs);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{type: 'success' | 'error'; text: string} | null>(null);
    const [prefs, setPrefs] = useState<INotificationPreferences>(initialPrefs ?? DEFAULT_NOTIFICATION_PREFERENCES);

    useEffect(() => {
        if (initialPrefs) return;
        (async () => {
            try {
                const data = await gql(`query Me { mongo { myNotificationPreferences } }`);
                const raw = data?.mongo?.myNotificationPreferences;
                if (typeof raw === 'string') {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && !parsed.error) setPrefs({...DEFAULT_NOTIFICATION_PREFERENCES, ...parsed});
                    } catch { /* keep defaults */ }
                }
            } finally {
                setLoading(false);
            }
        })();
    }, [initialPrefs]);

    const setCategoryRouting = (c: NotificationCategory, v: NotificationRouting): void => {
        setPrefs(p => ({...p, byCategory: {...p.byCategory, [c]: v}}));
    };

    const save = async (): Promise<void> => {
        setSaving(true);
        setMsg(null);
        try {
            const data = await gql(
                `mutation Save($prefs: JSON!) { mongo { setMyNotificationPreferences(prefs: $prefs) } }`,
                {prefs},
            );
            const raw = data?.mongo?.setMyNotificationPreferences;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (parsed?.error) setMsg({type: 'error', text: parsed.error});
            else {
                setMsg({type: 'success', text: 'Preferences saved.'});
                onSave?.(prefs);
            }
        } catch (e) {
            setMsg({type: 'error', text: (e as Error)?.message ?? 'Save failed'});
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div><Spin/></div>;
    }

    const quietHours = prefs.quietHours;
    const quietEnabled = Boolean(quietHours);

    return (
        <div data-testid="account-notifications-page">
            {msg && <Alert style={{marginBottom: 16}} type={msg.type} showIcon message={msg.text}/>}

            <Card title="Categories" style={{marginBottom: 16}}>
                <Text type="secondary">Choose how you want to receive each type of notification.</Text>
                <Form layout="vertical" style={{marginTop: 16}}>
                    {NOTIFICATION_CATEGORIES.map(c => {
                        const mandatory = isMandatoryCategory(c);
                        return (
                            <Form.Item
                                key={c}
                                label={<span>{CATEGORY_LABEL[c]}{mandatory && <Tag color="blue" style={{marginLeft: 8}}>required</Tag>}</span>}
                            >
                                <Select
                                    data-testid={`notif-routing-${c}`}
                                    disabled={mandatory}
                                    value={prefs.byCategory[c] ?? DEFAULT_NOTIFICATION_PREFERENCES.byCategory[c]}
                                    onChange={(v: NotificationRouting) => setCategoryRouting(c, v)}
                                    options={NOTIFICATION_ROUTINGS
                                        .filter(r => !(mandatory && r === 'off'))
                                        .map(r => ({value: r, label: ROUTING_LABEL[r]}))}
                                />
                            </Form.Item>
                        );
                    })}
                </Form>
            </Card>

            <Card title="Digest cadence" style={{marginBottom: 16}}>
                <Text type="secondary">Bundle non-urgent notifications into a digest instead of receiving them one by one.</Text>
                <Form layout="vertical" style={{marginTop: 16}}>
                    <Form.Item label="Cadence">
                        <Select
                            data-testid="notif-digest-cadence"
                            value={prefs.digestCadence ?? 'immediate'}
                            onChange={(v) => setPrefs(p => ({...p, digestCadence: v as INotificationPreferences['digestCadence']}))}
                            options={DIGEST_CADENCES.map(c => ({
                                value: c,
                                label: c === 'immediate' ? 'Immediate (no digest)' : c.charAt(0).toUpperCase() + c.slice(1),
                            }))}
                        />
                    </Form.Item>
                </Form>
            </Card>

            <Card title="Quiet hours" style={{marginBottom: 16}}>
                <Text type="secondary">Don&apos;t deliver non-critical notifications during this window.</Text>
                <Form layout="vertical" style={{marginTop: 16}}>
                    <Form.Item label="Enable quiet hours">
                        <Select
                            data-testid="notif-quiet-enabled"
                            value={quietEnabled ? 'on' : 'off'}
                            onChange={(v) => {
                                if (v === 'off') setPrefs(p => ({...p, quietHours: undefined}));
                                else setPrefs(p => ({...p, quietHours: p.quietHours ?? {start: '22:00', end: '08:00', timezone: 'Europe/Riga'}}));
                            }}
                            options={[{value: 'off', label: 'Off'}, {value: 'on', label: 'On'}]}
                        />
                    </Form.Item>
                    {quietEnabled && quietHours && (
                        <>
                            <Form.Item label="Start">
                                <TimePicker
                                    data-testid="notif-quiet-start"
                                    format="HH:mm"
                                    value={parseHHmm(quietHours.start)}
                                    onChange={(v) => setPrefs(p => ({...p, quietHours: {...(p.quietHours ?? quietHours), start: v?.format('HH:mm') ?? '22:00'}}))}
                                />
                            </Form.Item>
                            <Form.Item label="End">
                                <TimePicker
                                    data-testid="notif-quiet-end"
                                    format="HH:mm"
                                    value={parseHHmm(quietHours.end)}
                                    onChange={(v) => setPrefs(p => ({...p, quietHours: {...(p.quietHours ?? quietHours), end: v?.format('HH:mm') ?? '08:00'}}))}
                                />
                            </Form.Item>
                            <Form.Item label="Timezone">
                                <Select
                                    data-testid="notif-quiet-timezone"
                                    value={quietHours.timezone}
                                    onChange={(v) => setPrefs(p => ({...p, quietHours: {...(p.quietHours ?? quietHours), timezone: v}}))}
                                    options={TIMEZONES.map(t => ({value: t, label: t}))}
                                />
                            </Form.Item>
                        </>
                    )}
                </Form>
            </Card>

            <Button
                type="primary"
                loading={saving}
                onClick={save}
                data-testid="notif-save"
            >Save preferences</Button>
        </div>
    );
};

export default NotificationPreferencesForm;
