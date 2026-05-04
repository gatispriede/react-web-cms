# View-Model classes — extract UI state out of `.tsx`

Status: **VM1 + VM2 shipped, VM3 15/17 done 2026-05-02.** Bare-Proxy `observable.ts` helper at `ui/client/lib/state/`. **15 admin panes migrated** — Posts, Footer, ErrorLog, McpTokens, Audit, Publishing, Logo, Inquiries, Users, Bundle, Orders, Inventory, Products, Layout, plus Analytics (which never had useState, already render-only). **Remaining: Themes** (439-line theme editor with style/font picker — biggest pane, deferred) and **Translations** (uses an existing `TranslationManager` — needs a different shape than the others). Both are registered through the AdminUILoader registry already; only their internal `useState` walls are pending. **VM4 (lint rule) still pending** — wait until Themes + Translations migrate, then enforce no `useState` in `ui/admin/features/**`.
Last updated: 2026-05-02

## Why

Today most admin features keep their state inline in the `.tsx` component:

```tsx
const Posts: React.FC = () => {
    const [posts, setPosts] = useState<IPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Partial<InPost> | null>(null);
    const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
    const [conflict, setConflict] = useState<{...}>(null);
    const [saving, setSaving] = useState(false);
    const [blogEnabled, setBlogEnabled] = useState(true);
    // …another 250 lines of effects + handlers using these…
};
```

That works but the costs add up:

- **Findability** — "where does `editing` get reset?" requires reading the whole file. The state and the actions on it are visually scattered.
- **Testability** — to test the conflict-retry path you have to mount the React tree and drive AntD components. There's no plain-JS surface.
- **Reuse** — two admin pages with similar list/edit/save shapes copy the same eight `useState` calls + the same effects. No abstraction.
- **Loader symmetry** — the backend already moved to class-based `ServiceLoader`s where state and behaviour live together. The UI side stays loose. The same architectural pressure applies on both sides; it's been resolved on the backend, not the frontend.

A **view-model class** holds the state + the actions that mutate it. The `.tsx` becomes a thin renderer that subscribes to the view-model and dispatches calls.

## Sketch

```ts
// PostsViewModel.ts
import {makeAutoObservable} from '@client/lib/state/observable';
// ^ thin wrapper — could be valtio / zustand / a custom Proxy.
// Choice deferred; see open question 1.

import PostApi from '@services/api/client/PostApi';
import {IPost, InPost} from '@interfaces/IPost';

export class PostsViewModel {
    posts: IPost[] = [];
    loading = false;
    editing: Partial<InPost> | null = null;
    editingVersion: number | undefined = undefined;
    saving = false;
    conflict: ConflictState | null = null;
    blogEnabled = true;

    constructor(private postApi = new PostApi(), private siteFlagsApi = new SiteFlagsApi()) {
        makeAutoObservable(this);
    }

    async refresh() { … }
    openCreate() { … }
    openEdit(post: IPost) { … }
    close() { … }
    async save(values: InPost) { … }   // includes conflict handling
    async remove(post: IPost) { … }
    async togglePublish(post: IPost) { … }
    async toggleBlog(on: boolean) { … }
}
```

```tsx
// Posts.tsx — shrinks to render + dispatch
const Posts: React.FC = () => {
    const vm = useViewModel(PostsViewModel);   // subscribe + memoise
    useEffect(() => { void vm.refresh(); }, [vm]);

    return (
        <div>
            <Button onClick={vm.openCreate}>{t('New post')}</Button>
            <Table dataSource={vm.posts} loading={vm.loading} columns={…} />
            <Drawer open={vm.editing !== null} onClose={vm.close}>…</Drawer>
            {vm.conflict && <ConflictDialog … />}
        </div>
    );
};
```

The component holds NO `useState`. Everything that mutates lives on the class. Effects either call vm methods or use a single `useEffect` that wires the lifecycle.

## Pattern rules

1. **One view-model per route / per major feature pane.** Co-located in the feature folder (`ui/admin/features/Posts/PostsViewModel.ts`).
2. **No JSX, no React imports inside view-models.** Plain TS — testable in node, no DOM mock needed.
3. **Async actions are methods on the class.** They mutate state directly; reactivity layer notifies subscribers.
4. **Errors are state.** Replace inline `message.error(...)` calls with a `vm.flash` field that the renderer surfaces; keeps the class side-effect-free outside its own state.
5. **Server I/O goes through API client classes** (`PostApi`, `SiteFlagsApi`) — already classes; the view-model just composes them.
6. **One vm per UI Loader.** When `AdminUILoader` ships, each pane declares its `viewModel: typeof PostsViewModel` so the shell mounts/unmounts deterministically.

## What changes vs what stays

- `useState` → field on the view-model.
- `useEffect` → either a method called from a single mount-effect, or a `disposer`/`reaction` registered in the constructor.
- `useMemo` for computed values → getter on the view-model (memoised by the reactivity layer).
- `useCallback` → method on the class (already stable).
- Form libraries (AntD `Form.useForm`) stay where they are — the form is a UI primitive, not state. The view-model holds the *initial values* + the *commit action*; AntD owns field-level validation.
- i18n, theming, routing — stay React-side hooks. The vm is data + actions only.

## Migration order

Mirrors the Class Loader rollout:

1. **VM1 — pick a reactivity primitive.** Tiny `Proxy + listeners` helper, or adopt valtio (~3kb), or zustand. Decide once; document.
2. **VM2 — proof case.** Migrate `Posts.tsx` (rich enough to surface conflicts: list, edit drawer, conflict dialog, blog toggle, refresh bus).
3. **VM3 — wide migration.** Bulk-migrate the major admin panes one per feature folder. Coordinate with `AdminUILoader` so each pane declares its vm.
4. **VM4 — drop the legacy patterns.** Lint rule against `useState` in admin feature files; allow it in pure presentation components.

## Why now (companion to Class Loader)

Class Loader gives every feature a class on the backend. View-Model classes give every feature a class on the frontend. The two sit on the same `Loader` hierarchy — `AdminUILoader.viewModel` becomes a first-class field — and the same pattern (state + behaviour, co-located, testable, importable) holds across the seam.

Without VM classes, simplified-mode + advanced-mode (per `admin-ui-modes.md`) would have to duplicate `useState` walls in two `.tsx` files per feature. With VM classes, **both views read the same vm**; mode only changes which JSX renders the same data + dispatches the same actions. Massive duplication saved.

## Decisions (2026-05-02)

1. **Reactivity primitive — bare Proxy + listeners.** No new dep. Helper lives at `ui/client/lib/state/observable.ts`, ~200 lines. Revisit if the helper grows past that ceiling.

## Open questions
2. **VM injection** — singleton per route (created once on mount) or scoped per render (recreated each navigation)? Default: per-route singleton, disposed on unmount.
3. **AntD Form ownership** — vm holds form values OR AntD `Form.useForm` holds them and the vm only sees commits? Default: AntD owns field state, vm sees commits + remembers initialValues (matches existing patterns).
4. **Devtools** — should the reactivity layer expose a Redux-style devtools hook for snapshotting? Default: out of scope for v1; reopen if debugging gets painful.
5. **Test runner** — vitest already in place; vm tests run plain (no DOM). No new infra.
