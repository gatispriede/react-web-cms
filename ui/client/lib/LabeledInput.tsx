/**
 * `<LabeledInput label="..." {...inputProps}/>` — drop-in replacement for
 * `<Input addonBefore="..." />` that renders the same visual as antd v5's
 * `addonBefore` (a grey-tinted, bordered label butted against the input)
 * without using the now-deprecated `Input.addonBefore` prop.
 *
 * antd v6 deprecated `addonBefore` in favour of composing `Space.Compact`
 * around an inert label + the real input. Doing that inline at every
 * call-site (~20 in the admin editors) bloats the JSX; the helper
 * captures the pattern once.
 *
 * Implementation note: we render the label as a non-interactive `<span>`
 * styled to match antd's addon class so the look matches the rest of the
 * UI even when surrounded by un-migrated code that still uses
 * `addonBefore`. The styling uses CSS variables exposed by antd's theme,
 * so it follows light/dark mode automatically.
 */
import React, {CSSProperties} from 'react';
import {Input, Space} from 'antd';
import type {InputProps} from 'antd';

interface LabeledInputProps extends Omit<InputProps, 'addonBefore' | 'addonAfter'> {
    label: React.ReactNode;
    /** Optional extra style on the surrounding Space.Compact wrapper. */
    wrapperStyle?: CSSProperties;
    /** Optional extra style on the label addon span. */
    labelStyle?: CSSProperties;
}

const ADDON_STYLE: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 11px',
    background: 'rgba(0, 0, 0, 0.02)',
    border: '1px solid var(--ant-color-border, #d9d9d9)',
    borderRight: 'none',
    borderRadius: 'var(--ant-border-radius, 6px) 0 0 var(--ant-border-radius, 6px)',
    color: 'var(--ant-color-text, rgba(0, 0, 0, 0.88))',
    fontSize: 'var(--ant-font-size, 14px)',
    lineHeight: 1.5715,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
};

const COMPACT_STYLE: CSSProperties = {
    width: '100%',
    display: 'inline-flex',
};

const INNER_INPUT_STYLE: CSSProperties = {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    flex: '1 1 auto',
    minWidth: 0,
};

export const LabeledInput: React.FC<LabeledInputProps> = ({
    label,
    wrapperStyle,
    labelStyle,
    style,
    ...inputProps
}) => (
    <Space.Compact style={{...COMPACT_STYLE, ...wrapperStyle}}>
        <span style={{...ADDON_STYLE, ...labelStyle}}>{label}</span>
        <Input {...inputProps} style={{...INNER_INPUT_STYLE, ...style}}/>
    </Space.Compact>
);
