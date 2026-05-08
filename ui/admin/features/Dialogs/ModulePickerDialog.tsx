import React, {useEffect, useMemo, useRef} from "react";
import {Card, Col, Input, Modal, Radio, Row, Tag, Typography} from "antd";
import {TFunction} from "i18next";
import {EItemType} from "@enums/EItemType";
import {itemTypeList, ItemCategory} from "@admin/lib/itemTypes/registry";
import {useAdminMode} from "@admin/lib/adminMode";
import {useViewModel} from "@client/lib/state/observable";
import {CategoryFilter, ModulePickerDialogViewModel} from "./ModulePickerDialogViewModel";

/**
 * Modules surfaced in **simplified** mode. Hero is in despite being
 * editorially complex (per user 2026-05-03: "make the complex ones go
 * away except for hero"). The rest are the basic authoring set —
 * everything else (CV-bundle visualisations, ProjectGrid, Manifesto,
 * StatsStrip, etc.) is hidden until the operator flips to advanced.
 */
const SIMPLIFIED_MODULE_TYPES = new Set<string>([
    EItemType.Hero,
    EItemType.Text,
    EItemType.RichText,
    EItemType.Image,
    EItemType.Gallery,
    EItemType.ProjectCard,
    EItemType.BlogFeed,
    EItemType.SocialLinks,
]);
import TypeDiagram from "@admin/lib/itemTypes/TypeDiagram";

interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (type: EItemType) => void;
    t: TFunction<"translation", undefined>;
    /** Currently selected module — highlighted on open. */
    current?: EItemType;
}

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
    all: 'All',
    hero: 'Hero',
    media: 'Media',
    content: 'Content',
    cta: 'CTA',
};

const CATEGORY_TAG_COLOR: Record<ItemCategory, string> = {
    hero: 'magenta',
    media: 'blue',
    content: 'geekblue',
    cta: 'gold',
};

const ModulePickerDialog: React.FC<Props> = ({open, onClose, onSelect, t, current}) => {
    const vm = useViewModel(() => new ModulePickerDialogViewModel());
    const searchRef = useRef<any>(null);
    const gridRef = useRef<HTMLDivElement>(null);

    const {mode: adminMode} = useAdminMode();

    const all = useMemo(() => {
        const list = itemTypeList();
        if (adminMode === 'simplified') {
            return list.filter(def => SIMPLIFIED_MODULE_TYPES.has(def.key));
        }
        return list;
    }, [adminMode]);

    const filtered = useMemo(() => {
        const q = vm.query.trim().toLowerCase();
        return all.filter(def => {
            if (vm.category !== 'all' && def.category !== vm.category) return false;
            if (!q) return true;
            const label = t(def.labelKey).toLowerCase();
            const desc = t(def.descriptionKey).toLowerCase();
            return label.includes(q) || desc.includes(q) || def.key.toLowerCase().includes(q);
        });
    }, [all, vm.query, vm.category, t]);

    useEffect(() => {
        if (!open) return;
        const startIdx = current ? all.findIndex(d => d.key === current) : 0;
        vm.reset(startIdx >= 0 ? startIdx : 0);
        const id = window.setTimeout(() => searchRef.current?.focus?.(), 50);
        return () => window.clearTimeout(id);
    }, [open, current, all, vm]);

    useEffect(() => { vm.clamp(filtered.length); }, [filtered, vm]);

    const pick = (type: EItemType) => {
        onSelect(type);
        onClose();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!filtered.length) return;
        const cols = gridRef.current ? Math.max(1, Math.floor(gridRef.current.offsetWidth / 220)) : 3;
        let next = vm.focusIndex;
        if (e.key === 'ArrowRight') next = Math.min(filtered.length - 1, vm.focusIndex + 1);
        else if (e.key === 'ArrowLeft') next = Math.max(0, vm.focusIndex - 1);
        else if (e.key === 'ArrowDown') next = Math.min(filtered.length - 1, vm.focusIndex + cols);
        else if (e.key === 'ArrowUp') next = Math.max(0, vm.focusIndex - cols);
        else if (e.key === 'Enter') {
            const def = filtered[vm.focusIndex];
            if (def) pick(def.key);
            return;
        } else {
            return;
        }
        e.preventDefault();
        vm.setFocusIndex(next);
    };

    return (
        <Modal
            data-testid="section-module-picker-modal"
            open={open}
            onCancel={onClose}
            footer={null}
            width={960}
            title={t('Choose module')}
            destroyOnClose
        >
            <div onKeyDown={onKeyDown}>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16}}>
                    <Input.Search
                        data-testid="section-module-picker-search-input"
                        ref={searchRef}
                        placeholder={t('Search modules')}
                        allowClear
                        value={vm.query}
                        onChange={e => vm.setQuery(e.target.value)}
                        style={{maxWidth: 320, flex: '1 1 240px'}}
                    />
                    <Radio.Group
                        value={vm.category}
                        onChange={e => vm.setCategory(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                        options={(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(c => ({
                            label: t(CATEGORY_LABELS[c]),
                            value: c,
                        }))}
                    />
                </div>
                <div ref={gridRef}>
                    <Row gutter={[12, 12]}>
                        {filtered.map((def, i) => {
                            const isFocused = i === vm.focusIndex;
                            const isCurrent = def.key === current;
                            return (
                                <Col xs={24} sm={12} md={8} key={def.key}>
                                    <Card
                                        data-testid={`section-module-picker-${def.key.toLowerCase().replace(/_/g, '-')}`}
                                        hoverable
                                        size="small"
                                        onClick={() => pick(def.key)}
                                        onMouseEnter={() => vm.setFocusIndex(i)}
                                        style={{
                                            borderColor: isFocused
                                                ? 'var(--theme-colorPrimary, #1677ff)'
                                                : isCurrent ? 'var(--theme-colorPrimary, #1677ff)' : undefined,
                                            borderWidth: isFocused || isCurrent ? 2 : 1,
                                            height: '100%',
                                        }}
                                    >
                                        <div style={{display: 'flex', gap: 12, alignItems: 'flex-start'}}>
                                            <TypeDiagram type={def.key}/>
                                            <div style={{flex: 1, minWidth: 0}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between'}}>
                                                    <Typography.Text strong>{t(def.labelKey)}</Typography.Text>
                                                    <Tag color={CATEGORY_TAG_COLOR[def.category]} style={{margin: 0}}>
                                                        {t(CATEGORY_LABELS[def.category])}
                                                    </Tag>
                                                </div>
                                                <Typography.Text type="secondary" style={{fontSize: 12}}>
                                                    {t(def.descriptionKey)}
                                                </Typography.Text>
                                            </div>
                                        </div>
                                    </Card>
                                </Col>
                            );
                        })}
                        {!filtered.length && (
                            <Col span={24}>
                                <Typography.Text type="secondary">{t('No modules match your search.')}</Typography.Text>
                            </Col>
                        )}
                    </Row>
                </div>
            </div>
        </Modal>
    );
};

export default ModulePickerDialog;
