import React from "react";
import {Select, Input, Space} from "antd";
import {getAnchors, subscribeAnchors, IAnchorOption} from "./anchorRegistry";

interface IProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    style?: React.CSSProperties;
    /** Optional label rendered above the picker. Kept here so callers can
     *  drop the picker in without wiring an extra `<LabeledInput>`. */
    label?: string;
    /** Disable to fall back to a plain Input (e.g. inside a tight cell). */
    plainOnly?: boolean;
}

const CUSTOM_VALUE = '__custom__';

/**
 * Replacement for the bare `<Input value={href}>` that's been scattered
 * across module editors. Surfaces the live anchor registry as grouped
 * options + a "Custom URL…" entry that flips to a plain text field for
 * external links / mail to: / unusual targets.
 *
 * The emitted value is always the canonical href string the renderer
 * already understands — saved JSON shape is unchanged.
 *
 * See `docs/roadmap/link-target-autosearch.md` for the broader design.
 */
const LinkTargetPicker: React.FC<IProps> = ({value, onChange, placeholder, style, label, plainOnly}) => {
    const [, force] = React.useReducer(x => x + 1, 0);
    const [custom, setCustom] = React.useState<boolean>(() => {
        if (!value) return false;
        return !getAnchors().some(a => a.href === value);
    });

    React.useEffect(() => subscribeAnchors(force), []);

    const anchors = getAnchors();
    const matchedKnown = !!value && anchors.some(a => a.href === value);

    if (plainOnly) {
        return (
            <Input
                style={style}
                value={value ?? ''}
                placeholder={placeholder ?? 'https://… or #anchor'}
                onChange={e => onChange(e.target.value)}
            />
        );
    }

    // When the user has typed a custom URL we keep the Input visible —
    // toggling back to the dropdown happens via the "Pick from site" link.
    if (custom || (!matchedKnown && !!value)) {
        return (
            <Space.Compact style={{width: '100%', ...style}}>
                <Input
                    value={value ?? ''}
                    placeholder={placeholder ?? 'https://…'}
                    onChange={e => onChange(e.target.value)}
                />
                <a
                    style={{padding: '4px 8px', whiteSpace: 'nowrap'}}
                    onClick={(e) => {e.preventDefault(); setCustom(false); onChange('');}}
                    href="#"
                >Pick…</a>
            </Space.Compact>
        );
    }

    // Group options by their `group` property — AntD Select supports nested
    // `OptGroup` arrays via `options=[{label, options:[...]}]`.
    const groups: Record<string, IAnchorOption[]> = {};
    for (const a of anchors) {
        (groups[a.group] ??= []).push(a);
    }
    const options = Object.entries(groups).map(([g, opts]) => ({
        label: g,
        options: opts.map(o => ({label: o.label, value: o.href})),
    }));
    options.push({
        label: 'Other',
        options: [{label: 'Custom URL…', value: CUSTOM_VALUE}],
    });

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
            {label && <label style={{fontSize: 12, color: 'rgba(0,0,0,0.55)'}}>{label}</label>}
            <Select
                style={{width: '100%', ...style}}
                showSearch
                allowClear
                placeholder={placeholder ?? 'Pick a page or anchor'}
                value={value || undefined}
                options={options}
                optionFilterProp="label"
                onChange={(v) => {
                    if (v === CUSTOM_VALUE) {
                        setCustom(true);
                        onChange('');
                        return;
                    }
                    onChange(v ?? '');
                }}
            />
        </div>
    );
};

export default LinkTargetPicker;
