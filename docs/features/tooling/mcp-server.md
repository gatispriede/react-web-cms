# CMS AI Bridge — CLI first, MCP second

Status: Planned
Last updated: 2026-04-29

---

## What it is

A CLI tool that exposes CMS operations as shell commands. Any AI agent that can run a shell command can use it — no protocol setup, no SDK, no transport configuration. The CLI is the primary interface; MCP is a second transport that wraps the same logic for clients that support it natively (Claude Code, Cursor).

---

## The flagship workflow

```bash
$ cms page scaffold "Homepage with hero headline, short intro, and a three-column stats block"
$ cms theme set dark
$ cms site revalidate
```

Three commands. A ready homepage, themed and live. That is the thing this feature must deliver.

---

## Architecture

```
services/features/CmsAi/
├── handlers/           ← shared logic, called by both CLI and MCP
│   ├── pages.ts
│   ├── sections.ts
│   ├── modules.ts
│   ├── themes.ts
│   ├── site.ts
│   └── scaffold/
│       └── pageScaffold.ts   ← highest-value file — maps description → modules + content
├── cli/
│   └── index.ts        ← CLI entrypoint, thin wrapper over handlers/
└── mcp/
    └── index.ts        ← MCP server, thin wrapper over handlers/
```

**One rule:** no business logic in `cli/` or `mcp/`. Both are thin transport layers. All logic lives in `handlers/`.

---

## CLI — v1

### Installation / invocation

Registered as a `package.json` script and a local binary alias:

```bash
npm run cms -- <command>        # via npm
./bin/cms <command>             # direct (symlink to tools/cms-cli.ts, tsx)
```

For AI agents, the npm form is the reliable call:
```bash
npm run cms -- page scaffold "..."
```

### Commands

**Pages**
```bash
cms page list
cms page create <name>
cms page scaffold "<description>" [--theme <themeId>]
cms page delete <slug>
```

**Sections**
```bash
cms section list <pageSlug>
cms section add <pageSlug> <moduleType> [--style <style>] [--sample]
cms section update <sectionId> --content '<json>'
cms section delete <sectionId>
cms section move <sectionId> up|down
```

**Modules**
```bash
cms module types              # list all EItemType values + available styles
cms module describe <type>    # content schema + sample content for a module type
```

**Themes**
```bash
cms theme list
cms theme set <themeId>
```

**Site**
```bash
cms site settings
cms site revalidate [--slug <slug>]
```

**Blog**
```bash
cms post create --title "<title>" --body "<body>" [--excerpt "..."] [--publish]
cms post list
cms post publish <slug>
cms post delete <slug>
```

**Bundle** — export the site state for backup / cross-environment moves; import to restore. Promoted to v1 (was out-of-scope) because the smoke chain depends on it and the import flow is now testid-instrumented end-to-end.
```bash
cms bundle export [--output <path>]                # download the canonical site bundle (defaults to stdout)
cms bundle import <file> [--confirm]               # restore a bundle. --confirm skips the destructive-action prompt
cms bundle status                                  # last export / last import metadata
```

The bundle import goes through the same admin UI path the e2e smoke chain exercises — `data-testid="bundle-import-file-input"` + `bundle-import-submit-btn` + `bundle-import-confirm-btn` (Popconfirm OK). AI clients can verify a successful import by following with `e2e.smoke` against the post-import state.

**E2E (Playwright)** — verify a change before pushing without leaving the AI session.
```bash
cms e2e list                                       # list available scenarios + specs
cms e2e smoke                                      # run the smoke chain (~30-90s, single worker)
cms e2e run <spec> [--workers <n>] [--headed]      # run a specific spec or test pattern
cms e2e status                                     # last-run summary: passed / failed / skipped + duration
cms e2e failures [--last]                          # failures from the last run, with trace artefact paths
cms e2e bundle:refresh                             # regenerate tests/e2e/fixtures/bundles/cv-latest.json
                                                   # from the current admin state
```

The `smoke` and `run` commands stream stdout/stderr from `playwright test` so the AI can see progress live. On failure, the JSON output (default) returns a structured failure report:

```json
{
    "ok": false,
    "scenario": "smoke",
    "passed": 7,
    "failed": 1,
    "skipped": 0,
    "durationMs": 41320,
    "failures": [
        {
            "spec": "tests/e2e/smoke/cv-bundle-chain.spec.ts",
            "test": "step 6 — upload sample-portrait.jpg",
            "error": "Locator: getByTestId('asset-picker-grid-row') resolved to 0 elements",
            "trace": "test-results/.../trace.zip",
            "screenshot": "test-results/.../test-failed-1.png"
        }
    ]
}
```

The `trace` and `screenshot` paths are relative to repo root — the AI client can read them via filesystem MCP tools or by asking the user to share.

### Output format

All commands output JSON by default — clean for AI agents to parse. Human-readable table output available with `--pretty`:

```bash
cms page list --pretty
cms module types --pretty
```

Errors write to stderr with a non-zero exit code so AI agents can detect failure without parsing output.

### Auth

Single env var checked on every invocation:

```
CMS_SECRET=<random-32-char-string>
```

The CLI reads this from the environment. When an AI agent invokes the CLI, it inherits the shell environment where the secret is set. No interactive login, no token files.

---

## `page scaffold` in detail

The flagship command. Takes a plain-language description and builds a ready page.

```bash
cms page scaffold "Services page with a grid of three service cards and a contact CTA at the bottom"
```

What happens:
1. Creates the page via `handlers/pages.ts`
2. Calls `module.listTypes` to get available module types + styles
3. `pageScaffold.ts` maps the description to a module sequence using keyword matching against module metadata
4. Creates each section with appropriate sample content
5. If `--theme` is provided and different from active, switches theme
6. Outputs the created page slug + section list as JSON

`pageScaffold.ts` is isolated deliberately — the mapping strategy will be iterated on. The first version uses keyword matching. Later versions can use an LLM call or a richer scoring model. The CLI and MCP layers never need to change when the scaffold logic improves.

**Sample content quality matters.** The sample content placed by scaffold is what a new user sees first. It needs to look credible, not Lorem Ipsum. Each module type should have 2–3 sample content variants in `handlers/scaffold/samples/` keyed by industry/tone hints in the description.

---

## MCP — v1 (after CLI is stable)

The MCP server wraps the same `handlers/` with MCP tool metadata. No new logic — every tool is a one-liner that calls the corresponding handler.

```
services/features/CmsAi/mcp/
├── index.ts            # boots stdio transport, registers tools + prompts + resources
├── tools/              # one file per domain — each tool calls handlers/
├── prompts/            # pre-baked workflows (build-page, build-site, switch-theme, add-blog-post)
└── resources/          # cms://pages, cms://module-types, cms://themes/active
```

Transport: **stdio only** in v1. Spawned as a child process by the MCP client. No HTTP, no network surface.

```
"mcp:stdio": "tsx services/features/CmsAi/mcp/index.ts"
```

Auth: same `CMS_SECRET` env var — the MCP server reads it at boot, checks it on each tool call.

### Why MCP on top of CLI

- Claude Code and Cursor get tool discovery, typed arg validation, and prompts
- The AI sees `page.scaffold` as a named tool with a description, not a raw shell command
- Prompts give the AI a starting point for multi-step workflows without the user needing to know the command sequence

---

## Module structure

```
services/features/CmsAi/
├── handlers/
│   ├── pages.ts
│   ├── sections.ts
│   ├── modules.ts
│   ├── themes.ts
│   ├── site.ts
│   ├── posts.ts
│   └── scaffold/
│       ├── pageScaffold.ts
│       └── samples/
│           ├── hero.ts
│           ├── stats.ts
│           ├── services.ts
│           └── ...
├── cli/
│   └── index.ts              # commander or yargs entrypoint
└── mcp/
    ├── index.ts
    ├── tools/
    ├── prompts/
    └── resources/

tools/
└── cms-cli.ts                # repo-root binary alias → services/features/CmsAi/cli/index.ts
```

---

## Build order

1. **`handlers/`** — implement and unit-test each handler against the real service layer
2. **`scaffold/pageScaffold.ts`** — implement + refine sample content, test with real module registry
3. **CLI** — wire handlers to commands, test end-to-end with `npm run cms -- page scaffold "..."`
4. **MCP** — wrap handlers in tools, register prompts + resources, test with Claude Code
5. **Docs** — `tools/mcp.example.json` Claude Code config, README with example commands

Each step is independently shippable. The CLI alone is useful before MCP exists.

---

## Out of scope — v1

- HTTP/SSE MCP transport
- Scope-based tokens and token management UI
- Products, inventory, translations commands
- Multi-tenant scoping
- Customer-facing operations

---

## Open questions

1. **Scaffold mapping strategy** — keyword matching is the fast first pass. Should the AI client pass explicit module types (`cms page scaffold --modules hero,stats,cta`) and scaffold just handles creation? Or does scaffold reason from the description and the AI confirms? Explicit modules is more reliable; description-driven is better UX. Probably both: description-driven with `--modules` override.

2. **Sample content variants** — how many variants per module type before it looks credible across different site types? Probably 3 per common module (hero, stats, richtext, services) and 1 for the rest to start.

3. **CLI framework** — `commander` is stable and minimal; `yargs` has more built-in help formatting. Either works; recommendation is `commander` — smaller, no magic.

4. **`post.create` body input** — long body content via CLI arg is awkward (`--body "..."` breaks on newlines). Options: read from stdin (`cms post create --title "..." < body.md`), or a `--file` flag. Stdin is the right call for AI agent use — the agent writes the body to a temp file or pipes it.

---

## Implementation status

Status as of 2026-04-29: **does not match this spec.**

A previous iteration of this spec (MCP-first, scoped tokens, admin token-issuance UI) was implemented and currently lives on disk:

- `services/features/Mcp/{McpServer.ts,McpTokenService.ts,types.ts,validate.ts,tools/*}` — 19 tools across 8 domains (pages/sections/modules/i18n/themes/products/inventory/site/audit), bcrypt-hashed `mcpsk_*` tokens with scope checks, JSON-Schema arg validation, 1:1 audit logging.
- `services/mcp/{stdio.ts,http.ts}` — stdio transport (real), HTTP transport (env-gated stub).
- `ui/admin/features/Mcp/McpTokensPanel.tsx` — admin token-issuance UI.
- `services/api/{schema.graphql,graphqlResolvers.ts,client/McpTokenApi.ts}` — admin GraphQL surface for token CRUD.
- `services/features/Auth/authz.ts` — admin gating on `mcpListTokens` / `mcpIssueToken` / `mcpRevokeToken`.
- 15 tests in `services/features/Mcp/{McpServer.test.ts,McpTokenService.test.ts}`.

The current spec (CLI-first, single `CMS_SECRET` env var, narrower tool surface, no token UI, `services/features/CmsAi/` layout, flagship `page scaffold`) requires either a refactor or a wholesale replacement.

**Suggested next steps:**

1. Decide: keep the existing token-server alongside the new CLI/CmsAi, or replace it. The existing MCP module is admin-gated and shipped; ripping it out costs the audit/scope features.
2. If replacing: move `tools/` logic into `services/features/CmsAi/handlers/`, add the CLI entrypoint, drop `McpTokenService` + admin UI, simplify auth to env-var. Write `pageScaffold.ts` and the sample-content library — that's the highest-value new code in the redesign.
3. If keeping both: rename the existing module to make the split clear (e.g. `services/features/McpAdmin/` for the scoped-token server, `services/features/CmsAi/` for the CLI-first path).
