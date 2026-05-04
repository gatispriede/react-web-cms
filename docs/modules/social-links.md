# `SocialLinks` (`EItemType.SocialLinks`)

> Row of social/contact links with platform icons. Supports github, linkedin, email, phone, twitter, youtube, website, other.

`item.type`: `SOCIAL_LINKS` &nbsp;·&nbsp; `item.style`: `default` (one of [`ESocialLinksStyle`](../../ui/client/modules/SocialLinks/SocialLinks.types.ts))

---

## Content shape

```ts
{
    links: ISocialLink[];
}

interface ISocialLink {
    platform: 'github' | 'linkedin' | 'email' | 'phone' | 'twitter' | 'website' | 'youtube' | 'other';
    url: string;                       // address (URL, email, or phone)
    label?: string;                    // visible link text (defaults to platform name)
}
```

`href` resolution rules (see `hrefFor` in `SocialLinks.tsx`):

- `email` → `mailto:{url}` (unless already prefixed)
- `phone` → `tel:{url-without-spaces}` (unless already prefixed)
- everything else: `url` verbatim

External-platform links open in a new tab with `rel="noopener noreferrer"`. `email` and `phone` stay in-tab.

## Styles

| Value | Description |
|---|---|
| `default` | Compact icon row |
| `large` | Bigger icons / hit targets |
| `channels` | Editorial CV "channels strip" — card grid with platform glyph, big href row, mono "OPEN" affordance |

Source: `ESocialLinksStyle` enum in [`SocialLinks.types.ts`](../../ui/client/modules/SocialLinks/SocialLinks.types.ts).

---

## Admin authoring

**File:** [`ui/admin/modules/SocialLinks/SocialLinksEditor.tsx`](../../ui/admin/modules/SocialLinks/SocialLinksEditor.tsx)

Each link row (sortable):

- **Platform** — `<Select>` (8 options: GitHub, LinkedIn, Email, Phone, X / Twitter, YouTube, Website, Other)
- **URL or email** — `<Input>` (col span 10)
- **Label (optional)** — `<Input>` (col span 6) &nbsp;·&nbsp; **first row only** carries `data-testid="module-editor-primary-text-input"`
- Delete button

Top-level: **Add link** button.

## Public rendering

**File:** [`ui/client/modules/SocialLinks/SocialLinks.tsx`](../../ui/client/modules/SocialLinks/SocialLinks.tsx)

```html
<div class="social-links default">
    <a href="{hrefFor(link)}" target="_blank" rel="noopener noreferrer">
        <!-- antd icon: GithubOutlined / LinkedinOutlined / MailOutlined / PhoneOutlined / TwitterOutlined / YoutubeOutlined / GlobalOutlined -->
        <span>{label || platform}</span>
    </a>
    <!-- more links -->
</div>
```

Wrapped in `<RevealOnScroll>`. Email and phone targets omit `target="_blank"`.

The icon mapping is exported as `PLATFORM_ICONS: Record<SocialPlatform, React.ReactNode>`. Unknown platforms fall back to the `other` icon (`GlobalOutlined`).

**Theming tokens consumed (SocialLinks.scss):** icon size, hover colour, large-style spacing, channels-style card surface tokens.

**Italic-accent runs (`*word*`):** NOT supported.

---

## Testids

| Where | Testid |
|---|---|
| Picker option | `section-module-picker-social-links` |
| Rendered module container (admin + public) | `section-module-row-social-links` |
| Edit affordance on the section row (admin) | `section-module-edit-social-links-btn` |
| Primary text input (admin) | `module-editor-primary-text-input` (on the **first link's** Label) |
| Save action on the editor drawer (admin) | `module-editor-save-btn` |

---

## Sample content (e2e)

Entry in [`tests/e2e/fixtures/moduleSamples.ts`](../../tests/e2e/fixtures/moduleSamples.ts):

```ts
{
    type: EItemType.SocialLinks,
    style: 'default',
    content: {
        links: [{platform: 'github', url: 'https://github.com/example', label: m(EItemType.SocialLinks)}],
    },
    markerText: m(EItemType.SocialLinks),
}
```

The chain spec asserts the marker label appears on the public render.

---

## MCP commands

```bash
cms section add my-page SOCIAL_LINKS --sample
cms section add my-page SOCIAL_LINKS --content '{"links":[{"platform":"github","url":"https://github.com/me","label":"GitHub"},{"platform":"email","url":"hi@me.com"}]}'
cms section update <id> --style channels
```

---

## Notes

- An empty `url` resolves to `#` — the link still renders but doesn't navigate. Useful as a placeholder during authoring.
- The `phone` rewriter strips whitespace but doesn't validate format. International codes (`+371...`) work. Prefix with `+` directly.
- The `other` platform falls back to the `GlobalOutlined` icon — useful for any non-standard platform (Mastodon, Bluesky, RSS, etc.).
