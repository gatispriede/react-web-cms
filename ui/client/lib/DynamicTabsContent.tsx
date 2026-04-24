import React from "react";
import {Button, Empty, Segmented, Space, Switch, Tooltip, message} from "antd";
import EditWrapper from "@client/lib/EditWrapper";
import ConflictDialog from "@client/lib/ConflictDialog";
import {ConflictError, isConflictError} from "@client/lib/conflict";
import {SECTION_TEMPLATES} from "@admin/lib/itemTypes/templates";
import SectionErrorBoundary from "@client/lib/SectionErrorBoundary";
import AddNewSection from "@admin/features/Dialogs/AddNewSection";
import SectionContent from "./SectionContent";
import {ISection} from "@interfaces/ISection";
import {IItem} from "@interfaces/IItem";
import MongoApi from "@services/api/client/MongoApi";
import {IConfigSectionAddRemove} from "@interfaces/IConfigSectionAddRemove";
import guid from "@utils/guid";
import DraggableWrapper from "@client/lib/DraggableWrapper";
import AuditBadge from "@admin/shell/AuditBadge";
import {TFunction} from "i18next";
import {InSection} from "@interfaces/IMongo";
import {EItemType} from "@enums/EItemType";
import {EStyle} from "@enums/EStyle";
import {undoStack} from "@client/lib/undoStack";
import {refreshBus} from "@client/lib/refreshBus";

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

    /** Set while a per-section patch (transparency, overlay, slots) is in
     *  flight. The resulting server-side `refreshBus.emit('content')` would
     *  otherwise round-trip through AdminApp.initialize → rebuild the whole
     *  tabs tree → unmount AddNewSectionItem's drawer mid-edit. Optimistic
     *  setState inside `updateSection` already reflects the patch locally,
     *  so swallowing one refresh tick is safe. */
    private suppressNextContentRefresh = false;

    componentDidMount() {
        this.refreshUnsub = refreshBus.subscribe(() => {
            if (this.suppressNextContentRefresh) {
                this.suppressNextContentRefresh = false;
                return;
            }
            void this.refreshView();
        }, 'content');
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
            // Only re-key DraggableWrapper when section *identity/order*
            // changes (add/remove/reorder). Field-level edits (transparency,
            // overlay, slots) reach us through the same refresh pipe but
            // keep the same id sequence — re-keying there would unmount any
            // open `AddNewSectionItem` drawer mid-edit.
            const prevIds = (prevProps.sections ?? []).map(s => s.id ?? '').join('|');
            const nextIds = (this.props.sections ?? []).map(s => s.id ?? '').join('|');
            const structuralChange = prevIds !== nextIds;
            this.setState(structuralChange
                ? {sections: this.props.sections, state: guid()}
                : {sections: this.props.sections});
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

    /**
     * Admin-only: flip a section's `transparent` flag. Same optimistic
     * save + undo rail as overlay. See roadmap/module-transparency-style.md.
     */
    /**
     * Generic section-level patch — used by the in-dialog "Style" tab
     * (section transparency + opacity slider) and any future section-level
     * controls. Optimistic: local state updates immediately, server write
     * follows; on failure we roll back and surface a message. An undo entry
     * is pushed so the operator can ctrl-Z a bad slider pull.
     */
    private updateSection = async (section: ISection, patch: Partial<ISection>): Promise<void> => {
        if (!section.id) return;
        const before: Partial<ISection> = {};
        for (const k of Object.keys(patch) as Array<keyof ISection>) {
            (before as any)[k] = (section as any)[k];
        }
        const next: ISection = {...section, ...patch};
        // NOTE: intentionally do NOT bump `state: guid()` here. That id is a
        // DraggableWrapper remount key; re-keying it on every transparency
        // tick unmounts the whole section tree → closes any open
        // AddNewSectionItem drawer mid-edit. The sections-array replace is
        // enough to surface the patch visually.
        this.setState({
            sections: this.state.sections.map(s => s.id === section.id ? next : s),
        });
        // The server emits `refreshBus.emit('content')` after save; swallow
        // that one tick so AdminApp.initialize doesn't tear down the open
        // drawer. Our optimistic setState above already reflects the patch.
        this.suppressNextContentRefresh = true;
        try {
            await this.MongoApi.addSectionToPage({section: next as any, pageName: this.state.page}, this.state.sections);
        } catch (err) {
            console.error('section patch failed, rolling back:', err);
            // Failed save → no server refresh will fire, so clear the
            // suppression flag to avoid eating the next unrelated refresh.
            this.suppressNextContentRefresh = false;
            this.setState({
                sections: this.state.sections.map(s => s.id === section.id ? {...s, ...before} : s),
            });
            message.error(this.props.t('Section change failed — reverted.'));
            return;
        }
        const keys = Object.keys(patch);
        const label = keys.includes('transparent') || keys.includes('transparentOpacity')
            ? this.props.t('Transparency change')
            : this.props.t('Section change');
        undoStack.push({
            label,
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

    /* Legacy inline transparency Switch was removed — the control now lives
       inside `AddNewSectionItem`'s Style tab (third tab) with a proper
       opacity slider. See `updateSection` + SectionContent's `updateSection`
       prop for the data path. */

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
                            updateSection={(patch) => this.updateSection(section, patch)}
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