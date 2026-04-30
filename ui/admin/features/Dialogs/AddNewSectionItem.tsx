import {Button, Drawer, Select, Slider, Space, Switch, Tabs, Tooltip} from "antd";
import {EditOutlined, PlusCircleOutlined} from "@client/lib/icons";
import React from "react";
import {ISection} from "@interfaces/ISection";
import {ContentSection} from "@client/lib/ContentSection";
import ContentType from "@client/lib/ContentType";
import ActionDialog from "./ActionDialog";
import {EItemType} from "@enums/EItemType";
import {IConfigSectionAddRemove} from "@interfaces/IConfigSectionAddRemove";
import {IItem} from "@interfaces/IItem";
import {EStyle} from "@enums/EStyle";
import {EAnimation} from "@enums/EAnimation";
import {TFunction} from "i18next";
import {getItemTypeDefinition, itemTypeList, styleEnumFor} from "@admin/lib/itemTypes/registry";
import TypeDiagram from "@admin/lib/itemTypes/TypeDiagram";
import ModulePickerDialog from "@admin/features/Dialogs/ModulePickerDialog";

interface IAddNewSectionItemProps {
    addSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => void,
    /** Optional section-level update — wired from SectionContent to persist
     *  transparency changes made inside the per-module Style tab. When absent
     *  (very-early render paths, tests) the controls stay uncontrolled. */
    updateSection?: (patch: Partial<ISection>) => void | Promise<void>,
    section: ISection,
    item?: IItem,
    index: number,
    loadItem: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

class AddNewSectionItem extends React.Component <IAddNewSectionItemProps> {
    /**
     * Transient UI scratch-space pattern.
     *
     * Fields prefixed with `_` are *instance-local* and intentionally bypass
     * React's setState → re-render pipeline. They:
     *   1. Survive parent re-renders (React state can be stomped when the
     *      component unmounts/remounts via ancestor churn; instance fields
     *      live on the fiber's `stateNode` and persist until unmount).
     *   2. Don't batch or defer — a mutation is visible to the next render
     *      immediately, paired with an explicit `forceUpdate()`.
     *   3. Act as a local override while a server round-trip is in flight,
     *      so the Switch/Slider don't "uncheck after checking" if the
     *      incoming prop lags the optimistic write.
     *
     * Clear the override in `componentDidUpdate` once `this.props.section`
     * catches up to the committed value — from there on, the prop is the
     * source of truth again.
     */
    private _transparencyDraft: number | null = null;
    private _transparencyOverride: {transparent: boolean; pct: number} | null = null;

    componentDidUpdate(prevProps: IAddNewSectionItemProps) {
        // Drop the override the moment props catch up to the last committed
        // transparency value — keeps the UI in sync with the server
        // afterwards without losing the optimistic paint.
        const o = this._transparencyOverride;
        if (o) {
            const s = this.props.section;
            const propPct = typeof s?.transparentOpacity === 'number'
                ? s.transparentOpacity
                : (s?.transparent ? 100 : 0);
            if (!!s?.transparent === o.transparent && propPct === o.pct) {
                this._transparencyOverride = null;
            }
        }
        // Discard stale drafts if the section identity changed underneath us.
        if (prevProps.section?.id !== this.props.section?.id) {
            this._transparencyDraft = null;
            this._transparencyOverride = null;
        }
    }

    /** Resolve the currently-displayed transparency — override first, then
     *  props. Called from render + preview panel so both stay in lock-step. */
    private _readTransparency(): {transparent: boolean; pct: number} {
        if (this._transparencyOverride) return this._transparencyOverride;
        const s = this.props.section;
        const pct = typeof s?.transparentOpacity === 'number'
            ? s.transparentOpacity
            : (s?.transparent ? 100 : 0);
        return {transparent: !!s?.transparent, pct};
    }

    /** Commit a transparency change: stash an optimistic override, paint
     *  immediately, then fire the server round-trip. Errors roll the
     *  override back so the Switch/Slider revert visually. */
    private _commitTransparency = (transparent: boolean, pct: number): void => {
        this._transparencyOverride = {transparent, pct};
        this.forceUpdate();
        if (!this.props.updateSection) return;
        Promise.resolve(this.props.updateSection({
            transparent,
            transparentOpacity: pct,
        })).catch(() => {
            this._transparencyOverride = null;
            this.forceUpdate();
        });
    };
    state = {
        dialogOpen: false,
        pickerTarget: null as null | 'content' | 'action',
        actionPreviewOpen: false,
        selected: EItemType.Text,
        action: 'none',
        content: '{}',
        actionType: EItemType.Text,
        actionStyle: 'default',
        actionStyleOptions: [
            {
                label: "Default",
                value: EStyle.Default,
            }
        ],
        actionContent: '{}',
        style: 'Default',
        styleOptions: [
            {
                label: this.props.t("Default"),
                value: EStyle.Default,
            }
        ],
        animation: EAnimation.None,
        animationOptions: Object.entries(EAnimation).map(([key, value]) => ({
            label: key,
            value,
        })),
        actionSelectOptions: [
            {
                label: this.props.t("No action"),
                value: "none",
            },
            {
                label: this.props.t("On click"),
                value: "onClick",
            },
        ],
        tabContent: [
            {
                key: 'content',
                label: this.props.t('Content'),
                children: <></>
            },
            {
                key: 'action',
                label: this.props.t('Action'),
                children: <></>
            },
            {
                key: 'style',
                label: this.props.t('Style'),
                children: <></>
            }
        ],
        selectOptions: itemTypeList().map(def => ({
            label: this.props.t(def.labelKey),
            value: def.key,
        })),
    }
    section: ISection
    index: number

    constructor(props: IAddNewSectionItemProps) {
        super(props);
        this.section = props.section;
        this.index = props.index;
        if (props.loadItem) {
            const item: IItem = this.section.content[props.index];
            this.state = {
                ...this.state,
                selected: item.type,
                content: item.content,
                style: item.style ? item.style : 'default',
                animation: (item.animation as EAnimation) || EAnimation.None,
                action: item.action || 'none',
                actionType: item.actionType || EItemType.Text,
                actionStyle: item.actionStyle || 'default',
                actionContent: item.actionContent || '{}',
            };
        }
    }

    setActiveOptionState(selectedModule: EItemType, style?: string, resetContent = false) {
        const styleEnum = styleEnumFor(selectedModule);
        const patch: any = {
            style: style ? style : (styleEnum.Default ?? EStyle.Default),
            styleOptions: Object.keys(styleEnum).map((key: string) => ({
                label: key,
                value: styleEnum[key],
            })),
            selected: selectedModule
        };
        if (resetContent) {
            const def = getItemTypeDefinition(selectedModule);
            patch.content = def?.defaultContent ?? '{}';
        }
        this.setState(patch);
    }

    generateContentSection() {
        const currentDef = getItemTypeDefinition(this.state.selected);
        return <div>
            <h4>{this.props.t("Content configuration")}</h4>
            <label>{this.props.t("Please select content type")}: </label>
            <Button
                data-testid="section-module-type-picker-btn"
                onClick={() => this.setState({pickerTarget: 'content'})}
                style={{display: 'inline-flex', alignItems: 'center', gap: 8, height: 'auto', padding: '6px 12px'}}
            >
                <TypeDiagram type={this.state.selected}/>
                <span>{currentDef ? this.props.t(currentDef.labelKey) : this.state.selected}</span>
            </Button>
            <hr/>
            <ContentSection t={this.props.t} content={this.state.content} selected={this.state.selected}
                            setContent={(value: string) => {
                                this.setState({content: value})
                            }}/>
        </div>
    }

    generateActionSection() {
        return <div>
            <h4>{this.props.t("Action configuration")}</h4>
            <label>{this.props.t("Please select action type")}: </label>
            <Select variant={'filled'} value={this.state.action} options={this.state.actionSelectOptions}
                    onChange={(value) => {
                        const styleEnum = styleEnumFor(this.state.actionType);
                        const actionStyleOptions = Object.entries(styleEnum)
                            .map(([_, v]) => ({ label: v as string, value: v as string }));
                        this.setState({
                            action: value, actionStyleOptions
                        })
                    }}/>
            {this.state.action !== 'none' &&
                <div>
                    <h4>{this.props.t("Content configuration")}</h4>
                    <label>{this.props.t("Please select content type")}: </label>
                    {(() => {
                        const currentActionDef = getItemTypeDefinition(this.state.actionType);
                        return (
                            <Button
                                onClick={() => this.setState({pickerTarget: 'action'})}
                                style={{display: 'inline-flex', alignItems: 'center', gap: 8, height: 'auto', padding: '6px 12px'}}
                            >
                                <TypeDiagram type={this.state.actionType}/>
                                <span>{currentActionDef ? this.props.t(currentActionDef.labelKey) : this.state.actionType}</span>
                            </Button>
                        );
                    })()}
                    <hr/>
                    <ContentSection t={this.props.t} content={this.state.actionContent} selected={this.state.actionType}
                                    setContent={(value: string) => {
                                        this.setState({actionContent: value})
                                    }}
                    />
                </div>
            }
        </div>
    }

    generateStyleSection() {
        // Section transparency (moved here from the inline admin strip per
        // user feedback — "3rd tab where style is"). The Switch gates the
        // Slider; at 0 the section is opaque, at 100 it's fully invisible.
        // Default on first enable is 50 — a balanced "ghost" look.
        //
        // Source of truth: `_readTransparency()` — prefers the in-flight
        // optimistic override, falls back to props. While dragging, the
        // `_transparencyDraft` field wins so the thumb tracks live without
        // touching React state (which would re-render ancestors and risk
        // unmounting this Drawer).
        const {transparent: committedTransparent, pct: committedPct} = this._readTransparency();
        const transparencyPct = this._transparencyDraft ?? committedPct;
        const transparencyEnabled = committedTransparent || transparencyPct > 0;

        return <div>
            <h4>{this.props.t("Style configuration")}</h4>
            <label>{this.props.t("Please select style type")}: </label>
            <Select variant={'filled'} value={this.state.style} options={this.state.styleOptions}
                    onSelect={(e) => {
                        this.setState({style: e})
                    }}/>
            <hr/>
            <label>{this.props.t("Animation")}: </label>
            <Select
                variant={'filled'}
                value={this.state.animation}
                options={this.state.animationOptions}
                onSelect={(e: EAnimation) => this.setState({animation: e})}
            />
            {
                this.state.action &&
                <div>
                    <hr/>
                    <label>{this.props.t("Please select style for action component")}: </label>
                    <Select variant={'filled'} value={this.state.actionStyle} options={this.state.actionStyleOptions}
                            onSelect={(e) => {
                                this.setState({actionStyle: e})
                            }}/>
                </div>
            }
            {this.props.updateSection && (
                <div style={{marginTop: 16, padding: 12, borderRadius: 6, background: 'rgba(0,0,0,0.03)'}}>
                    <h4 style={{marginTop: 0}}>{this.props.t('Section transparency')}</h4>
                    <Space align="center" wrap style={{marginBottom: 12}}>
                        <Tooltip title={this.props.t("Lets whatever sits behind the section (hero image, theme body, overlay host) show through.")}>
                            <span>{this.props.t('Transparent')}</span>
                        </Tooltip>
                        <Switch
                            size="small"
                            checked={transparencyEnabled}
                            onChange={(checked) => {
                                if (checked) {
                                    // Enable with a sensible default (50%) when switching on
                                    // from a fully-opaque state. Optimistic commit via
                                    // `_commitTransparency` paints the checked state
                                    // immediately and keeps it checked while the server
                                    // round-trip is in flight.
                                    const nextPct = transparencyPct > 0 ? transparencyPct : 50;
                                    this._commitTransparency(true, nextPct);
                                } else {
                                    this._commitTransparency(false, 0);
                                }
                            }}
                        />
                    </Space>
                    <div style={{opacity: transparencyEnabled ? 1 : 0.4, pointerEvents: transparencyEnabled ? 'auto' : 'none'}}>
                        <label style={{display: 'block', marginBottom: 4, fontSize: 12, opacity: 0.75}}>
                            {this.props.t('Transparency level — 0% opaque, 100% fully invisible')}
                        </label>
                        <Slider
                            min={0}
                            max={100}
                            step={5}
                            value={transparencyPct}
                            tooltip={{formatter: (v) => `${v}%`}}
                            // onChange fires every thumb step — stash locally
                            // so the UI tracks the drag without round-tripping
                            // the server + re-rendering the whole section
                            // tree (which would unmount this Drawer).
                            onChange={(value: number) => {
                                // Instance-field draft — see class-level comment on
                                // `_transparencyDraft`. `forceUpdate` paints the new
                                // thumb position + preview opacity without going
                                // through React state (keeps the Drawer mounted).
                                this._transparencyDraft = value;
                                this.forceUpdate();
                            }}
                            // onChangeComplete fires once on release — safe
                            // place to persist + push an undo entry.
                            onChangeComplete={(value: number) => {
                                this._transparencyDraft = null;
                                this._commitTransparency(value > 0, value);
                            }}
                            marks={{0: '0%', 50: '50%', 100: '100%'}}
                        />
                    </div>
                </div>
            )}
        </div>
    }

    addSectionItem = async () => {
        this.props.addSectionItem(
            this.section.id ? this.section.id : '', {
                index: this.index,
                style: this.state.style,
                type: this.state.selected,
                content: this.state.content,
                action: this.state.action,
                actionStyle: this.state.actionStyle,
                actionType: this.state.actionType,
                actionContent: this.state.actionContent,
                animation: this.state.animation,
            }
        )

    }
    activeOption = () => {
        return this.state.selectOptions.find(item => item.value === this.state.selected)
    }

    render() {
        const tabContent = this.state.tabContent
        tabContent[0].children = this.generateContentSection()
        tabContent[1].children = this.generateActionSection()
        tabContent[2].children = this.generateStyleSection()
        const item = {
            index: this.index,
            style: this.state.style,
            type: this.state.selected,
            content: this.state.content,
            action: this.state.action,
            actionStyle: this.state.actionStyle,
            actionType: this.state.actionType,
            actionContent: this.state.actionContent,
        }
        return (
            <>
                {
                    <div className={'add-new-section-container'}>
                        {/* DECISION: same Button serves both "add" and "edit" flows;
                            tag with the type-specific edit testid only when loading
                            an existing item, otherwise the generic add-module testid. */}
                        <Button
                            data-testid={this.props.loadItem
                                ? `section-module-edit-${String(this.state.selected).toLowerCase().replace(/_/g, '-')}-btn`
                                : 'section-add-module-btn'}
                            type="primary" onClick={() => {
                            this.setState({dialogOpen: true})

                            const activeOption = this.activeOption()
                            if (typeof activeOption !== 'undefined')
                                this.setActiveOptionState(activeOption.value as EItemType, this.state.style)
                            const styleEnum = styleEnumFor(this.state.actionType);
                            this.setState({
                                actionStyleOptions: Object.keys(styleEnum).map(key => ({
                                    label: key,
                                    value: styleEnum[key],
                                }))
                            })
                        }}>

                            {!this.props.loadItem ? <div><PlusCircleOutlined/> {this.props.t("Add content")}</div> :
                                <EditOutlined/>}
                        </Button>
                    </div>
                }
                <Drawer
                    width={'90%'}
                    open={this.state.dialogOpen}
                    title={this.props.loadItem ? this.props.t('Edit content') : this.props.t('Add content')}
                    onClose={() => this.setState({dialogOpen: false})}
                    destroyOnClose
                    extra={
                        <Space>
                            <Button onClick={() => this.setState({dialogOpen: false})}>
                                {this.props.t('Cancel')}
                            </Button>
                            <Button
                                data-testid="module-editor-save-btn"
                                type="primary"
                                onClick={async () => {
                                    await this.addSectionItem();
                                    this.setState({dialogOpen: false});
                                }}
                            >
                                {this.props.t('Save')}
                            </Button>
                        </Space>
                    }
                >
                    <div style={{display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(320px, 1fr)', gap: 24, alignItems: 'start'}}>
                        <div>
                            <Tabs tabPosition={'left'} defaultActiveKey="1" items={tabContent}/>
                        </div>
                        <div
                            style={{
                                position: 'sticky',
                                top: 0,
                                borderLeft: '1px solid rgba(0,0,0,0.06)',
                                paddingLeft: 16,
                            }}
                        >
                            <div style={{fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', fontSize: 12, opacity: 0.65}}>
                                {this.props.t('Live preview')}
                            </div>
                            {/*
                              Key the preview tree by every field that drives how the item
                              renders. When `style` flips, ContentType/Display would otherwise
                              diff onto the same instance and could hold stale className /
                              children — remounting sidesteps that reliably across every
                              module type. Cheap (preview only, no network).
                            */}
                            <div
                                key={`preview-${this.state.selected}-${this.state.style}-${this.state.action}-${this.state.actionStyle}`}
                                className={`content-wrapper ${item.action === 'onClick' ? 'action-enabled' : ''}`}
                                style={(() => {
                                    // Prefer the drag-draft, then the optimistic
                                    // override, then the committed prop — so the
                                    // preview dims live while the slider thumb
                                    // moves and stays dim while the server
                                    // commit is in flight.
                                    const raw = this._transparencyDraft ?? this._readTransparency().pct;
                                    const pct = Math.max(0, Math.min(100, raw));
                                    return pct > 0 ? {opacity: 1 - pct / 100} : undefined;
                                })()}
                                onClick={() => {
                                    if (item.action === 'onClick' && !this.state.actionPreviewOpen) {
                                        this.setState({actionPreviewOpen: true});
                                    }
                                }}
                            >
                                <ContentType t={this.props.t} tApp={this.props.tApp} admin={false} item={item} addButton={''}/>
                                <ActionDialog
                                    t={this.props.t}
                                    tApp={this.props.tApp}
                                    item={item}
                                    open={this.state.actionPreviewOpen}
                                    close={() => this.setState({actionPreviewOpen: false})}
                                />
                            </div>
                        </div>
                    </div>
                </Drawer>
                <ModulePickerDialog
                    open={this.state.pickerTarget !== null}
                    onClose={() => this.setState({pickerTarget: null})}
                    t={this.props.t}
                    current={this.state.pickerTarget === 'action' ? this.state.actionType : this.state.selected}
                    onSelect={(type) => {
                        if (this.state.pickerTarget === 'action') {
                            if (type !== this.state.actionType) {
                                const def = getItemTypeDefinition(type);
                                const styleEnum = styleEnumFor(type);
                                this.setState({
                                    actionType: type,
                                    actionContent: def?.defaultContent ?? '{}',
                                    actionStyle: styleEnum.Default ?? EStyle.Default,
                                    actionStyleOptions: Object.entries(styleEnum).map(([_, v]) => ({
                                        label: v as string,
                                        value: v as string,
                                    })),
                                });
                            }
                        } else {
                            this.setActiveOptionState(type, undefined, type !== this.state.selected);
                        }
                    }}
                />
            </>
        )
    }
}

export default AddNewSectionItem

