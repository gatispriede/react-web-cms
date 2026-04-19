import React from "react";
import {Button, Empty, Segmented, Space, Tooltip, message} from "antd";
import EditWrapper from "./common/EditWrapper";
import ConflictDialog from "./common/ConflictDialog";
import {ConflictError, isConflictError} from "../lib/conflict";
import {SECTION_TEMPLATES} from "./itemTypes/templates";
import SectionErrorBoundary from "./common/SectionErrorBoundary";
import AddNewSection from "./common/Dialogs/AddNewSection";
import SectionContent from "./SectionContent";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import MongoApi from "../api/MongoApi";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import guid from "../../helpers/guid";
import DraggableWrapper from "./common/DraggableWrapper";
import AuditBadge from "./Admin/AuditBadge";
import {TFunction} from "i18next";
import {InSection} from "../../Interfaces/IMongo";
import {EItemType} from "../../enums/EItemType";
import {EStyle} from "../../enums/EStyle";
import {undoStack} from "../lib/undoStack";
import {refreshBus} from "../lib/refreshBus";

interface IDynamicTabsContent {
    sections: ISection[],
    page: string,
    admin: boolean,
    refresh: () => Promise<void>,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

interface SContent {
    sections: ISection[],
    page: string,
    state: string,
    /** Pending optimistic-concurrency conflict — populated by editor saves
     *  that throw `ConflictError`. The `<ConflictDialog>` modal reads this
     *  + offers Take-theirs / Keep-mine resolution. `retry()` re-issues the
     *  same edit with `expectedVersion = err.currentVersion` so the second
     *  attempt clears the version check. */
    conflict?: {error: ConflictError<any>; sectionId: string; retry: () => Promise<void>},
}

class DynamicTabsContent extends React.Component<IDynamicTabsContent> {
    public refresh: () => Promise<void>;
    state: SContent = {
        sections: [],
        page: '',
        state: ''
    }
    private readonly admin: boolean = false
    private MongoApi = new MongoApi()

    getChangedPos = async (currentPos: number, newPos: number) => {
        if (currentPos === newPos) return;
        // Move semantics — take the dragged item out and re-insert at the
        // target index, shifting the rest. Previous swap-in-place left two
        // items swapped instead of one moved.
        const sections = [...this.state.sections];
        const [moved] = sections.splice(currentPos, 1);
        if (!moved) return;
        sections.splice(newPos, 0, moved);
        this.setState({sections});
        const ids = sections.map(s => s.id).filter((id): id is string => typeof id === 'string');
        if (ids.length === 0) return;
        try {
            await this.MongoApi.updateNavigation(this.state.page, ids);
            await this.refresh();
        } catch (err) {
            console.error('reorder failed', err);
        }
    };

    private refreshUnsub?: () => void;

    constructor(props: IDynamicTabsContent) {
        super(props)
        const {sections, page, refresh, admin} = props
        this.refresh = refresh
        this.admin = admin
        this.state = {
            sections: sections,
            page: page,
            state: guid()
        }
    }

    componentDidMount() {
        this.refreshUnsub = refreshBus.subscribe(() => this.refreshView(), 'content');
    }

    componentWillUnmount() {
        this.refreshUnsub?.();
    }

    /**
     * Sync the latest sections from props whenever the parent re-fetches
     * (refreshBus emit → AdminApp.initialize → fresh sections prop).
     * Without this, the class keeps rendering its constructor-time
     * `state.sections` and the merge / reorder round-trip looks like it
     * "doesn't save" — the server is updated but the view shows stale
     * data until the tab is remounted.
     *
     * Compare by reference (AdminApp always hands in a new array after a
     * refresh) and refresh the inner layout token so the
     * `DraggableWrapper` re-keys its children.
     */
    componentDidUpdate(prevProps: IDynamicTabsContent) {
        if (prevProps.sections !== this.props.sections) {
            this.setState({sections: this.props.sections, state: guid()});
        }
        if (prevProps.page !== this.props.page) {
            this.setState({page: this.props.page});
        }
    }

    /** Re-pulls the page's sections from the parent refresh pipe — the
     *  parent owns section identity, so we just delegate. */
    refreshView = async (): Promise<void> => {
        await this.refresh();
    }

    /**
     * Group consecutive overlay sections behind the nearest preceding non-
     * overlay section ("host"). The host renders with `position:relative`
     * so each overlay can absolutely pin itself to an anchor. Overlays at
     * the start of the list (no host yet) fall back to rendering inline so
     * they're visible and the admin can fix the configuration.
     */
    private renderGroupedSections(): React.ReactNode[] {
        const out: React.ReactNode[] = [];
        const groups: Array<{host: ISection; hostIndex: number; overlays: Array<{section: ISection; index: number}>}> = [];
        (this.state.sections ?? []).forEach((section, index) => {
            if (section.overlay && groups.length > 0) {
                groups[groups.length - 1].overlays.push({section, index});
            } else {
                groups.push({host: section, hostIndex: index, overlays: []});
            }
        });
        for (const g of groups) {
            if (g.overlays.length === 0) {
                out.push(this.renderSection(g.host, g.hostIndex));
            } else {
                out.push(
                    <div
                        key={`host-${g.hostIndex}-${g.host.type}`}
                        className="section-host"
                        style={{position: 'relative'}}
                    >
                        {this.renderSection(g.host, g.hostIndex)}
                        {g.overlays.map(ov => (
                            <div
                                key={`overlay-${ov.index}-${ov.section.type}`}
                                className={`section-overlay section-overlay--${ov.section.overlayAnchor ?? 'top-left'}`}
                            >
                                {this.renderSection(ov.section, ov.index, {asOverlay: true})}
                            </div>
                        ))}
                    </div>
                );
            }
        }
        return out;
    }

    /**
     * Admin-only: flip a section's overlay state + anchor. Persists via the
     * same `addUpdateSectionItem` mutation used by content saves so we ride
     * the existing refresh-bus + undo rails for free.
     */
    private updateSectionOverlay = async (section: ISection, value: string): Promise<void> => {
        if (!section.id) return;
        const before = {overlay: section.overlay, overlayAnchor: section.overlayAnchor};
        const overlay = value !== 'none';
        const overlayAnchor = overlay ? (value as ISection['overlayAnchor']) : undefined;
        const next: ISection = {...section, overlay, overlayAnchor};
        // Optimistic
        this.setState({
            sections: this.state.sections.map(s => s.id === section.id ? next : s),
            state: guid(),
        });
        try {
            await this.MongoApi.addSectionToPage({section: next as any, pageName: this.state.page}, this.state.sections);
        } catch (err) {
            console.error('overlay toggle failed, rolling back:', err);
            this.setState({
                sections: this.state.sections.map(s => s.id === section.id ? {...s, ...before} : s),
            });
            message.error(this.props.t('Overlay change failed — reverted.'));
            return;
        }
        undoStack.push({
            label: overlay ? this.props.t('Overlay on') : this.props.t('Overlay off'),
            undo: async () => {
                if (!section.id) return;
                await this.MongoApi.addSectionToPage({section: {...section, ...before} as any, pageName: this.state.page}, this.state.sections);
                await this.refresh();
            },
            redo: async () => {
                if (!section.id) return;
                await this.MongoApi.addSectionToPage({section: next as any, pageName: this.state.page}, this.state.sections);
                await this.refresh();
            },
        });
    }

    private renderOverlayControls(section: ISection): React.ReactNode {
        if (!this.admin) return null;
        const current = section.overlay ? (section.overlayAnchor ?? 'top-left') : 'none';
        return (
            <div
                className="section-admin-overlay-controls"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    marginBottom: 4,
                    fontSize: 11,
                }}
            >
                <Tooltip title={this.props.t('Layer this section as an absolute overlay on top of the previous section.')}>
                    <span style={{textTransform: 'uppercase', letterSpacing: 0.8, color: 'rgba(0,0,0,0.55)'}}>
                        {this.props.t('Overlay')}
                    </span>
                </Tooltip>
                <Segmented
                    size="small"
                    value={current}
                    options={[
                        {label: this.props.t('Off'), value: 'none'},
                        {label: '◤', value: 'top-left'},
                        {label: '◥', value: 'top-right'},
                        {label: '◣', value: 'bottom-left'},
                        {label: '◢', value: 'bottom-right'},
                        {label: '✦', value: 'center'},
                        {label: '▣', value: 'fill'},
                    ]}
                    onChange={(val) => this.updateSectionOverlay(section, String(val))}
                />
            </div>
        );
    }

    private renderSection(section: ISection, index: number, opts: {asOverlay?: boolean} = {}): React.ReactNode {
        // Slot count = explicit `slots.length` when set (custom widths like 66/33),
        // else `section.type` (even columns).
        const slotCount = Array.isArray(section.slots) && section.slots.length > 0
            ? section.slots.length
            : section.type;
        const emptySections = slotCount - (section.content?.length ?? 0);
        if (emptySections > 0) {
            // Must satisfy `InItem.style` / `.content` / `.type` (all `String!`)
            // — otherwise a later save that round-trips these filler items 400s
            // the GraphQL mutation.
            const emptySection = {
                type: EItemType.Empty,
                style: EStyle.Default,
                content: '{}'
            };
            for (let i = 0; i < emptySections; i++) {
                section.content?.push(emptySection as IItem);
            }
        }
        return (
            <div
                key={`${index}-${section.type}`}
                className={`section-admin-wrap ${index}-${section.type}${opts.asOverlay ? ' is-overlay' : ''}`}
            >
                {this.admin && (
                    <div className="section-admin-strip" style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '4px 8px 0'}}>
                        {this.renderOverlayControls(section)}
                        {(section as any).editedAt && (
                            <AuditBadge
                                editedBy={(section as any).editedBy}
                                editedAt={(section as any).editedAt}
                                compact
                            />
                        )}
                    </div>
                )}
                <SectionErrorBoundary admin={this.admin} sectionId={section.id}>
                    <EditWrapper
                        t={this.props.t}
                        admin={this.admin}
                        deleteAction={async () => {
                            if (section.id) {
                                await this.MongoApi.deleteSection(section.id);
                                const sections = this.state.sections.filter(s => s.id !== section.id);
                                this.setState({sections});
                                await this.refresh();
                            }
                        }}
                    >
                        <SectionContent
                            admin={this.admin}
                            t={this.props.t}
                            tApp={this.props.tApp}
                            section={section}
                            refresh={async () => { await this.refresh(); }}
                            addRemoveSectionItem={async (sectionId: string, config: IConfigSectionAddRemove) => {
                                const target = this.state.sections.find(s => s.id === sectionId);
                                const previousItem = target?.content?.[config.index];
                                const priorSnapshot = previousItem ? {
                                    index: config.index,
                                    type: previousItem.type,
                                    style: previousItem.style ?? EStyle.Default,
                                    content: previousItem.content,
                                    action: previousItem.action,
                                    actionStyle: previousItem.actionStyle,
                                    actionType: previousItem.actionType,
                                    actionContent: previousItem.actionContent,
                                } : {
                                    index: config.index,
                                    type: EItemType.Empty,
                                    style: EStyle.Default,
                                    content: '',
                                };
                                try {
                                    await this.MongoApi.addRemoveSectionItem(sectionId, config, this.state.sections);
                                } catch (err) {
                                    if (isConflictError(err)) {
                                        // Stash the conflict so the dialog can offer take-theirs vs
                                        // keep-mine. Keep-mine retries by adopting the server's
                                        // bumped version; the SectionApi reads `section.version`
                                        // so updating it locally is enough.
                                        this.setState({
                                            conflict: {
                                                error: err,
                                                sectionId,
                                                retry: async () => {
                                                    const sec = this.state.sections.find(s => s.id === sectionId);
                                                    if (sec) sec.version = err.currentVersion;
                                                    await this.MongoApi.addRemoveSectionItem(sectionId, config, this.state.sections);
                                                    this.setState({state: guid(), conflict: undefined});
                                                    await this.refresh();
                                                },
                                            },
                                        });
                                        return;
                                    }
                                    throw err;
                                }
                                this.setState({state: guid()});
                                const isDelete = config.type === EItemType.Empty;
                                const wasEmpty = previousItem?.type === EItemType.Empty || !previousItem;
                                const label = isDelete
                                    ? this.props.t('Deleted item')
                                    : wasEmpty
                                        ? this.props.t('Added item')
                                        : this.props.t('Edited item');
                                undoStack.push({
                                    label,
                                    undo: async () => {
                                        await this.MongoApi.addRemoveSectionItem(sectionId, priorSnapshot as IConfigSectionAddRemove, this.state.sections);
                                        this.setState({state: guid()});
                                        await this.refresh();
                                    },
                                    redo: async () => {
                                        await this.MongoApi.addRemoveSectionItem(sectionId, config, this.state.sections);
                                        this.setState({state: guid()});
                                        await this.refresh();
                                    },
                                });
                            }}
                        />
                    </EditWrapper>
                </SectionErrorBoundary>
            </div>
        );
    }

    render() {
        const hasSections = this.state.sections && this.state.sections.length > 0;
        return (
            <div className={'dynamic-content'}>
                {!hasSections && (
                    <Empty
                        description={this.admin
                            ? this.props.t('No sections yet — start from a template or build one blank below.')
                            : this.props.t('This page is empty.')}
                        style={{padding: '48px 0'}}
                    >
                        {this.admin && (
                            <Space wrap style={{justifyContent: 'center'}}>
                                {SECTION_TEMPLATES.slice(0, 4).map(tpl => (
                                    <Button
                                        key={tpl.key}
                                        onClick={async () => {
                                            const section = {
                                                page: this.state.page,
                                                type: tpl.sectionType,
                                                content: tpl.items.map(i => ({
                                                    type: i.type,
                                                    style: i.style ?? 'default',
                                                    content: i.content,
                                                    action: i.action ?? 'none',
                                                    actionStyle: i.actionStyle ?? 'default',
                                                    actionType: i.actionType ?? 'TEXT',
                                                    actionContent: i.actionContent ?? '{}',
                                                })),
                                            };
                                            const result = await this.MongoApi.addSectionToPage({section} as any, this.state.sections);
                                            this.setState({sections: result});
                                        }}
                                    >
                                        <span style={{marginRight: 6}}>{tpl.icon}</span>
                                        {this.props.t(tpl.labelKey)}
                                    </Button>
                                ))}
                            </Space>
                        )}
                    </Empty>
                )}
                <DraggableWrapper admin={this.admin} id={`${this.state.sections.length}-${this.state.state}`}
                                  onPosChange={this.getChangedPos}>
                    {
                        this.renderGroupedSections()
                    }
                </DraggableWrapper>
                {this.admin && <div className={'new-section-wrapper'}>
                    <AddNewSection
                        t={this.props.t}
                        page={this.state.page}
                        addSectionToPage={async (item: { section: InSection; pageName?: string }) => {
                            const result = await this.MongoApi.addSectionToPage(item, this.state.sections)
                            this.setState({sections: result})
                        }}
                    />
                </div>
                }
                {this.state.conflict && (() => {
                    const c = this.state.conflict;
                    const peer = c.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                    return (
                        <ConflictDialog
                            open
                            docKind={this.props.t('Section')}
                            peerVersion={c.error.currentVersion}
                            peerEditedBy={peer?.editedBy}
                            peerEditedAt={peer?.editedAt}
                            onCancel={() => this.setState({conflict: undefined})}
                            onTakeTheirs={async () => {
                                this.setState({conflict: undefined});
                                await this.refresh();
                            }}
                            onKeepMine={async () => {
                                try { await c.retry(); }
                                catch (err) {
                                    message.error(String((err as Error)?.message ?? err));
                                    this.setState({conflict: undefined});
                                }
                            }}
                        />
                    );
                })()}
            </div>
        )
    }
}

export default DynamicTabsContent