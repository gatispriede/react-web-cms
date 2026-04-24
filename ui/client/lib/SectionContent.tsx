import EditWrapper from "@client/lib/EditWrapper";
import React from "react";
import {Button, Tooltip, message} from "antd";
import {ColumnWidthOutlined, MergeCellsOutlined, SplitCellsOutlined} from "@client/lib/icons";
import {ISection} from "@interfaces/ISection";
import {EItemType} from "@enums/EItemType";
import ContentType from "@client/lib/ContentType";
import AddNewSectionItem from "@admin/features/Dialogs/AddNewSectionItem";
import {IConfigSectionAddRemove} from "@interfaces/IConfigSectionAddRemove";
import ActionDialog from "@admin/features/Dialogs/ActionDialog";
import {EStyle} from "@enums/EStyle";
import {IItem} from "@interfaces/IItem";
import {TFunction} from "i18next";
import {refreshBus} from "@client/lib/refreshBus";
import MongoApi from "@services/api/client/MongoApi";
import {undoStack} from "@client/lib/undoStack";
import {setupAnimations} from "@client/lib/animateOnScroll";

interface IPropsSectionContent {
    section: ISection,
    addRemoveSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => Promise<void>,
    refresh: () => Promise<void>,
    admin: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

interface IStateSectionContent {
    section: ISection;
    actionDialogOpen: boolean;
    refresh: () => Promise<void>;
}

/**
 * Normalise a section's slot layout. An explicit `slots` array (sum of spans
 * per column) is returned as-is after length + sum checks; otherwise we fall
 * back to `[1, 1, …]` of length `section.type` (classic even layout).
 */
function resolveSlots(section: ISection): number[] {
    const fallback = Array(Math.max(1, section.type)).fill(1);
    const raw = section.slots;
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    if (raw.some(s => typeof s !== 'number' || s < 1)) return fallback;
    const sum = raw.reduce((a, b) => a + b, 0);
    if (sum !== section.type) return fallback;
    return [...raw];
}

class SectionContent extends React.Component<IPropsSectionContent> {
    state: IStateSectionContent = {
        actionDialogOpen: false,
        section: {
            content: [],
            type: 0,
            id: ''
        },

        refresh: async () => {
        }
    }
    admin: boolean = false;
    addRemoveSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => Promise<void>
    private refreshUnsub?: () => void;
    private mongoApi = new MongoApi();

    constructor(props: IPropsSectionContent) {
        super(props);
        this.state.section = props.section
        this.addRemoveSectionItem = props.addRemoveSectionItem;
        this.admin = props.admin;
    }

    componentDidMount() {
        this.refreshUnsub = refreshBus.subscribe(() => this.refreshView(), 'content');
        if (!this.admin) setupAnimations();
    }

    componentWillUnmount() {
        this.refreshUnsub?.();
    }

    /** Ask the parent (DynamicTabsContent) to re-fetch — the section list
     *  lives there, so mutations surface to this view through props. */
    refreshView = async (): Promise<void> => {
        await this.props.refresh();
    }

    componentDidUpdate(prevProps: IPropsSectionContent) {
        if (prevProps.section !== this.props.section) {
            this.setState({section: this.props.section});
        }
        if (!this.admin) setupAnimations();
    }

    /**
     * Persist a new slots layout for this section. `newSlots` must sum to
     * `section.type` and match `newContent.length`. Used by merge / split
     * buttons below.
     */
    private async saveSlots(newSlots: number[], newContent: IItem[]): Promise<void> {
        const section = this.state.section;
        if (!section.id) return;
        const before = {slots: section.slots ? [...section.slots] : undefined, content: [...section.content]};
        // Optimistic update — the grid flips immediately, the server catches
        // up via the mutation below and the refreshBus emit inside SectionApi.
        this.setState({section: {...section, slots: newSlots, content: newContent}});
        try {
            await this.mongoApi.addSectionToPage(
                {section: {...section, slots: newSlots, content: newContent} as any},
                [{...section, slots: newSlots, content: newContent}] as any,
            );
        } catch (err) {
            console.error('saveSlots failed, rolling back:', err);
            this.setState({section: {...section, slots: before.slots, content: before.content}});
            message.error(this.props.t('Column merge failed — reverted.'));
            return;
        }
        undoStack.push({
            label: this.props.t('Merged columns'),
            undo: async () => {
                await this.mongoApi.addSectionToPage(
                    {section: {...section, slots: before.slots, content: before.content} as any},
                    [{...section, slots: before.slots, content: before.content}] as any,
                );
                await this.refreshView();
            },
            redo: async () => {
                await this.mongoApi.addSectionToPage(
                    {section: {...section, slots: newSlots, content: newContent} as any},
                    [{...section, slots: newSlots, content: newContent}] as any,
                );
                await this.refreshView();
            },
        });
    }

    /**
     * Merge slot `index` with slot `index + 1`. The left item's content is
     * preserved and its span doubles; the right item is dropped.
     */
    mergeWithNext = async (index: number): Promise<void> => {
        const section = this.state.section;
        const slots = resolveSlots(section);
        if (index < 0 || index >= slots.length - 1) return;
        const newSlots = [
            ...slots.slice(0, index),
            slots[index] + slots[index + 1],
            ...slots.slice(index + 2),
        ];
        const newContent = [
            ...section.content.slice(0, index),
            section.content[index],
            ...section.content.slice(index + 2),
        ];
        await this.saveSlots(newSlots, newContent);
    }

    /** Undo a merge — split the slot back into single-unit columns, padding
     *  the freed slots with Empty items. */
    splitSlot = async (index: number): Promise<void> => {
        const section = this.state.section;
        const slots = resolveSlots(section);
        if (index < 0 || index >= slots.length) return;
        const span = slots[index];
        if (span <= 1) return;
        const emptyItem = {type: EItemType.Empty, style: EStyle.Default, content: '{}'} as unknown as IItem;
        const newSlots = [
            ...slots.slice(0, index),
            ...Array(span).fill(1),
            ...slots.slice(index + 1),
        ];
        const newContent = [
            ...section.content.slice(0, index),
            section.content[index],
            ...Array(span - 1).fill(emptyItem),
            ...section.content.slice(index + 1),
        ];
        await this.saveSlots(newSlots, newContent);
    }

    render() {
        const section = this.state.section;
        const slots = resolveSlots(section);
        const totalUnits = slots.reduce((a, b) => a + b, 0);
        // Column count travels through a CSS var so the SCSS mobile rules in
        // `.section` (global.scss) can collapse multi-column layouts to 1fr
        // on narrow viewports — an inline `grid-template-columns` would
        // out-specify any media query short of `!important`. Desktop still
        // uses `repeat(var(--section-cols, …), 1fr)`.
        const gridStyle: React.CSSProperties = {
            display: 'grid',
            gridTemplateColumns: `repeat(var(--section-cols, ${totalUnits}), 1fr)`,
            gap: 16,
            ['--section-cols' as any]: totalUnits,
        };
        return (
            <div className={`section${section.transparent ? ' is-transparent' : ''}`} style={gridStyle}>
                {
                    section.content.map((item: IItem, id: number) => {
                        const span = slots[id] ?? 1;
                        const style: React.CSSProperties = {
                            height: '100%',
                            // `gridColumn` intentionally omits a var so items with
                            // `span 2` / `span 3` still claim the right number of
                            // columns at desktop. The mobile SCSS rule below
                            // overrides `grid-column` + flips the layout to a
                            // single-column stack.
                            gridColumn: `span ${span}`,
                            position: 'relative',
                        };
                        const sectionId = section.id ? section.id : '';
                        const isLast = id === slots.length - 1;
                        const styleClass = item.style ? `style-${String(item.style).replace(/\s+/g, '-')}` : '';
                        const animAttr = !this.admin && item.animation && item.animation !== 'none'
                            ? item.animation
                            : undefined;
                        const animStyle: React.CSSProperties = animAttr
                            ? {...style, '--anim-delay': `${id * 110}ms`} as React.CSSProperties
                            : style;
                        return (
                            <div key={id}
                                 className={`section-item-container ${item.type} span-${span} ${styleClass}`}
                                 style={animStyle}
                                 {...(animAttr ? {'data-anim': animAttr} : {})}>
                                <EditWrapper
                                    t={this.props.t}
                                    admin={this.admin}
                                    key={id}
                                    del={item.type !== EItemType.Empty}
                                    edit={item.type !== EItemType.Empty}
                                    editContent={
                                        item.type !== EItemType.Empty ? <AddNewSectionItem
                                                t={this.props.t}
                                                tApp={this.props.tApp}
                                                index={id}
                                                addSectionItem={this.props.addRemoveSectionItem}
                                                section={this.state.section}
                                                loadItem={true}
                                            /> :
                                            <></>
                                    }
                                    deleteAction={async () => {
                                        await this.addRemoveSectionItem(sectionId, {
                                            index: id,
                                            style: EStyle.Default,
                                            type: EItemType.Empty,
                                            content: "",
                                        })
                                    }}
                                >
                                    <div
                                        className={`content-wrapper ${item.action === "onClick" ? 'action-enabled' : ''}`}
                                        onClick={(event) => {
                                            if (item.action === 'onClick' && !this.state.actionDialogOpen) {
                                                this.setState({actionDialogOpen: true})
                                            }
                                        }}>
                                        <ContentType
                                            t={this.props.t}
                                            tApp={this.props.tApp}
                                            admin={this.admin}
                                            item={item}
                                            addButton={
                                                <AddNewSectionItem
                                                    t={this.props.t}
                                                    tApp={this.props.tApp}
                                                    index={id}
                                                    addSectionItem={this.addRemoveSectionItem}
                                                    section={this.state.section}
                                                    loadItem={false}
                                                />
                                            }
                                        />
                                        {item.action && item.action !== 'none' &&
                                            <ActionDialog t={this.props.t} tApp={this.props.tApp} item={item}
                                                          open={this.state.actionDialogOpen} close={() => {
                                                this.setState({actionDialogOpen: false})
                                            }}/>
                                        }
                                    </div>
                                </EditWrapper>
                                {/* Admin-only merge / split chips. Merge sits on the right edge of
                                    every slot except the last; split sits on the left edge of every
                                    merged (span > 1) slot. */}
                                {this.admin && !isLast && (
                                    <Tooltip title={this.props.t('Merge with next column')}>
                                        <Button
                                            className="slot-merge-btn"
                                            size="small"
                                            shape="circle"
                                            icon={<MergeCellsOutlined/>}
                                            onClick={(e) => { e.stopPropagation(); void this.mergeWithNext(id); }}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                right: -14,
                                                transform: 'translateY(-50%)',
                                                zIndex: 3,
                                                opacity: 0,
                                                transition: 'opacity 160ms ease',
                                            }}
                                            aria-label={this.props.t('Merge with next column')}
                                        />
                                    </Tooltip>
                                )}
                                {this.admin && span > 1 && (
                                    <Tooltip title={this.props.t('Split merged columns')}>
                                        <Button
                                            className="slot-split-btn"
                                            size="small"
                                            shape="circle"
                                            icon={<SplitCellsOutlined/>}
                                            onClick={(e) => { e.stopPropagation(); void this.splitSlot(id); }}
                                            style={{
                                                position: 'absolute',
                                                top: 6,
                                                right: 6,
                                                zIndex: 3,
                                                opacity: 0,
                                                transition: 'opacity 160ms ease',
                                            }}
                                            aria-label={this.props.t('Split merged columns')}
                                        />
                                    </Tooltip>
                                )}
                                {this.admin && span > 1 && (
                                    <div
                                        className="slot-span-badge"
                                        aria-hidden
                                        style={{
                                            position: 'absolute',
                                            top: 6,
                                            left: 6,
                                            zIndex: 3,
                                            padding: '2px 6px',
                                            background: 'rgba(0,0,0,0.7)',
                                            color: '#fff',
                                            fontSize: 10,
                                            fontFamily: 'monospace',
                                            letterSpacing: 0.5,
                                            pointerEvents: 'none',
                                            opacity: 0,
                                            transition: 'opacity 160ms ease',
                                        }}
                                    >
                                        <ColumnWidthOutlined style={{marginRight: 4}}/>
                                        {span}/{totalUnits}
                                    </div>
                                )}
                            </div>
                        )
                    })
                }
            </div>
        )
    }
}

export default SectionContent
