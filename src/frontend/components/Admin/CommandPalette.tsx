import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Input, List, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {i18n as globalI18n} from 'next-i18next';

interface Command {
    id: string;
    label: string;
    hint?: string;
    keywords?: string;
    action: () => void;
}

interface Props {
    open: boolean;
    onClose: () => void;
    extra?: Command[];
}

const navigate = (href: string) => {
    if (typeof window !== 'undefined') window.location.assign(href);
};

const openNew = (href: string) => {
    if (typeof window !== 'undefined') window.open(href, '_blank', 'noopener,noreferrer');
};

const useLang = (): string => {
    const lang = globalI18n?.language;
    return (lang && lang !== 'default') ? lang : 'en';
};

/**
 * Minimal Cmd/Ctrl-K command palette — jumps to admin destinations. Opt-in by
 * the caller via `open`, and also self-binds a global keybinding that fires
 * `onHotkey` (when provided) so a parent page can toggle it.
 */
export const CommandPalette: React.FC<Props> = ({open, onClose, extra}) => {
    const {t} = useTranslation();
    const [filter, setFilter] = useState('');
    const [selected, setSelected] = useState(0);
    const lang = useLang();

    const commands = useMemo<Command[]>(() => {
        const list: Command[] = [
            {id: 'app', label: t('App building'), hint: `/${lang}/admin`, action: () => navigate(`/${lang}/admin`)},
            {id: 'settings', label: t('Site settings'), hint: `/${lang}/admin/settings`, action: () => navigate(`/${lang}/admin/settings`)},
            {id: 'languages', label: t('Languages'), hint: `/${lang}/admin/languages`, action: () => navigate(`/${lang}/admin/languages`)},
            {id: 'preview', label: t('Preview site'), hint: `/${lang}`, action: () => openNew(`/${lang}`)},
            {id: 'blog', label: t('Open blog'), hint: `/${lang}/blog`, action: () => openNew(`/${lang}/blog`)},
        ];
        return [...list, ...(extra ?? [])];
    }, [lang, t, extra]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter(c =>
            c.label.toLowerCase().includes(q) ||
            c.hint?.toLowerCase().includes(q) ||
            c.keywords?.toLowerCase().includes(q)
        );
    }, [filter, commands]);

    useEffect(() => { setSelected(0); }, [filter, open]);

    const run = (cmd: Command) => {
        onClose();
        cmd.action();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            closable={false}
            destroyOnClose
            width={560}
            styles={{body: {padding: 12}}}
        >
            <Input
                autoFocus
                placeholder={t('Type a command…')}
                value={filter}
                onChange={e => setFilter(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(filtered.length - 1, s + 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(0, s - 1)); }
                    else if (e.key === 'Enter' && filtered[selected]) { e.preventDefault(); run(filtered[selected]); }
                    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
                }}
            />
            <List
                style={{marginTop: 8, maxHeight: 360, overflow: 'auto'}}
                size="small"
                dataSource={filtered}
                locale={{emptyText: t('No matching commands')}}
                renderItem={(cmd, i) => (
                    <List.Item
                        onMouseEnter={() => setSelected(i)}
                        onClick={() => run(cmd)}
                        style={{cursor: 'pointer', background: i === selected ? 'var(--theme-colorBgBase, rgba(0,0,0,0.04))' : undefined, paddingInline: 12}}
                    >
                        <div style={{display: 'flex', width: '100%', alignItems: 'center', gap: 8}}>
                            <Typography.Text>{cmd.label}</Typography.Text>
                            {cmd.hint && <Typography.Text type="secondary" style={{marginLeft: 'auto', fontSize: 12}}>{cmd.hint}</Typography.Text>}
                        </div>
                    </List.Item>
                )}
            />
        </Modal>
    );
};

/** Hook that wires Ctrl/Cmd+K to a setter. */
export function useCommandPaletteHotkey(setOpen: (v: boolean) => void) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                setOpen(true);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setOpen]);
}

export default CommandPalette;
