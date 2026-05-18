import React from 'react';
import {Modal, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {SHORTCUTS, type ShortcutEntry} from './shortcuts';

interface Props {
    open: boolean;
    onClose: () => void;
}

/**
 * `?`-triggered cheatsheet. Auto-generated from the catalogue in
 * `shortcuts.ts` — adding a binding there picks up here without edits.
 *
 * AntD `<Modal>` keeps the visual idiom consistent with the rest of the
 * admin (delete confirms, AddNewDialog, etc.); no kbar-specific chrome.
 */
const Cheatsheet: React.FC<Props> = ({open, onClose}) => {
    const {t} = useTranslation();
    const grouped = React.useMemo(() => {
        const acc = new Map<ShortcutEntry['section'], ShortcutEntry[]>();
        for (const s of SHORTCUTS) {
            const list = acc.get(s.section) ?? [];
            list.push(s);
            acc.set(s.section, list);
        }
        return Array.from(acc.entries());
    }, []);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            onOk={onClose}
            title={t('Keyboard shortcuts')}
            footer={null}
            width={520}
            data-testid="cmdk-cheatsheet-modal"
        >
            <div data-testid="cmdk-cheatsheet-body" style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                {grouped.map(([section, items]) => (
                    <section key={section} data-testid={`cmdk-cheatsheet-section-${section.toLowerCase()}`}>
                        <Typography.Title level={5} style={{marginBottom: 8}}>{t(section)}</Typography.Title>
                        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    data-testid={`cmdk-cheatsheet-row-${item.id}`}
                                    style={{display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between'}}
                                >
                                    <Typography.Text>{t(item.label)}</Typography.Text>
                                    <span style={{display: 'flex', gap: 4}}>
                                        {item.keys.map((k) => (
                                            <Tag key={k} style={{fontFamily: 'ui-monospace, monospace'}}>{prettyKey(k)}</Tag>
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </Modal>
    );
};

function prettyKey(k: string): string {
    return k
        .replace('$mod', isMac() ? '⌘' : 'Ctrl')
        .replace('Shift', '⇧')
        .replace('Enter', '↵')
        .replace(/\+/g, ' + ');
}

function isMac(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad/.test(navigator.platform);
}

export default Cheatsheet;
