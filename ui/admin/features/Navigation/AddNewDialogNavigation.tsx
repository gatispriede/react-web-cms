import React from "react";
import {Button, Input, message, Modal, Select, Tooltip} from "antd";
import {DownOutlined, UpOutlined} from "@client/lib/icons";
import MongoApi from "@services/api/client/MongoApi";
import {ISeo} from "@interfaces/ISeo";
import {INavigation} from "@interfaces/INavigation";
import guid from "@utils/guid";
import {TFunction} from "i18next";
import {isReservedPageSlug, RESERVED_PAGE_SLUGS} from "@utils/reservedSlugs";
import {isDescendantOrSelf, depthOf, MAX_DEPTH} from "./parentTree";

interface IProps {
    refresh: () => Promise<void>,
    close: () => void,
    open: boolean,
    activeNavigation: Partial<INavigation>,
    /** All known pages, used to populate the Parent Select. F1 sub-pages. */
    allPages?: INavigation[],
    /**
     * Active locale codes (from `LanguageService.getLanguages`). Drives
     * the per-locale slug editor. `defaultLocale` anchors the fallback
     * order. Bare-string slugs continue to work without these props
     * (the editor stays in legacy single-field mode).
     */
    activeLocales?: string[],
    defaultLocale?: string,
    t: TFunction<"translation", undefined>
}

interface ISate {
    dialogOpen: boolean,
    newNavigationName: string,
    activeNavigation: INavigation
    seo: ISeo
    seoExpanded: boolean
    /** Selected parent page id; `null` = top-level. F1 sub-pages. */
    parentId: string | null
    /**
     * Per-locale slug editor state. When `null` the dialog renders the
     * legacy single-field flow (bare-string slug). When a Record, it
     * renders one Input per active locale and saves the Record shape.
     * "Add per-locale slugs" button promotes a bare-string into a
     * Record seeded with `{[defaultLocale]: existingSlug}` — option
     * (a) from the spec (less surprising than auto-expanding).
     */
    slug: string | Record<string, string> | null
}

class AddNewDialogNavigation extends React.Component<IProps, {}> {
    sections: string[] = []
    refresh: () => Promise<void>
    state: ISate = {
        dialogOpen: false,
        newNavigationName: '',
        activeNavigation: {
            id: '',
            page: "",
            sections: [],
            type: "",
            seo: {}
        },
        seo: {},
        // SEO fields start collapsed — editors usually just want to name the
        // page and set content, SEO can be filled later. When editing an
        // existing page that already has values we auto-expand below.
        seoExpanded: false,
        parentId: null,
        slug: null,
    }
    inEditMode: boolean = false
    private MongoApi: MongoApi = new MongoApi()

    constructor(props: IProps) {
        super(props)
        this.refresh = props.refresh
        // Hydrate from props on initial mount — `componentDidUpdate`
        // alone doesn't run for the first render, so a dialog opened
        // already wired to an existing page would otherwise show the
        // default empty editor on mount.
        if (props.activeNavigation && props.activeNavigation.id) {
            this.state = {
                ...this.state,
                activeNavigation: props.activeNavigation as INavigation,
                seo: props.activeNavigation.seo ?? {},
                newNavigationName: props.activeNavigation.page ?? '',
                parentId: props.activeNavigation.parent ?? null,
                slug: (props.activeNavigation.slug as string | Record<string, string> | undefined) ?? null,
            }
            this.inEditMode = true
        }
    }

    set newNavigationName(value: string) {
        this.setState({newNavigationName: value})
    }

    componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<{}>, snapshot?: any) {
        if (this.props.activeNavigation && this.props.activeNavigation.id && this.props.activeNavigation.id.length > 0) {
            this.inEditMode = true
            if ("id" in this.props.activeNavigation) {
                if (this.state.activeNavigation.id !== this.props.activeNavigation.id) {
                    // SEO stays collapsed even when the existing page already has
                    // values — the editor must click "Show more options" to view
                    // / edit them. Keeps the primary flow focused on the page name.
                    this.setState({
                        activeNavigation: this.props.activeNavigation,
                        seo: this.props.activeNavigation.seo ?? {},
                        newNavigationName: this.props.activeNavigation.page,
                        seoExpanded: false,
                        parentId: this.props.activeNavigation.parent ?? null,
                        // F1 follow-up — `slug` arrives as either a
                        // bare string (legacy single-locale rows) or a
                        // Record. Hydrate state with whichever shape
                        // the row carried so the editor renders the
                        // matching mode without surprising the user.
                        slug: (this.props.activeNavigation.slug as string | Record<string, string> | undefined) ?? null,
                    })
                }
            }
        } else {
            this.inEditMode = false
            if (this.state.newNavigationName.length > 0 && prevProps.open !== this.props.open) {
                this.setState({newNavigationName: '', activeNavigation: {}, seo: {}, parentId: null, slug: null})
            }
        }
    }

    async createEditNavigation() {
        // F1 follow-up — emit Record only when the editor is actually
        // in per-locale mode. Bare-string mode passes `undefined` so
        // the server's slug-backfill logic kicks in (legacy behaviour).
        const slugPayload: string | Record<string, string> | undefined = (() => {
            const s = this.state.slug;
            if (s === null || s === undefined) return undefined;
            return s;
        })();
        if (!this.inEditMode) {
            const id = guid();
            // F1 sub-pages — `parent` round-trips through `InNavigation`
            // now that the GraphQL input + gqty client both expose it,
            // so the post-create `setParent` workaround is no longer
            // needed. The standalone `setParent` mutation is still used
            // for moves on existing rows below.
            await this.MongoApi.createNavigation({
                id,
                type: 'navigation',
                page: this.state.newNavigationName,
                parent: this.state.parentId ?? undefined,
                slug: slugPayload,
                seo: this.state.seo,
                sections: this.sections
            })
        } else {
            if ("id" in this.state.activeNavigation) {
                const newNavigation: INavigation = this.state.activeNavigation;
                const oldNavigationName: string = this.state.activeNavigation.page
                newNavigation.page = this.state.newNavigationName;
                newNavigation.seo = this.state.seo;
                if (slugPayload !== undefined) newNavigation.slug = slugPayload;
                await this.MongoApi.replaceUpdateNavigation(oldNavigationName, newNavigation)
                // Parent moves are a separate mutation — server validates
                // cycles + depth-cap on every call.
                const currentParent = this.state.activeNavigation.parent ?? null;
                if (currentParent !== this.state.parentId) {
                    const res = await this.MongoApi.setNavigationParent(
                        this.state.activeNavigation.id,
                        this.state.parentId,
                    );
                    // F1 — surface server-side cycle / depth-cap rejections
                    // as toasts. The client guard already disables invalid
                    // options on the Parent <Select>, but a stale tree
                    // (concurrent edits) can still trip the server check.
                    if (res && res.ok === false) {
                        if (res.error === 'cycle') {
                            message.error({
                                content: this.props.t('Cannot move a page under its own descendant'),
                                'data-testid': 'nav-page-cycle-error-toast',
                            } as any);
                        } else if (res.error === 'depth-cap') {
                            message.error({
                                content: this.props.t('Maximum nesting depth is 3 levels'),
                                'data-testid': 'nav-page-depth-error-toast',
                            } as any);
                        } else {
                            message.error(String(res.error));
                        }
                        return;
                    }
                }
            }

        }
        await this.props.refresh()
        this.props.close()
    }

    seoFields = [
        "description",
        "keywords",
        "viewport",
        "charSet",
        "url",
        "image",
        "image_alt",
        "author",
        "locale"
    ]

    /**
     * F1 follow-up — slug editor. Two modes:
     *  • single-field (Record-less): bare string + "Add per-locale
     *    slugs" button that promotes to Record on click — option (a)
     *    from the spec, less surprising than auto-expanding.
     *  • per-locale: one `<Input>` per active locale, anchored on
     *    `defaultLocale`. Saving emits the Record shape.
     * No `activeLocales` prop = no per-locale UI (back-compat for
     * older parents that haven't been wired yet).
     */
    renderSlugEditor() {
        const t = this.props.t;
        const slug = this.state.slug;
        const locales = this.props.activeLocales ?? [];
        const defaultLocale = this.props.defaultLocale;
        const isRecord = slug !== null && typeof slug === 'object';
        if (!isRecord) {
            const bare = typeof slug === 'string' ? slug : '';
            return (
                <div className={'page-slug'} style={{marginTop: 12}} data-testid="nav-slug-editor-single">
                    <label>{t('URL slug')}</label>
                    <Input
                        data-testid="nav-slug-input"
                        value={bare}
                        placeholder={t('Auto-generated from page name on save')}
                        onChange={(e) => this.setState({slug: e.target.value})}
                    />
                    {locales.length > 1 && (
                        <Button
                            type="link"
                            size="small"
                            data-testid="nav-slug-add-per-locale"
                            onClick={() => {
                                const seed: Record<string, string> = {};
                                for (const loc of locales) seed[loc] = (defaultLocale && loc === defaultLocale) ? bare : '';
                                if (defaultLocale && !(defaultLocale in seed)) seed[defaultLocale] = bare;
                                this.setState({slug: seed});
                            }}
                            style={{padding: 0, marginTop: 4}}
                        >
                            {t('Add per-locale slugs')}
                        </Button>
                    )}
                </div>
            );
        }
        const map = slug as Record<string, string>;
        const renderLocales = locales.length > 0 ? locales : Object.keys(map);
        return (
            <div className={'page-slug page-slug-per-locale'} style={{marginTop: 12}} data-testid="nav-slug-editor-per-locale">
                <label>{t('URL slug per locale')}</label>
                {renderLocales.map((loc) => (
                    <div key={loc} style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 6}}>
                        <span style={{minWidth: 48}}>{loc}</span>
                        <Input
                            data-testid={`nav-slug-input-${loc}`}
                            value={map[loc] ?? ''}
                            onChange={(e) => this.setState({slug: {...map, [loc]: e.target.value}})}
                        />
                    </div>
                ))}
            </div>
        );
    }

    render() {
        const seo: ISeo = this.state.seo;
        // Server has the source-of-truth check (see `assertNotReservedPageSlug`
        // in NavigationService). We mirror it here so the OK button disables
        // and the operator sees a hint without round-tripping. Comparison is
        // case-insensitive and trims whitespace — matches the server rule.
        // The min-length is just a guard against empty / single-char typos —
        // 3 is the floor so existing 3-letter pages (CMS, LSS) round-trip.
        const reserved = isReservedPageSlug(this.state.newNavigationName);
        const tooShort = this.state.newNavigationName.trim().length < 2;
        // Build the Parent Select options. F1 sub-pages — see `parentTree.ts`.
        // When editing, disable any option whose ancestry includes (or IS)
        // the current page — would create a cycle. The depth cap also
        // disables anything already at MAX_DEPTH (since adding under it
        // would push the moved subtree over the limit).
        const allPages = this.props.allPages ?? [];
        const editingId = this.inEditMode ? this.state.activeNavigation.id : '';
        const parentOptions = [
            {
                value: '__root__',
                label: <span data-testid="nav-page-parent-option-__root__">{this.props.t('(top level)')}</span>,
                disabled: false,
            },
            ...allPages.map(p => {
                const wouldCycle = !!editingId && isDescendantOrSelf(allPages, editingId, p.id);
                const tooDeep = depthOf(allPages, p.id) >= MAX_DEPTH;
                const indent = '  '.repeat(depthOf(allPages, p.id));
                const disabled = wouldCycle || tooDeep;
                // F1 — slug-based testid hooks. Mirrors `nav-page-row-${page}`
                // keying. Disabled descendants get a paired `-disabled` testid
                // and a Tooltip explaining why the option is locked.
                const baseTestId = `nav-page-parent-option-${p.page}`;
                const text = `${indent}${p.page}`;
                const labelEl = disabled ? (
                    <Tooltip title={wouldCycle ? this.props.t('Would create a cycle') : this.props.t('Maximum nesting depth reached')}>
                        <span data-testid={baseTestId}>
                            <span data-testid={`${baseTestId}-disabled`}>{text}</span>
                        </span>
                    </Tooltip>
                ) : (
                    <span data-testid={baseTestId}>{text}</span>
                );
                return {
                    value: p.id,
                    label: labelEl,
                    disabled,
                };
            }),
        ];
        return (
            <>
                <Modal data-testid="nav-page-edit-modal" width={'90%'} open={this.props.open}
                       okButtonProps={{disabled: tooShort || reserved, 'data-testid': 'nav-page-save-btn'}}
                       onOk={async () => {
                           await this.createEditNavigation()
                       }}
                       onCancel={() => {
                           this.props.close()
                       }}>
                    <div className={'page-name'}>
                        <label>{this.props.t("Page name")}</label>
                        <Input
                            data-testid="nav-page-name-input"
                            status={reserved ? 'error' : undefined}
                            value={this.state.newNavigationName}
                            onChange={(input) => this.newNavigationName = input.target.value}
                        />
                        {reserved && (
                            <div style={{color: '#ff4d4f', fontSize: '.85em', marginTop: 4}}>
                                {this.props.t('"{{name}}" is reserved and can\'t be used. Reserved: {{list}}.', {
                                    name: this.state.newNavigationName.trim(),
                                    list: RESERVED_PAGE_SLUGS.join(', '),
                                })}
                            </div>
                        )}
                    </div>
                    <div className={'page-parent'} style={{marginTop: 12}}>
                        <label>{this.props.t('Parent page')}</label>
                        <Select
                            data-testid="nav-page-parent-select"
                            style={{width: '100%'}}
                            value={this.state.parentId ?? '__root__'}
                            options={parentOptions}
                            onChange={(v) => this.setState({parentId: v === '__root__' ? null : v})}
                        />
                    </div>
                    {this.renderSlugEditor()}
                    <hr/>
                    <div className={'page-seo'}>
                        <Button
                            type="link"
                            size="small"
                            icon={this.state.seoExpanded ? <UpOutlined/> : <DownOutlined/>}
                            onClick={() => this.setState({seoExpanded: !this.state.seoExpanded})}
                            style={{padding: 0}}
                        >
                            {this.state.seoExpanded
                                ? this.props.t('Hide SEO fields')
                                : this.props.t('Show more options · SEO fields')}
                        </Button>
                        {this.state.seoExpanded && (
                            <div style={{marginTop: 12}}>
                                <h3 style={{margin: '0 0 8px'}}>{this.props.t("SEO fields")}</h3>
                                {
                                    this.seoFields.map((field: string, index: number) => (
                                        <div key={index} className={'seo-config'}>
                                            <label>{this.props.t(field.toLocaleUpperCase())}</label>
                                            <Input data-testid={`nav-page-seo-${field}-input`} value={(seo as any)[field]}
                                                   onChange={(input) => {
                                                       this.setState({
                                                           seo: {
                                                               ...this.state.seo,
                                                               [field]: input.target.value
                                                           }
                                                       })
                                                   }}
                                            />
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                </Modal>
            </>

        )
    }
}

export default AddNewDialogNavigation