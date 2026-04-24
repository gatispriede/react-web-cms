import React, {useEffect, useMemo, useState} from 'react';
import {Button, Input, Modal, Radio, Space, Tag, Typography} from 'antd';
import {SearchOutlined} from '@client/lib/icons';
import {GOOGLE_FONTS, IGoogleFont, buildFontStack, buildGoogleFontsUrl, extractFontFamily} from '@client/features/Themes/googleFonts';

type Slot = 'display' | 'sans' | 'mono';

const SLOT_LABEL: Record<Slot, string> = {
    display: 'Display (headings)',
    sans: 'Body (sans)',
    mono: 'Monospace (labels, ticks)',
};

const SLOT_PREFERRED_CATEGORIES: Record<Slot, IGoogleFont['category'][]> = {
    display: ['display', 'serif', 'sans-serif'],
    sans: ['sans-serif', 'serif'],
    mono: ['monospace'],
};

const CATEGORY_LABEL: Record<IGoogleFont['category'], string> = {
    'sans-serif': 'Sans',
    serif: 'Serif',
    display: 'Display',
    handwriting: 'Hand',
    monospace: 'Mono',
};

const CATEGORIES: IGoogleFont['category'][] = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

/**
 * In-app browser for the curated Google Fonts catalogue. Loads the chosen
 * family on hover via a runtime `<link>` insertion so editors see the actual
 * face before activating — avoids the "looked different in the picker" trap.
 *
 * The picker writes a full CSS font-family stack (with category-appropriate
 * fallbacks) back to the slot, not just the family name — keeps the runtime
 * tokens self-contained and the SCSS untouched.
 */
const FontPicker: React.FC<{
    open: boolean;
    slot: Slot;
    currentStack: string | undefined;
    onCancel: () => void;
    onPick: (stack: string) => void;
}> = ({open, slot, currentStack, onCancel, onPick}) => {
    const initialFamily = extractFontFamily(currentStack ?? '');
    const initialCategory = SLOT_PREFERRED_CATEGORIES[slot][0];
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<IGoogleFont['category'] | 'all'>(initialCategory);
    const [picked, setPicked] = useState<string | null>(initialFamily);

    useEffect(() => {
        if (!open) return;
        setSearch('');
        setCategory(SLOT_PREFERRED_CATEGORIES[slot][0]);
        setPicked(extractFontFamily(currentStack ?? ''));
    }, [open, slot, currentStack]);

    const list = useMemo(() => {
        const lower = search.trim().toLowerCase();
        return GOOGLE_FONTS
            .filter(f => category === 'all' || f.category === category)
            .filter(f => !lower || f.family.toLowerCase().includes(lower));
    }, [search, category]);

    // Lazy-inject a single link tag with every family currently visible plus
    // the picked one. Browsers dedupe identical hrefs so re-renders are cheap.
    useEffect(() => {
        if (!open) return;
        const families = [picked, ...list.slice(0, 30).map(f => f.family)];
        const url = buildGoogleFontsUrl(families);
        if (!url) return;
        const id = 'font-picker-preview-link';
        let link = document.getElementById(id) as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        if (link.href !== url) link.href = url;
    }, [open, list, picked]);

    const previewFamily = picked ?? initialFamily;

    return (
        <Modal
            open={open}
            title={`Pick a font — ${SLOT_LABEL[slot]}`}
            width={760}
            onCancel={onCancel}
            okText="Use this font"
            okButtonProps={{disabled: !picked}}
            onOk={() => { if (picked) onPick(buildFontStack(picked)); }}
        >
            <Space direction="vertical" style={{width: '100%'}} size={12}>
                <Input
                    allowClear
                    placeholder="Search families"
                    prefix={<SearchOutlined/>}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Radio.Group
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    optionType="button"
                    size="small"
                >
                    <Radio.Button value="all">All</Radio.Button>
                    {CATEGORIES.map(c => (
                        <Radio.Button key={c} value={c}>{CATEGORY_LABEL[c]}</Radio.Button>
                    ))}
                </Radio.Group>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                    <div style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        height: 320,
                        overflowY: 'auto',
                    }}>
                        {list.length === 0 ? (
                            <div style={{padding: 16, color: '#999'}}>No matches.</div>
                        ) : list.map(font => {
                            const active = picked?.toLowerCase() === font.family.toLowerCase();
                            return (
                                <button
                                    key={font.family}
                                    type="button"
                                    onClick={() => setPicked(font.family)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '10px 12px',
                                        border: 0,
                                        borderBottom: '1px solid #f5f5f5',
                                        background: active ? '#e6f4ff' : '#fff',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 2,
                                    }}
                                >
                                    <span style={{
                                        fontFamily: `'${font.family}', ${font.category === 'monospace' ? 'monospace' : 'system-ui'}`,
                                        fontSize: 18,
                                    }}>
                                        {font.family}
                                    </span>
                                    <span style={{fontSize: 11, color: '#888'}}>
                                        {CATEGORY_LABEL[font.category]} · {font.variants.length} weight{font.variants.length === 1 ? '' : 's'}
                                        {font.subsets.includes('cyrillic') && ' · Cyrillic'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        padding: 16,
                        height: 320,
                        overflow: 'hidden',
                        background: '#fafafa',
                    }}>
                        <Typography.Text type="secondary" style={{fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase'}}>
                            Preview
                        </Typography.Text>
                        <div style={{
                            fontFamily: previewFamily ? `'${previewFamily}', system-ui, sans-serif` : 'system-ui, sans-serif',
                            marginTop: 12,
                        }}>
                            <div style={{fontSize: 32, lineHeight: 1.1, fontWeight: 600, marginBottom: 12}}>
                                Quick brown fox jumps over the lazy dog.
                            </div>
                            <div style={{fontSize: 14, lineHeight: 1.5, color: '#444'}}>
                                The body paragraph carries the long copy — captions, descriptions, the actual content of the page. 0123456789 — Latvietis · Москва · Café.
                            </div>
                            {previewFamily && (
                                <Tag style={{marginTop: 12}}>{previewFamily}</Tag>
                            )}
                        </div>
                    </div>
                </div>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    Catalogue: {GOOGLE_FONTS.length} hand-curated families. Picked font is loaded from <code>fonts.googleapis.com</code> on save — embeds visitor IPs in third-party requests, see GDPR notes in <code>roadmap/google-fonts-picker.md</code>.
                </Typography.Text>
                {currentStack && (
                    <Space size={6}>
                        <Typography.Text type="secondary" style={{fontSize: 12}}>Current stack:</Typography.Text>
                        <Typography.Text code style={{fontSize: 11}}>{currentStack}</Typography.Text>
                        <Button size="small" type="link" onClick={() => onPick('')}>Clear</Button>
                    </Space>
                )}
            </Space>
        </Modal>
    );
};

export default FontPicker;
export type {Slot as FontPickerSlot};
