import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — Blog posts (admin)
//
// Admin opens /admin/content/posts, creates a draft post, saves, and
// confirms the row appears in the list. Public render of the post is
// deferred (same `/[slug]` ISR fixme as the module specs).
// ──────────────────────────────────────────────────────────────────

const blog = {
    slug: `e2e-post-${Date.now().toString(36)}`,
    title: `E2E Post ${Date.now().toString(36)}`,
};

test.describe.serial('feature — blog posts admin', () => {
    test('admin can open the posts page', async ({adminPage}) => {
        await adminPage.goto('/admin/content/posts');
        // Either the empty-state or the table proves the surface mounts.
        await expect(
            adminPage.getByRole('button', {name: /new post|add post|create/i}).first(),
        ).toBeVisible({timeout: 15_000});
    });

    test.fixme('admin creates a new draft post', async ({adminPage}) => {
        // FIXME: needs `posts-new-btn`, `posts-title-input`, `posts-slug-input`,
        // `posts-save-btn` testids on the post editor.
        await adminPage.goto('/admin/content/posts');
        await adminPage.getByTestId('posts-new-btn').click();
        await adminPage.getByTestId('posts-title-input').fill(blog.title);
        await adminPage.getByTestId('posts-slug-input').fill(blog.slug);
        await adminPage.getByTestId('posts-save-btn').click();
        await expect(adminPage.getByText(blog.title)).toBeVisible({timeout: 10_000});
    });
});
