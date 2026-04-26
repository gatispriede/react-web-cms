"""
Re-align the funisimo.pro Home page CV content with the v8 CV revision.

Reads `public/CV/v6.json`, edits the Home page sections that hold the CV
content (hero titles, vitals dl, the two skill matrices, the platforms dl,
and the career timeline), and writes the result to `public/CV/v7.json`.
The original v6 stays untouched so it remains a clean snapshot of what's
currently live on funisimo.pro.

Why a script and not in-place edits to the bundle in the editor: the
bundle is ~50MB; modifying nested JSON-in-JSON-string fields by hand is
error-prone. A script keeps the transform reproducible and lets us re-run
it against future bundle exports.
"""

import json
import os

SRC = r"D:/Work/redis-node-js-cloud/public/CV/v6.json"
OUT = r"D:/Work/redis-node-js-cloud/public/CV/v7.json"


def main() -> int:
    with open(SRC, "r", encoding="utf-8") as f:
        bundle = json.load(f)

    secs = bundle["site"].get("sections", [])
    by_id: dict = {}
    for s in secs:
        by_id.setdefault(s.get("id"), []).append(s)

    def find_one(sid, predicate):
        """Return the (section, item) pair where item['type'] matches the
        predicate. Returns (None, None) if not found."""
        for s in by_id.get(sid, []):
            for item in s.get("content", []):
                if predicate(item):
                    return s, item
        return None, None

    def patch(item, transform):
        """Parse the inner JSON string, mutate via transform, re-stringify
        with ensure_ascii=False so smart quotes / em-dashes survive."""
        obj = json.loads(item["content"])
        transform(obj)
        item["content"] = json.dumps(obj, ensure_ascii=False)

    # --- 1. HERO ----------------------------------------------------------
    sec, item = find_one("cv-sec-home-hero", lambda i: i.get("type") == "HERO")

    def upd_hero(obj):
        # Match v8 CV target roles: TC / SE / TPM. Drop principal/architect
        # which were in the previous trio but no longer in scope.
        obj["titles"] = [
            "Technical Consultant",
            "Senior Engineer",
            "Technical Project Manager",
        ]
        # Motto removed everywhere (PDF/Word/site) for tonal consistency.
        obj["tagline"] = ""
        obj["taglineAttribution"] = ""
        # Eyebrow gets the EU/timezone marker so first-glance recruiters
        # see the geo without scrolling to vitals.
        obj["eyebrow"] = "DOSSIER № 001 / SIGULDA, LATVIA / EST. 2009 / EU · GMT+2/+3"

    patch(item, upd_hero)

    # --- 2. VITALS DL -----------------------------------------------------
    sec, item = find_one(
        "cv-sec-home-vitals", lambda i: i.get("type") == "RICH_TEXT"
    )

    def upd_vitals(obj):
        obj["value"] = (
            "<dl class=\"hero-vitals\">"
            "<dt>Based</dt><dd>Sigulda, Latvia (EU)</dd>"
            "<dt>Years</dt><dd>15+ in digital</dd>"
            "<dt>Mode</dt><dd>Remote-first · Contract or permanent</dd>"
            "<dt>Stack</dt><dd>TypeScript · React · Next.js · .NET · gRPC · Claude Code</dd>"
            "</dl>"
        )

    patch(item, upd_vitals)

    # --- 3. CORE DELIVERY SKILLS ----------------------------------------
    sec, item = find_one(
        "cv-sec-home-matrix-row1", lambda i: i.get("type") == "SKILL_PILLS"
    )

    def upd_core(obj):
        obj["category"] = "Core delivery"
        obj["categoryMeta"] = "09 entries"
        obj["items"] = [
            {"label": "TypeScript · JavaScript · Node", "score": 9.8, "featured": True},
            {"label": "React · Next.js · SSR / ISR", "score": 9.5, "featured": True},
            {"label": ".NET microservices · YARP · gRPC", "score": 9.0, "featured": True},
            {"label": "GraphQL · REST · schema-first", "score": 8.8},
            {"label": "Webpack Module Federation · micro-frontends", "score": 8.5},
            {"label": "3D / WebGL / WebAssembly · SciChart · large data", "score": 8.5},
            {"label": "TDD · unit / integration / e2e", "score": 8.2},
            {"label": "Docker · Kubernetes · Terraform · CI/CD", "score": 8.0},
            {"label": "Observability · Prometheus · Grafana", "score": 7.5},
        ]

    patch(item, upd_core)

    # --- 3b. LANGUAGES DL (sits beside the core pills) ------------------
    sec, item = find_one(
        "cv-sec-home-matrix-row1", lambda i: i.get("type") == "RICH_TEXT"
    )

    def upd_langs(obj):
        # Greek dropped (low-signal A2 noise per CV review). Russian
        # downgraded to "conversational" to match the v8 CV scoring.
        obj["value"] = (
            "<h4>Languages — spoken &amp; written</h4>"
            "<dl>"
            "<dt>Latvian</dt><dd>10 / 10 · native</dd>"
            "<dt>English</dt><dd>9 / 9 · proficient (C1)</dd>"
            "<dt>Russian</dt><dd>5 / 3 · conversational</dd>"
            "<dt>German</dt><dd>3 / 4 · basic</dd>"
            "</dl>"
        )

    patch(item, upd_langs)

    # --- 4. LEADERSHIP & DELIVERY PILLS ---------------------------------
    sec, item = find_one(
        "cv-sec-home-matrix-row2", lambda i: i.get("type") == "SKILL_PILLS"
    )

    def upd_lead(obj):
        # Renamed to match the v8 CV section heading and reorder so TPM
        # signal (Sapiens credentials) leads.
        obj["category"] = "Leadership & delivery"
        obj["categoryMeta"] = "07 entries"
        obj["items"] = [
            {"label": "Technical project management (TPM)", "score": 9.0, "featured": True},
            {"label": "Distributed teams · 11+ countries", "score": 8.8, "featured": True},
            {"label": "Stakeholder & client engagement · C-level", "score": 8.8},
            {"label": "Agile · Scrum-of-Scrums · Scrum Master", "score": 8.5},
            {"label": "Risk handling · RAID logs · change-control", "score": 8.2},
            {"label": "Consulting deliverables · ADRs · scoping docs", "score": 8.5},
            {"label": "Mentoring · morale recovery · BA / eng bridge", "score": 8.0},
        ]

    patch(item, upd_lead)

    # --- 4b. OWN WORK LIST ----------------------------------------------
    sec, item = find_one(
        "cv-sec-home-matrix-row2", lambda i: i.get("type") == "LIST"
    )

    def upd_own(obj):
        # Reorder so the actively-developed CMS comes first, JF (archived
        # early-career project) goes to the tail.
        obj["title"] = "Own work"
        obj["items"] = [
            {
                "label": "react-web-cms",
                "value": (
                    "Active — powers funisimo.pro · designed AI-friendly: "
                    "typed schemas, single-bundle export, role-gated mutations"
                ),
                "href": "https://github.com/gatispriede/react-web-cms",
            },
            {
                "label": "LegalStableSure",
                "value": "Mobile app — in market · legalstablesure.com ↗",
                "href": "https://legalstablesure.com",
            },
            {
                "label": "JF",
                "value": "JS framework / library — archived early-career project",
                "href": "https://github.com/gatispriede/JF",
            },
        ]

    patch(item, upd_own)

    # --- 5. PLATFORMS / TOOLING / OTHER ---------------------------------
    sec, item = find_one(
        "cv-sec-home-matrix-platforms", lambda i: i.get("type") == "RICH_TEXT"
    )

    def upd_platforms(obj):
        # Brought in line with v8 Technical Stack: added Kubernetes,
        # Terraform, PostgreSQL, Kafka, Keycloak, Claude Code, MCP,
        # Prometheus, Grafana. Dropped Handlebars, Bootstrap, Jasmine,
        # CouchDB (no longer signal-relevant).
        obj["value"] = (
            "<h4>Platforms · tooling · other</h4>"
            "<dl>"
            "<dt>Cloud &amp; infra</dt><dd>AWS · Azure · Docker · Kubernetes · Terraform · HAProxy · Linux</dd>"
            "<dt>Data</dt><dd>PostgreSQL · MongoDB · Redis · SQLite · MySQL · Elasticsearch · Kafka</dd>"
            "<dt>Auth</dt><dd>Keycloak (OAuth / OIDC) · NextAuth · SSO · RBAC · progressive lockout</dd>"
            "<dt>AI tooling</dt><dd>Claude (API + Code) · MCP · context engineering · agentic workflows · RAG · LLMOps / AgentOps</dd>"
            "<dt>Languages</dt><dd>TypeScript · JavaScript · Node · C# / .NET · Python · Bash · SQL · PHP · Java · Go · C++</dd>"
            "<dt>Build &amp; test</dt><dd>Webpack · Vite · Vitest · Jest · React Testing Library · Playwright</dd>"
            "<dt>Observability</dt><dd>Prometheus · Grafana · structured logging · dashboarding · alerting</dd>"
            "<dt>Specialist</dt><dd>WebGL · WebAssembly (Emscripten) · SciChart 2D / 3D · charting library dev</dd>"
            "</dl>"
        )

    patch(item, upd_platforms)

    # --- 6. CAREER TIMELINE — refresh SciChart and Sapiens entries -----
    sec, item = find_one(
        "cv-sec-home-career-timeline", lambda i: i.get("type") == "TIMELINE"
    )

    def upd_timeline(obj):
        for e in obj.get("entries", []):
            if e.get("company") == "SciChart":
                e["role"] = "Consultant"
                e["experience"] = [
                    "Direct contributor to SciChart.js — commercial WebGL / WebAssembly charting library",
                    "Full-stack on enterprise industrial-software platform: React / TypeScript MFE + .NET / YARP backend over gRPC",
                    "Front-end, back-end, and UX work · Kendo React · OAuth / OIDC · gRPC-Web · .NET services",
                    "Customer engagement and architecture consulting across finance, scientific, engineering domains",
                ]
                e["achievements"] = [
                    "Pioneered AI-augmented workflows — authored Claude Code skills and team-wide CLAUDE.md standards",
                    "WebAssembly build pipeline (Emscripten) · memory test harnesses · cross-platform release tooling",
                ]
                e["quote"] = "Designing systems and data shapes that are friendly to AI consumption."
            elif e.get("company") == "Sapiens":
                e["role"] = "Technical Project Manager"
                e["experience"] = [
                    "Cross-functional delivery cadence · sprint planning · risk reviews · steering-committee briefings",
                    "Distributed teams across 11+ countries spanning customer, BA, devops, engineering tracks",
                    "Authored discovery / scoping / architecture-decision documents for client onboarding",
                    "Owned devops oversight, resource & stakeholder management, BA / engineering bridge",
                    "Tooling: Jira, Confluence, Azure DevOps · introduced delivery dashboards for in-flight metrics",
                ]
                e["achievements"] = [
                    "Delivered 3 client engagements end-to-end in regulated insurance domain",
                    "Surfaced risks ahead of schedule slippage via RAID logs and change-control gates",
                ]

    patch(item, upd_timeline)

    # --- 7. Bump version on every edited section so the CMS audit trail
    # reflects the change. Use the touched-section ids gathered above.
    edited_ids = {
        "cv-sec-home-hero",
        "cv-sec-home-vitals",
        "cv-sec-home-matrix-row1",
        "cv-sec-home-matrix-row2",
        "cv-sec-home-matrix-platforms",
        "cv-sec-home-career-timeline",
    }
    from datetime import datetime, timezone

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for s in secs:
        if s.get("id") in edited_ids:
            s["version"] = (s.get("version") or 0) + 1
            s["editedAt"] = now_iso
            s["editedBy"] = "cv-update-script"

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(bundle, f, ensure_ascii=False)

    print(f"Wrote {OUT}")
    print(f"  source:  {os.path.getsize(SRC):>11,} bytes")
    print(f"  output:  {os.path.getsize(OUT):>11,} bytes")
    print(f"  edited:  {len(edited_ids)} sections")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
