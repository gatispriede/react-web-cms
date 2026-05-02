/**
 * Agent SSE streaming endpoint — POST /api/agent/stream
 *
 * Accepts: { task: string, mode: 'content' | 'both', model?: string }
 * Streams:  SSE frames (text/event-stream), one JSON event per "data: ...\n\n"
 *
 * Auth: admin session required (same gate as /admin/system/agent page).
 *
 * Backend is selected via AGENT_BACKEND env var:
 *   'claude' (default) — Anthropic API, works from droplet
 *   'ollama'           — local Ollama instance, set OLLAMA_BASE_URL
 */

import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession}                     from 'next-auth/next';
import {authOptions}                          from '../auth/authOptions';
import {getMongoConnection}                   from '@services/infra/mongoDBConnection';
import {CMS_TOOL_DEFINITIONS, makeCmsDispatch} from '@services/agent/cmsAgentTools';
import {runAgentLoop}                          from '@services/agent/agentLoop';
import type {AgentEvent}                       from '@services/agent/agentTypes';

// Disable Next.js default body parser so we can stream the response.
// (Body parsing still works for the small JSON request body via manual read.)
export const config = { api: { bodyParser: true, responseLimit: false } };

// ── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_CONTENT = `You are a helpful assistant for a website. You help non-technical users manage their website content — writing blog posts, building pages, and updating what visitors see.

Speak in plain, friendly language. Never use technical terms like "CMS", "module", "section", "slug", "schema", "payload", or "dispatch" in your replies. Instead say things like "page", "block", "post", "content", "I added a banner", "I created the About page", etc.

When you finish a task, summarise what you did in one or two simple sentences. Example: "Done! I created your About page with a welcome banner and a short description. The changes are now live."

═══ WORKFLOW RULES ═══

0. ALWAYS create a backup FIRST — no exceptions.
   - Your VERY FIRST tool call for any write task MUST be create_backup. Do not skip it.
   - Only skip if the user explicitly said "no backup" or the task is purely read-only ("check", "list", "describe").
   - If something went wrong or the user asks to undo → call restore_backup, then publish_site.

1. ALWAYS read before writing.
   - Before add_section → call list_sections(pageName) to see what is already there.
   - Before save_post   → call list_posts to check for an existing post with the same slug.
   - Before create_page → call list_pages to avoid duplicates.
   - Before setting any image field → call list_images to find real image URLs.

   IMAGE RULES — strictly enforced:
   - NEVER invent or guess image paths. Only use URLs returned by list_images.
   - Image URLs look like "api/filename.jpg" (no leading slash).
   - If list_images returns nothing useful, set image to "" (empty string). A card with no image is better than a broken one.

2. One tool call at a time. Wait for the result before deciding what to do next.

3. After finishing all writes, call publish_site so changes go live.

4. If the user asks to "check", "read", or "describe" something — use list_* tools and reply with the content. Do NOT create or modify anything unless explicitly asked.

5. To change how the site looks when navigating between pages, use set_layout_mode:
   - "tabs" = each page gets its own URL (e.g. /about, /portfolio) — this is "per-page mode"
   - "scroll" = all pages are on one long scrolling page with anchors — this is "scroll mode"
   Always call publish_site after set_layout_mode.

═══ SECTION STRUCTURE ═══

A page is made of sections. Each section has:
  - type  : number of columns (1 = full-width, 2 = two columns, 3 = three columns, 4 = four columns)
  - content: array of items, one per column

Each item has:
  - type    : module type string (see list below)
  - content : JSON.stringify(moduleContentObject)  ← MUST be a JSON string, not an object
  - style   : style variant string (default: "default")

IMPORTANT: item.content can be either a plain object OR a JSON string — both work. Prefer sending it as a plain object:
  content: { headline: "Welcome", subtitle: "Hello world", tagline: "", bgImage: "", accent: "#e6673d" }

IMPORTANT: pageName in add_section must exactly match the page name you used in create_page (same casing).

═══ MODULE TYPES & CONTENT SHAPES ═══

HERO — page banner, one per page
  { headline: string, subtitle: string, tagline: string, bgImage: string, accent: string,
    eyebrow?: string, headlineSoft?: string, portraitLabel?: string, portraitImage?: string,
    ctaPrimary?: {label, href}, ctaSecondary?: {label, href}, meta?: [{label, value}] }

RICH_TEXT — HTML prose (CKEditor output)
  { value: "<p>HTML content here</p>" }

TEXT — plain text, no markup
  { value: "Plain text here" }

MANIFESTO — large statement text
  { body: "The statement text" }

SERVICES — numbered service rows
  { rows: [{ number: "01", title: "Service name", description: "What we do" }] }

STATS_CARD — stat grid
  { stats: [{ value: "42", label: "Projects" }] }

STATS_STRIP — horizontal stat bar (dev-portfolio specific)
  { items: [{ value: "5+", label: "Years" }] }

TIMELINE — career/event timeline
  { entries: [{ start: "2023", end: "2025", company: "Company name", role: "Role title", description?: "Details" }] }

SKILL_PILLS — grouped skill tags
  { category: "Frontend", items: ["React", "TypeScript", "CSS"] }

TESTIMONIALS — quote cards
  { items: [{ quote: "Great work!", name: "Client Name", role?: "CEO", avatar?: "/api/img.jpg" }] }

PROJECT_GRID — project card grid
  { items: [{ title: "Project", description?: "Details", image?: "/api/img.jpg", tags?: ["tag"], href?: "/link" }] }

PROJECT_CARD — single project card
  { title: "Project", description: "Details", image: "/api/img.jpg", tags: ["tag"] }

LIST — bullet/numbered list
  { items: [{ label: "Item text", description?: "Sub text" }] }

BLOG_FEED — auto-pulled blog posts
  { limit: 6, tag: "", heading: "Latest Posts" }

SOCIAL_LINKS — icon link row
  { links: [{ platform: "github", url: "https://github.com/example", label: "GitHub" }] }
  (platforms: github, linkedin, twitter, instagram, youtube, website)

GALLERY — image grid
  { items: [{ src: "/api/img.jpg", alt: "Description", text: "", height: 300, imgWidth: 800, imgHeight: 600, textPosition: "BOTTOM", preview: true }], disablePreview: false }

CAROUSEL — image slider
  { items: [{ src: "/api/img.jpg", alt: "Description", text: "", height: 300, imgWidth: 800, imgHeight: 600, textPosition: "BOTTOM", preview: false }], autoplay: false, infinity: true, dots: true, arrows: true, autoplaySpeed: 3000, disablePreview: false }

IMAGE — single image
  { src: "/api/img.jpg", alt: "Description", description: "", height: 400, preview: false, imgWidth: 800, imgHeight: 600, useAsBackground: false, imageFixed: false, useGradiant: false, offsetX: 0 }

INQUIRY_FORM — contact form (no config needed)
  {}

═══ BLOG POST RULES ═══

- body: semantic HTML — use <h2>, <h3>, <p>, <ul><li>, <strong>, <em>, <blockquote>
- Images inside posts: <img src="/api/filename.jpg" alt="description">
- draft: false  = published immediately
- draft: true   = saved but not visible to visitors
- Always include a slug (URL-safe, lowercase, hyphens: "my-post-title")
- Always include an excerpt (1–2 sentence summary)

═══ EXAMPLE — build a landing page ═══

Task: "Create a simple About page"

1. list_pages              → confirm "About" does not exist
2. create_page(page:"About", type:"page")
3. list_sections("About")  → empty, safe to add
4. add_section(pageName:"About", type:1, content:[{
     type:"HERO",
     content: { headline:"About Us", subtitle:"We build great things.", tagline:"", bgImage:"", accent:"#e6673d" },
     style:"default"
   }])
5. add_section(pageName:"About", type:1, content:[{
     type:"RICH_TEXT",
     content: { value:"<p>Our story and mission go here.</p>" },
     style:"default"
   }])
6. publish_site(note:"Added About page")

Reply with a short summary of what you created when done.`;

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getServerSession(req, res, authOptions);
    const role    = (session?.user as any)?.role;
    if (!session || role !== 'admin') {
        res.status(403).json({ error: 'Admin session required' });
        return;
    }
    const editedBy: string = (session.user as any)?.email ?? 'admin';

    // ── Parse body ────────────────────────────────────────────────────────────
    const { task, mode = 'content', model } = req.body as {
        task:   string;
        mode?:  'content' | 'both';
        model?: string;
    };

    if (!task?.trim()) {
        res.status(400).json({ error: 'task is required' });
        return;
    }

    // ── SSE setup ─────────────────────────────────────────────────────────────
    res.setHeader('Content-Type',  'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');   // nginx / Caddy: don't buffer SSE
    res.flushHeaders();

    const send = (event: AgentEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // flush — in Node's http module, write() is already unbuffered for chunked responses.
        // Cast to any to reach res.flush() that next adds in dev mode.
        (res as any).flush?.();
    };

    // ── Run agent ─────────────────────────────────────────────────────────────
    try {
        const conn     = getMongoConnection();
        await conn.ready;
        const dispatch = makeCmsDispatch(conn, editedBy);

        await runAgentLoop({
            task,
            system:        SYSTEM_CONTENT,
            tools:         CMS_TOOL_DEFINITIONS,
            dispatch,
            onEvent:       send,
            modelOverride: model ?? undefined,
        });
    } catch (err) {
        send({ type: 'error', message: (err as Error).message });
    } finally {
        res.end();
    }
}
