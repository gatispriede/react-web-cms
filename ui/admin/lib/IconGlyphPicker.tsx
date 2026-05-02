import React, {useMemo, useState} from "react";
import {Button, Input, Modal, Tabs} from "antd";
import {SearchOutlined} from "@client/lib/icons";
import type {TFunction} from "i18next";
import {LabeledInput} from "@client/lib/LabeledInput";

interface Props {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    wrapperStyle?: React.CSSProperties;
    t: TFunction<"translation", undefined>;
}

interface GlyphEntry {
    glyph: string;
    tags: string;
}

/**
 * Curated catalog of single-character glyphs that render reliably across
 * the fonts the site ships. Tags drive the search box — keywords are
 * comma-separated, lowercase. Add new entries here rather than reaching
 * for an emoji picker library: the renderer treats the glyph as plain
 * text inside a 1-line CSS box, so anything outside the BMP risks falling
 * back to a system emoji and breaking the visual rhythm of a "Services"
 * grid. Stick to geometric / arrow / symbol Unicode where possible.
 */
const CATALOG: Record<string, GlyphEntry[]> = {
    Geometric: [
        {glyph: '▲', tags: 'triangle, up, point'},
        {glyph: '▼', tags: 'triangle, down'},
        {glyph: '◆', tags: 'diamond, gem'},
        {glyph: '◇', tags: 'diamond, outline'},
        {glyph: '■', tags: 'square, block, solid'},
        {glyph: '□', tags: 'square, outline'},
        {glyph: '●', tags: 'circle, dot, solid'},
        {glyph: '○', tags: 'circle, outline, ring'},
        {glyph: '◉', tags: 'target, focus, ring'},
        {glyph: '◎', tags: 'target, outline, ring'},
        {glyph: '▣', tags: 'square, nested, frame'},
        {glyph: '⬢', tags: 'hexagon, infra'},
        {glyph: '⬡', tags: 'hexagon, outline'},
        {glyph: '✱', tags: 'asterisk, star, sparkle'},
        {glyph: '✦', tags: 'star, sparkle, ai'},
        {glyph: '✧', tags: 'star, outline'},
        {glyph: '★', tags: 'star, favorite, rating'},
        {glyph: '☆', tags: 'star, outline'},
    ],
    Arrows: [
        {glyph: '→', tags: 'arrow, right, next'},
        {glyph: '←', tags: 'arrow, left, back'},
        {glyph: '↑', tags: 'arrow, up'},
        {glyph: '↓', tags: 'arrow, down'},
        {glyph: '↗', tags: 'arrow, up-right, external'},
        {glyph: '↘', tags: 'arrow, down-right'},
        {glyph: '⇨', tags: 'arrow, right, bold'},
        {glyph: '⇡', tags: 'arrow, up, bold'},
        {glyph: '⟶', tags: 'arrow, right, long'},
        {glyph: '↻', tags: 'reload, refresh, cycle'},
        {glyph: '⟳', tags: 'reload, refresh'},
    ],
    Status: [
        {glyph: '✓', tags: 'check, ok, done, success'},
        {glyph: '✔', tags: 'check, ok, bold'},
        {glyph: '✗', tags: 'cross, fail, no'},
        {glyph: '✘', tags: 'cross, fail, bold'},
        {glyph: '⚠', tags: 'warning, alert, caution'},
        {glyph: 'ℹ', tags: 'info, note'},
        {glyph: '?', tags: 'question, help'},
        {glyph: '!', tags: 'alert, important'},
    ],
    Tools: [
        {glyph: '⚙', tags: 'gear, settings, config'},
        {glyph: '⚒', tags: 'tools, hammer, build'},
        {glyph: '⛏', tags: 'pick, mining, build'},
        {glyph: '🔧', tags: 'wrench, tools, fix'},
        {glyph: '🛠', tags: 'tools, build, hammer'},
        {glyph: '🧱', tags: 'brick, build, stack'},
        {glyph: '⚡', tags: 'lightning, fast, power'},
        {glyph: '🔌', tags: 'plug, connect, integration'},
        {glyph: '⛓', tags: 'chain, link, blockchain'},
    ],
    Data: [
        {glyph: '☁', tags: 'cloud, aws, azure, gcp'},
        {glyph: '🗄', tags: 'database, storage'},
        {glyph: '🗂', tags: 'folder, files'},
        {glyph: '📊', tags: 'chart, analytics, bar'},
        {glyph: '📈', tags: 'chart, growth, trend'},
        {glyph: '📉', tags: 'chart, decline, trend'},
        {glyph: '🧩', tags: 'puzzle, module, plugin'},
        {glyph: '🧠', tags: 'brain, ai, ml'},
    ],
    Communication: [
        {glyph: '✉', tags: 'mail, email, contact'},
        {glyph: '☎', tags: 'phone, call'},
        {glyph: '💬', tags: 'chat, message, support'},
        {glyph: '📣', tags: 'megaphone, marketing, broadcast'},
        {glyph: '🔔', tags: 'bell, notification, alert'},
    ],
    Misc: [
        {glyph: '⛰', tags: 'mountain, peak, summit'},
        {glyph: '🌐', tags: 'globe, web, internet'},
        {glyph: '🛡', tags: 'shield, security, protect'},
        {glyph: '🔒', tags: 'lock, secure, private'},
        {glyph: '🔑', tags: 'key, auth, access'},
        {glyph: '📦', tags: 'package, ship, deliver'},
        {glyph: '🚀', tags: 'rocket, launch, ship'},
        {glyph: '⏱', tags: 'timer, performance, speed'},
        {glyph: '§', tags: 'section, paragraph'},
        {glyph: '¶', tags: 'paragraph, prose'},
    ],
};

const IconGlyphPicker: React.FC<Props> = ({value, onChange, label, placeholder, wrapperStyle, t}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        if (!query.trim()) return CATALOG;
        const q = query.trim().toLowerCase();
        const out: Record<string, GlyphEntry[]> = {};
        for (const [cat, entries] of Object.entries(CATALOG)) {
            const matches = entries.filter(e =>
                e.tags.includes(q) || e.glyph.includes(q),
            );
            if (matches.length) out[cat] = matches;
        }
        return out;
    }, [query]);

    const pick = (glyph: string) => {
        onChange(glyph);
        setOpen(false);
        setQuery('');
    };

    return (
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 6, ...wrapperStyle}}>
            <LabeledInput
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder ?? '▲ or 🧱'}
                label={label ?? t('Icon glyph')}
                wrapperStyle={{flex: 1, minWidth: 140}}
            />
            <Button onClick={() => setOpen(true)}>{t('Browse')}</Button>
            <Modal
                open={open}
                title={t('Pick an icon glyph')}
                onCancel={() => setOpen(false)}
                footer={null}
                width={'min(640px, 95vw)'}
            >
                <Input
                    autoFocus
                    allowClear
                    prefix={<SearchOutlined/>}
                    placeholder={t('Search by keyword: arrow, star, cloud, …')}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{marginBottom: 12}}
                />
                <Tabs
                    items={Object.entries(filtered).map(([cat, entries]) => ({
                        key: cat,
                        label: `${cat} (${entries.length})`,
                        children: (
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))', gap: 6}}>
                                {entries.map(e => (
                                    <button
                                        type="button"
                                        key={e.glyph}
                                        onClick={() => pick(e.glyph)}
                                        title={e.tags}
                                        style={{
                                            fontSize: 24,
                                            padding: '8px 0',
                                            background: value === e.glyph ? '#e6f4ff' : '#fff',
                                            border: `1px solid ${value === e.glyph ? '#1677ff' : '#e0e0e0'}`,
                                            borderRadius: 4,
                                            cursor: 'pointer',
                                            lineHeight: 1.2,
                                        }}
                                    >
                                        {e.glyph}
                                    </button>
                                ))}
                            </div>
                        ),
                    }))}
                />
                {Object.keys(filtered).length === 0 && (
                    <div style={{padding: 24, textAlign: 'center', color: 'rgba(0,0,0,0.45)'}}>
                        {t('No glyphs matched. The text input still accepts free-text — emoji or any Unicode character works.')}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default IconGlyphPicker;
