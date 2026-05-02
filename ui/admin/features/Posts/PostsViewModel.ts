import {message} from 'antd';
import PostApi from '@services/api/client/PostApi';
import SiteFlagsApi from '@services/api/client/SiteFlagsApi';
import {IPost, InPost} from '@interfaces/IPost';
import {ConflictError, isConflictError} from '@client/lib/conflict';
import {observable} from '@client/lib/state/observable';

/**
 * Posts view-model — proof case for `view-model-classes.md` (VM2).
 *
 * Holds the state and actions previously inlined as `useState` walls
 * inside `Posts.tsx`. The component shrinks to render-only; every
 * mutation goes through a method on this class.
 *
 * Pattern rules (per spec):
 *   - No JSX / React imports here.
 *   - Async actions mutate `this.*` directly; reactivity layer notifies.
 *   - Errors flash through AntD `message` (already imported) — same UX
 *     as the old inline calls. Future iteration: surface via `this.flash`
 *     state so the helper is React-agnostic.
 *   - Form values are owned by AntD `Form.useForm` in the component;
 *     this VM only sees the committed payload.
 */

export interface ConflictState {
    error: ConflictError<unknown>;
    retry: () => Promise<void>;
}

export class PostsViewModel {
    posts: IPost[] = [];
    loading = false;
    saving = false;
    blogEnabled = true;

    /** The post currently in the edit drawer; `null` = drawer closed. */
    editing: Partial<InPost> | null = null;
    /** Optimistic-concurrency token captured when the drawer opens. */
    editingVersion: number | undefined = undefined;

    /** Optimistic-concurrency conflict surfaced to the user via the dialog. */
    conflict: ConflictState | null = null;

    constructor(
        private readonly postApi: PostApi = new PostApi(),
        private readonly siteFlagsApi: SiteFlagsApi = new SiteFlagsApi(),
        private readonly t: (key: string, opts?: Record<string, unknown>) => string = (k) => k,
    ) {
        // Wrap `this` so field writes are observable. The Proxy returned
        // here replaces `this` for everyone holding a reference.
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const [list, flags] = await Promise.all([
                this.postApi.list({includeDrafts: true, limit: 200}),
                this.siteFlagsApi.get(),
            ]);
            this.posts = list;
            this.blogEnabled = flags.blogEnabled !== false;
        } finally {
            this.loading = false;
        }
    }

    async toggleBlog(on: boolean): Promise<void> {
        const prev = this.blogEnabled;
        this.blogEnabled = on;
        const result = await this.siteFlagsApi.save({blogEnabled: on});
        if ((result as {error?: string}).error) {
            this.blogEnabled = prev;
            message.error((result as {error?: string}).error ?? '');
            return;
        }
        message.success(on ? this.t('Blog enabled') : this.t('Blog hidden from the public site'));
    }

    openCreate(): void {
        this.editing = {draft: true, tags: []};
        this.editingVersion = undefined;
    }

    openEdit(post: IPost): void {
        this.editing = post;
        this.editingVersion = typeof post.version === 'number' ? post.version : 0;
    }

    close(): void {
        this.editing = null;
        this.editingVersion = undefined;
    }

    private async performSave(payload: InPost, expectedVersion: number | undefined): Promise<boolean> {
        const result = await this.postApi.save(payload, expectedVersion);
        if (result.error) { message.error(result.error); return false; }
        // Server-side slug rename surface — same as the legacy inline path.
        const requestedSlug = (payload.slug || '').trim();
        const finalSlug = (result.slug || '').trim();
        if (finalSlug && requestedSlug && finalSlug !== requestedSlug) {
            message.warning(
                this.t('Slug "{{requested}}" was already taken — saved as "{{final}}"', {requested: requestedSlug, final: finalSlug}),
                6,
            );
        } else {
            message.success(payload.id ? this.t('Post updated') : this.t('Post created'));
        }
        this.close();
        await this.refresh();
        return true;
    }

    async save(values: InPost): Promise<void> {
        const payload: InPost = {
            id: this.editing?.id,
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt,
            coverImage: values.coverImage,
            tags: values.tags ?? [],
            author: values.author,
            body: values.body,
            draft: values.draft ?? false,
        };
        this.saving = true;
        try {
            await this.performSave(payload, this.editingVersion);
        } catch (err) {
            if (isConflictError(err)) {
                this.conflict = {
                    error: err,
                    retry: async () => {
                        this.saving = true;
                        try {
                            await this.performSave(payload, err.currentVersion);
                            this.conflict = null;
                        } finally {
                            this.saving = false;
                        }
                    },
                };
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            this.saving = false;
        }
    }

    async remove(post: IPost): Promise<void> {
        const result = await this.postApi.remove(post.id);
        if (result.error) { message.error(result.error); return; }
        message.success(this.t('Post deleted'));
        await this.refresh();
    }

    async togglePublish(post: IPost): Promise<void> {
        const result = await this.postApi.setPublished(post.id, post.draft);
        if (result.error) { message.error(result.error); return; }
        message.success(result.draft ? this.t('Unpublished') : this.t('Published'));
        await this.refresh();
    }

    /** Latest audit row — derived from the posts list. */
    get latestAudit(): {editedBy?: string; editedAt?: string} {
        let best: {editedBy?: string; editedAt?: string} = {};
        for (const p of this.posts) {
            const at = p.editedAt ?? p.updatedAt;
            if (at && (!best.editedAt || at > best.editedAt)) best = {editedBy: p.editedBy, editedAt: at};
        }
        return best;
    }

    /** Resolve the current conflict by accepting the peer's version. */
    takeTheirs(): void {
        this.conflict = null;
        this.close();
        void this.refresh();
    }

    dismissConflict(): void {
        this.conflict = null;
    }
}
