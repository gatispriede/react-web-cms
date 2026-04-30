import React, {useEffect, useMemo, useState} from 'react';
import {Modal, Input, List, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {i18n as globalI18n} from 'next-i18next/pages';

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
        // Six-area structure (admin segregation §11a). Each area + every
        // sub-page is its own command so an operator can jump directly.
        const list: Command[] = [
            // Page building
            {id: 'build', label: t('Page building'), keywords: 'build pages app sections', hint: `/admin/build`, action: () => navigate(`/admin/build`)},
            {id: 'build/modules-preview', label: t('Style matrix'), keywords: 'modules preview styles', hint: `/admin/build/modules-preview`, action: () => navigate(`/admin/build/modules-preview`)},
            // Client configuration
            {id: 'client-config/themes', label: t('Themes'), keywords: 'themes colors', hint: `/admin/client-config/themes`, action: () => navigate(`/admin/client-config/themes`)},
            {id: 'client-config/logo', label: t('Logo'), keywords: 'logo brand', hint: `/admin/client-config/logo`, action: () => navigate(`/admin/client-config/logo`)},
            {id: 'client-config/site-layout', label: t('Layout'), keywords: 'layout tabs scroll', hint: `/admin/client-config/site-layout`, action: () => navigate(`/admin/client-config/site-layout`)},
            // Content management
            {id: 'content/translations', label: t('Translations'), keywords: 'translations languages i18n', hint: `/admin/content/translations`, action: () => navigate(`/admin/content/translations`)},
            {id: 'content/posts', label: t('Blog posts'), keywords: 'blog posts articles', hint: `/admin/content/posts`, action: () => navigate(`/admin/content/posts`)},
            {id: 'content/footer', label: t('Footer'), keywords: 'footer copyright', hint: `/admin/content/footer`, action: () => navigate(`/admin/content/footer`)},
            {id: 'content/products', label: t('Products'), keywords: 'products store catalog', hint: `/admin/content/products`, action: () => navigate(`/admin/content/products`)},
            {id: 'content/inventory', label: t('Inventory'), keywords: 'inventory warehouse stock', hint: `/admin/content/inventory`, action: () => navigate(`/admin/content/inventory`)},
            {id: 'content/orders', label: t('Orders'), keywords: 'orders checkout customers', hint: `/admin/content/orders`, action: () => navigate(`/admin/content/orders`)},
            // SEO
            {id: 'seo', label: t('SEO'), keywords: 'seo meta sitemap', hint: `/admin/seo`, action: () => navigate(`/admin/seo`)},
            // Release / publishing / auditing
            {id: 'release/publishing', label: t('Publishing'), keywords: 'publish snapshot rollback', hint: `/admin/release/publishing`, action: () => navigate(`/admin/release/publishing`)},
            {id: 'release/bundle', label: t('Bundle export / import'), keywords: 'bundle export import backup', hint: `/admin/release/bundle`, action: () => navigate(`/admin/release/bundle`)},
            {id: 'release/audit', label: t('Audit log'), keywords: 'audit log history', hint: `/admin/release/audit`, action: () => navigate(`/admin/release/audit`)},
            // Admin side management
            {id: 'system/users', label: t('Users'), keywords: 'users admins accounts', hint: `/admin/system/users`, action: () => navigate(`/admin/system/users`)},
            {id: 'system/mcp', label: t('MCP tokens'), keywords: 'mcp tokens ai claude cursor', hint: `/admin/system/mcp`, action: () => navigate(`/admin/system/mcp`)},
            {id: 'system/inquiries', label: t('Inquiries'), keywords: 'inquiries contact submissions', hint: `/admin/system/inquiries`, action: () => navigate(`/admin/system/inquiries`)},
            // Cross-area utilities
            {id: 'preview', label: t('Preview site'), keywords: 'preview public site', hint: `/${lang}`, action: () => openNew(`/${lang}`)},
            {id: 'open-blog', label: t('Open blog'), keywords: 'blog public', hint: `/${lang}/blog`, action: () => openNew(`/${lang}/blog`)},
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
