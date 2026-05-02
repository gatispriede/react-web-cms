import {test, expect} from '../fixtures/auth';

// ──────────────────────────────────────────────────────────────────
// FEATURE — AI Agent chat panel  (/admin/system/agent)
//
// All tests mock /api/agent/stream with a deterministic SSE response
// so they run in full isolation — no Anthropic key or Ollama instance
// required.  The mock is set up before navigation so the very first
// POST the panel fires is already intercepted.
//
// Coverage matrix:
//   content mode  + auto model      — text event → agent bubble
//   content mode  + claude-sonnet   — explicit model in POST body
//   both mode     + auto model      — tool_call + tool_result (white-box)
//   ollama qwen   model selection   — request body model field
//   ollama hermes model selection   — request body model field
//   error event                     — error bubble + status bar
//   cancel button                   — running → idle, status = "Cancelled"
//
// What this does NOT cover:
//   - real LLM responses (backend integration, covered by benchmark tests)
//   - filesystem / code tools (dev-mode only, not wired in admin panel)
// ──────────────────────────────────────────────────────────────────

// ── SSE helpers ───────────────────────────────────────────────────

/** Encode an array of AgentEvent objects as an SSE body string. */
function sseBody(events: object[]): string {
    return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
}

const TEXT_DONE_EVENTS = [
    { type: 'text', text: 'Here is what I found.' },
    { type: 'done', turns: 1, durationMs: 420 },
];

const TOOL_DONE_EVENTS = [
    { type: 'tool_call',   name: 'list_posts', input: { includeDrafts: true }, isWrite: false },
    { type: 'tool_result', name: 'list_posts', result: '[{"id":"1","slug":"hello","title":"Hello World","draft":false}]', isError: false },
    { type: 'text', text: 'You have 1 post: "Hello World".' },
    { type: 'done', turns: 2, durationMs: 980 },
];

const ERROR_EVENTS = [
    { type: 'error', message: 'Upstream model timeout' },
];

// ── Helpers ───────────────────────────────────────────────────────

/** Click an Ant Design Select and pick a labelled option from the dropdown. */
async function selectOption(page: import('@playwright/test').Page, testId: string, optionLabel: string) {
    await page.getByTestId(testId).click();
    // Options render in a popup appended to document.body
    await page.locator('.ant-select-dropdown').waitFor({state: 'visible', timeout: 5_000});
    await page.locator('.ant-select-item-option', {hasText: optionLabel}).click();
    await page.locator('.ant-select-dropdown').waitFor({state: 'hidden', timeout: 5_000});
}

/** Send a task and wait for the "done" info line to appear. */
async function sendTask(page: import('@playwright/test').Page, task: string) {
    await page.getByTestId('agent-task-input').fill(task);
    await page.getByTestId('agent-send-btn').click();
}

// ── Tests ─────────────────────────────────────────────────────────

test.describe('feature — AI Agent panel', () => {

    // ── content mode, auto model ──────────────────────────────────

    test('content mode / auto: text response renders in agent bubble', async ({adminPage}) => {
        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(TEXT_DONE_EVENTS),
        }));
        await adminPage.goto('/admin/system/agent');

        const panel = adminPage.getByTestId('agent-panel');
        await expect(panel).toBeVisible({timeout: 15_000});

        // Empty state shows before first message
        await expect(adminPage.getByTestId('agent-empty-state')).toBeVisible();

        await sendTask(adminPage, 'List all blog posts');

        // User bubble appears
        await expect(adminPage.getByText('List all blog posts')).toBeVisible({timeout: 5_000});

        // Agent text bubble appears
        await expect(adminPage.getByText('Here is what I found.')).toBeVisible({timeout: 10_000});

        // Done info line ✓
        await expect(adminPage.getByText(/✓ Done.*1 turn.*0\.4s/)).toBeVisible({timeout: 5_000});

        // Status bar reflects finish
        await expect(adminPage.getByTestId('agent-status')).toContainText('Finished in 0.4s');

        // Empty state gone
        await expect(adminPage.getByTestId('agent-empty-state')).toHaveCount(0);
    });

    // ── content mode, claude-sonnet explicit model ────────────────

    test('content mode / claude-sonnet: model sent in POST body', async ({adminPage}) => {
        let capturedBody: Record<string, unknown> | null = null;

        await adminPage.route('**/api/agent/stream', async route => {
            const req  = route.request();
            capturedBody = JSON.parse(await req.postData() ?? '{}');
            await route.fulfill({
                status:      200,
                contentType: 'text/event-stream',
                body:        sseBody(TEXT_DONE_EVENTS),
            });
        });

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await selectOption(adminPage, 'agent-model-select', 'Claude Sonnet');
        await sendTask(adminPage, 'Summarise the site');

        await expect(adminPage.getByText(/✓ Done/)).toBeVisible({timeout: 10_000});

        expect(capturedBody?.model).toBe('claude-sonnet-4-5');
        expect(capturedBody?.mode).toBe('content');
        expect(capturedBody?.task).toBe('Summarise the site');
    });

    // ── both mode, auto model (white-box tool call/result) ────────

    test('both mode / auto: tool_call and tool_result render correctly', async ({adminPage}) => {
        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(TOOL_DONE_EVENTS),
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await selectOption(adminPage, 'agent-mode-select', 'Content + tools');

        let capturedMode: string | null = null;
        adminPage.on('request', req => {
            if (req.url().includes('/api/agent/stream') && req.method() === 'POST') {
                capturedMode = JSON.parse(req.postData() ?? '{}').mode;
            }
        });

        await sendTask(adminPage, 'How many posts do I have?');

        // Tool call row — READ tag + tool name
        const toolRow = adminPage.locator('[data-testid="agent-messages"] > div').filter({
            has: adminPage.locator('text=list_posts'),
        }).first();
        await expect(toolRow).toBeVisible({timeout: 10_000});
        await expect(toolRow.getByText('READ')).toBeVisible();
        await expect(toolRow.getByText('list_posts')).toBeVisible();

        // Expand to check result
        await toolRow.click();
        // Input section shows after expand
        await expect(toolRow.locator('pre')).toContainText('includeDrafts');

        // Result section shows (green text = no error)
        await expect(toolRow.locator('div').last()).toContainText('Hello World');

        // Agent text after tool
        await expect(adminPage.getByText('You have 1 post: "Hello World".')).toBeVisible();

        // Done — 2 turns
        await expect(adminPage.getByText(/✓ Done.*2 turns/)).toBeVisible({timeout: 5_000});

        // POST body mode was 'both'
        expect(capturedMode).toBe('both');
    });

    // ── write tool renders WRITE tag ──────────────────────────────

    test('both mode: write tool renders WRITE tag', async ({adminPage}) => {
        const writeToolEvents = [
            { type: 'tool_call',   name: 'save_post', input: { slug: 'test', title: 'Test', body: '<p>Hi</p>' }, isWrite: true },
            { type: 'tool_result', name: 'save_post', result: '{"id":"abc123"}', isError: false },
            { type: 'done', turns: 1, durationMs: 210 },
        ];

        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(writeToolEvents),
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await selectOption(adminPage, 'agent-mode-select', 'Content + tools');
        await sendTask(adminPage, 'Create a test post');

        const toolRow = adminPage.locator('[data-testid="agent-messages"] > div').filter({
            has: adminPage.locator('text=save_post'),
        }).first();
        await expect(toolRow).toBeVisible({timeout: 10_000});
        await expect(toolRow.getByText('WRITE')).toBeVisible();
    });

    // ── Ollama qwen model selection ───────────────────────────────

    test('ollama qwen2.5:32b: model sent in POST body', async ({adminPage}) => {
        let capturedModel: string | null = null;

        await adminPage.route('**/api/agent/stream', async route => {
            capturedModel = JSON.parse(await route.request().postData() ?? '{}').model;
            await route.fulfill({
                status:      200,
                contentType: 'text/event-stream',
                body:        sseBody(TEXT_DONE_EVENTS),
            });
        });

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await selectOption(adminPage, 'agent-model-select', 'Ollama qwen2.5:32b');
        await sendTask(adminPage, 'List pages');

        await expect(adminPage.getByText(/✓ Done/)).toBeVisible({timeout: 10_000});
        expect(capturedModel).toBe('qwen2.5:32b');
    });

    // ── Ollama hermes model selection ─────────────────────────────

    // ── Ollama qwen2.5:14b model selection ───────────────────────

    test('ollama qwen2.5:14b: model sent in POST body', async ({adminPage}) => {
        let capturedModel: string | null = null;

        await adminPage.route('**/api/agent/stream', async route => {
            capturedModel = JSON.parse(await route.request().postData() ?? '{}').model;
            await route.fulfill({
                status:      200,
                contentType: 'text/event-stream',
                body:        sseBody(TEXT_DONE_EVENTS),
            });
        });

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await selectOption(adminPage, 'agent-model-select', 'Ollama qwen2.5:14b');
        await sendTask(adminPage, 'List pages');

        await expect(adminPage.getByText(/✓ Done/)).toBeVisible({timeout: 10_000});
        expect(capturedModel).toBe('qwen2.5:14b');
    });

    // ── auto model sends null in POST body ────────────────────────

    test('auto model: null model field in POST body', async ({adminPage}) => {
        let capturedModel: unknown = 'UNSET';

        await adminPage.route('**/api/agent/stream', async route => {
            capturedModel = JSON.parse(await route.request().postData() ?? '{}').model;
            await route.fulfill({
                status:      200,
                contentType: 'text/event-stream',
                body:        sseBody(TEXT_DONE_EVENTS),
            });
        });

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        // Default is Auto — no model change needed
        await sendTask(adminPage, 'Summarise');
        await expect(adminPage.getByText(/✓ Done/)).toBeVisible({timeout: 10_000});

        // Auto sends null so the backend falls back to its own default
        expect(capturedModel).toBeNull();
    });

    // ── error event ───────────────────────────────────────────────

    test('error event: error bubble and status bar shown', async ({adminPage}) => {
        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(ERROR_EVENTS),
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await sendTask(adminPage, 'Do something');

        // Error info line (red ✗ text)
        await expect(adminPage.getByText(/✗ Upstream model timeout/)).toBeVisible({timeout: 10_000});

        // Status bar shows error
        await expect(adminPage.getByTestId('agent-status'))
            .toContainText('Error: Upstream model timeout', {timeout: 5_000});

        // Input re-enabled after error (send btn stays disabled until text entered — input is empty)
        await expect(adminPage.getByTestId('agent-task-input')).not.toBeDisabled({timeout: 3_000});
    });

    // ── HTTP error (non-200) ──────────────────────────────────────

    test('HTTP 500: error message surfaced in chat', async ({adminPage}) => {
        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status: 500,
            body:   'Internal Server Error',
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await sendTask(adminPage, 'Do something');

        await expect(adminPage.getByText(/✗ HTTP 500/)).toBeVisible({timeout: 10_000});
    });

    // ── cancel button ─────────────────────────────────────────────

    test('cancel button: aborts in-flight request and resets UI', async ({adminPage}) => {
        // Delay the response long enough for the cancel button to appear
        await adminPage.route('**/api/agent/stream', async route => {
            await new Promise(resolve => setTimeout(resolve, 5_000));
            await route.fulfill({
                status:      200,
                contentType: 'text/event-stream',
                body:        sseBody(TEXT_DONE_EVENTS),
            });
        });

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await sendTask(adminPage, 'Take a long time');

        // Cancel button appears while running
        const cancelBtn = adminPage.getByTestId('agent-cancel-btn');
        await expect(cancelBtn).toBeVisible({timeout: 5_000});
        await cancelBtn.click();

        // Button disappears; input re-enabled (send btn stays disabled — input is empty after send)
        await expect(cancelBtn).toHaveCount(0, {timeout: 5_000});
        await expect(adminPage.getByTestId('agent-task-input')).not.toBeDisabled({timeout: 3_000});

        // Status bar shows Cancelled
        await expect(adminPage.getByTestId('agent-status')).toContainText('Cancelled', {timeout: 3_000});
    });

    // ── send disabled while input empty ──────────────────────────

    test('send button disabled when input is empty', async ({adminPage}) => {
        // No route mock needed — button should never fire
        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        // Initially empty → disabled
        await expect(adminPage.getByTestId('agent-send-btn')).toBeDisabled();

        // Type something → enabled
        await adminPage.getByTestId('agent-task-input').fill('hello');
        await expect(adminPage.getByTestId('agent-send-btn')).not.toBeDisabled();

        // Clear → disabled again
        await adminPage.getByTestId('agent-task-input').fill('');
        await expect(adminPage.getByTestId('agent-send-btn')).toBeDisabled();
    });

    // ── Enter key sends the message ───────────────────────────────

    test('Enter key sends message; Shift+Enter inserts newline', async ({adminPage}) => {
        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(TEXT_DONE_EVENTS),
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        const input = adminPage.getByTestId('agent-task-input');

        // Shift+Enter should NOT send
        await input.fill('Line one');
        await input.press('Shift+Enter');
        // Input still has focus and hasn't cleared
        await expect(input).toBeFocused();

        // Clear and type a real message, then press Enter to send
        await input.fill('Quick question');
        await input.press('Enter');

        // User bubble appears → message was sent
        await expect(adminPage.getByText('Quick question')).toBeVisible({timeout: 5_000});
        await expect(adminPage.getByText(/✓ Done/)).toBeVisible({timeout: 10_000});
    });

    // ── warn event ────────────────────────────────────────────────

    test('warn event: yellow warning line in message list', async ({adminPage}) => {
        const warnEvents = [
            { type: 'warn', message: 'Hit 30-turn limit.' },
            { type: 'done', turns: 30, durationMs: 12_000 },
        ];

        await adminPage.route('**/api/agent/stream', route => route.fulfill({
            status:      200,
            contentType: 'text/event-stream',
            body:        sseBody(warnEvents),
        }));

        await adminPage.goto('/admin/system/agent');
        await expect(adminPage.getByTestId('agent-panel')).toBeVisible({timeout: 15_000});

        await sendTask(adminPage, 'Very long task');

        await expect(adminPage.getByText(/⚠ Hit 30-turn limit/)).toBeVisible({timeout: 10_000});
        await expect(adminPage.getByText(/✓ Done.*30 turns/)).toBeVisible({timeout: 5_000});
    });
});
