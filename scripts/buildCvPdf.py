"""
Build a styled PDF CV from the v6+ markdown source.

Layout target: editorial single-column document, with two specific dense
sections (Candidate skills, Technical stack) rendered as auto-balanced
two-column blocks via reportlab's `BalancedColumns`. Everything else —
title, summary, personal info, own work, work experience, languages,
education, keywords — stays single-column for readability.

Visual language matches funisimo.pro:
  • cream-tinted page, single muted accent
  • small-caps section headers prefixed with a path-drawn diamond
  • technical-stack lists render as soft-tinted chips (not running prose)
  • work experience: stacked role blocks with KeepTogether on header +
    first bullet to prevent orphan titles
  • Times New Roman everywhere (registered TTF for full unicode)

Optional positional arg: source markdown path; the PDF lands beside it
with the same stem.
"""

import os
import re
import sys
from typing import List, Tuple

from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BalancedColumns,
    CondPageBreak,
    Flowable,
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_DEFAULT_SRC = r"D:\Work\redis-node-js-cloud\public\CV\Gatis Priede CV v6.md"
_DEFAULT_OUT = r"D:\Work\redis-node-js-cloud\public\CV\Gatis Priede CV v6.pdf"

SRC = sys.argv[1] if len(sys.argv) > 1 else _DEFAULT_SRC
OUT = (
    os.path.splitext(SRC)[0] + ".pdf"
    if len(sys.argv) > 1
    else _DEFAULT_OUT
)

# --- palette ---------------------------------------------------------------
PAGE_BG = HexColor("#faf8f3")
INK = HexColor("#1a1a1a")
MUTED = HexColor("#6b6b6b")
ACCENT = HexColor("#5e554b")
ACCENT_SOFT = HexColor("#efeae0")
RULE = HexColor("#d6cfbf")
LINK = HexColor("#34536e")

# --- font registration -----------------------------------------------------
_TTF_DIR = r"C:\Windows\Fonts"
_TTF_FILES = {
    "TimesNewRoman": "times.ttf",
    "TimesNewRoman-Bold": "timesbd.ttf",
    "TimesNewRoman-Italic": "timesi.ttf",
    "TimesNewRoman-BoldItalic": "timesbi.ttf",
}


def _register_times():
    try:
        for name, fname in _TTF_FILES.items():
            path = os.path.join(_TTF_DIR, fname)
            if not os.path.exists(path):
                return False
            pdfmetrics.registerFont(TTFont(name, path))
        from reportlab.pdfbase.pdfmetrics import registerFontFamily
        registerFontFamily(
            "TimesNewRoman",
            normal="TimesNewRoman",
            bold="TimesNewRoman-Bold",
            italic="TimesNewRoman-Italic",
            boldItalic="TimesNewRoman-BoldItalic",
        )
        return True
    except Exception as exc:
        print(f"[warn] Times TTF registration failed: {exc}", file=sys.stderr)
        return False


_HAS_TTF = _register_times()
FONT_NORMAL = "TimesNewRoman" if _HAS_TTF else "Times-Roman"
FONT_BOLD = "TimesNewRoman-Bold" if _HAS_TTF else "Times-Bold"
FONT_ITALIC = "TimesNewRoman-Italic" if _HAS_TTF else "Times-Italic"
FONT_BOLDITALIC = "TimesNewRoman-BoldItalic" if _HAS_TTF else "Times-BoldItalic"

# Sections whose body content is rendered as auto-balanced 2-column block.
TWO_COL_SECTIONS = {"candidate skills", "technical stack"}

# h3 sub-section labels under "Technical stack" that should render as chips.
CHIP_LABELS = {
    "languages",
    "front-end & mobile",
    "back-end, apis & data",
    "cloud, infrastructure & tooling",
    "ai tooling",
    "specialist areas",
}

# --- styles ----------------------------------------------------------------


def make_styles():
    base = getSampleStyleSheet()["Normal"]
    body_common = dict(
        fontName=FONT_NORMAL,
        fontSize=9.6,
        leading=12,
        alignment=TA_LEFT,
        textColor=INK,
    )
    return {
        "title": ParagraphStyle(
            "title",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=26,
            leading=30,
            textColor=INK,
            spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base,
            fontName=FONT_ITALIC,
            fontSize=10.5,
            leading=14,
            textColor=MUTED,
            spaceAfter=2,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10,
            leading=14,
            textColor=ACCENT,
            spaceBefore=12,
            spaceAfter=2,
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base,
            fontName=FONT_BOLDITALIC,
            fontSize=10.8,
            leading=14,
            textColor=INK,
            spaceBefore=6,
            spaceAfter=1,
        ),
        "h4": ParagraphStyle(
            "h4",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10.5,
            leading=13,
            textColor=INK,
            spaceBefore=4,
            spaceAfter=1,
        ),
        "body": ParagraphStyle("body", parent=base, **body_common, spaceAfter=3),
        "summary": ParagraphStyle(
            "summary",
            parent=base,
            fontName=FONT_NORMAL,
            fontSize=10.2,
            leading=13.5,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=3,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base,
            **body_common,
            leftIndent=10,
            bulletIndent=1,
            spaceAfter=0.5,
        ),
        "table_label": ParagraphStyle(
            "table_label",
            parent=base,
            fontName=FONT_ITALIC,
            fontSize=9.2,
            leading=11.5,
            textColor=MUTED,
        ),
        "table_value": ParagraphStyle(
            "table_value",
            parent=base,
            fontName=FONT_NORMAL,
            fontSize=9.6,
            leading=11.5,
            textColor=INK,
        ),
        "small_italic": ParagraphStyle(
            "small_italic",
            parent=base,
            fontName=FONT_ITALIC,
            fontSize=9.2,
            leading=11.8,
            spaceAfter=3,
            textColor=MUTED,
        ),
        "kw": ParagraphStyle(
            "kw",
            parent=base,
            fontName=FONT_NORMAL,
            fontSize=8.5,
            leading=11,
            textColor=MUTED,
        ),
        "role_company": ParagraphStyle(
            "role_company",
            parent=base,
            fontName=FONT_BOLD,
            fontSize=10.4,
            leading=12.4,
            textColor=INK,
            spaceBefore=0,
            spaceAfter=1,
        ),
        "role_dates": ParagraphStyle(
            "role_dates",
            parent=base,
            fontName=FONT_ITALIC,
            fontSize=9,
            leading=11.2,
            textColor=ACCENT,
            spaceBefore=0,
            spaceAfter=0,
        ),
        "role_meta": ParagraphStyle(
            "role_meta",
            parent=base,
            fontName=FONT_ITALIC,
            fontSize=8.8,
            leading=11,
            textColor=MUTED,
            spaceBefore=0,
            spaceAfter=2,
        ),
    }


# --- inline markdown -------------------------------------------------------


def render_inline(text: str) -> str:
    text = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        lambda m: f'<link href="{m.group(2)}" color="{LINK.hexval().replace("0x", "#")}">{m.group(1)}</link>',
        text,
    )
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"<b><i>\1</i></b>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(
        r"`([^`]+)`",
        r'<font face="Courier" size="9">\1</font>',
        text,
    )
    return text


# --- custom flowables ------------------------------------------------------


class SectionHeader(Flowable):
    """Small-caps heading + diamond ornament + accent rule extending right."""

    LABEL_SIZE = 9.6
    SPACING = 1.4
    LEAD_TOP = 10
    LEAD_BOTTOM = 4

    def __init__(self, label: str):
        super().__init__()
        self.label = label.upper()

    def wrap(self, available_w, available_h):
        self._w = available_w
        self._h = self.LEAD_TOP + self.LABEL_SIZE + self.LEAD_BOTTOM + 2
        return self._w, self._h

    def draw(self):
        c = self.canv
        y = self._h - self.LEAD_TOP - self.LABEL_SIZE
        c.setFillColor(ACCENT)
        cx, cy = 4, y + self.LABEL_SIZE / 2 + 1
        size = 2.8
        p = c.beginPath()
        p.moveTo(cx, cy + size)
        p.lineTo(cx + size, cy)
        p.lineTo(cx, cy - size)
        p.lineTo(cx - size, cy)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        c.setFont(FONT_BOLD, self.LABEL_SIZE)
        x = 11
        for ch in self.label:
            c.drawString(x, y + 1, ch)
            x += pdfmetrics.stringWidth(ch, FONT_BOLD, self.LABEL_SIZE) + self.SPACING
        rule_y = y - 2
        c.setStrokeColor(RULE)
        c.setLineWidth(0.4)
        c.line(x + 2, rule_y + self.LABEL_SIZE / 2, self._w, rule_y + self.LABEL_SIZE / 2)


class ChipFlow(Flowable):
    """Word-wrap tokens into rounded soft-tinted pill chips that fill the
    available width. Used for Technical stack sub-sections + Keywords."""

    PAD_X = 5
    PAD_Y = 2.5
    GAP_X = 4
    GAP_Y = 4
    FONT_SIZE = 8.6
    RADIUS = 3.0

    def __init__(self, tokens: List[str]):
        super().__init__()
        self.tokens = [t.strip() for t in tokens if t.strip()]

    def _measure(self, token: str) -> float:
        return pdfmetrics.stringWidth(token, FONT_NORMAL, self.FONT_SIZE) + 2 * self.PAD_X

    def wrap(self, available_w, available_h):
        self._w = available_w
        self._rows: List[List[Tuple[str, float]]] = []
        row: List[Tuple[str, float]] = []
        row_w = 0.0
        for tok in self.tokens:
            w = self._measure(tok)
            advance = w + (self.GAP_X if row else 0)
            if row and row_w + advance > self._w:
                self._rows.append(row)
                row = []
                row_w = 0.0
                advance = w
            row.append((tok, w))
            row_w += advance
        if row:
            self._rows.append(row)
        chip_h = self.FONT_SIZE + 2 * self.PAD_Y
        self._h = (
            len(self._rows) * chip_h
            + max(0, len(self._rows) - 1) * self.GAP_Y
            + 1
        )
        return self._w, self._h

    def draw(self):
        c = self.canv
        chip_h = self.FONT_SIZE + 2 * self.PAD_Y
        y = self._h - chip_h
        for row in self._rows:
            x = 0
            for tok, w in row:
                c.setFillColor(ACCENT_SOFT)
                c.setStrokeColor(RULE)
                c.setLineWidth(0.4)
                c.roundRect(x, y, w, chip_h, self.RADIUS, fill=1, stroke=1)
                c.setFillColor(INK)
                c.setFont(FONT_NORMAL, self.FONT_SIZE)
                c.drawString(x + self.PAD_X, y + self.PAD_Y + 1.3, tok)
                x += w + self.GAP_X
            y -= chip_h + self.GAP_Y


def split_chip_tokens(text: str) -> List[str]:
    text = text.strip()
    if "`" in text:
        toks = re.findall(r"`([^`]+)`", text)
        if toks:
            return toks
    return [t.strip() for t in text.split("·") if t.strip()]


# --- markdown table parser -------------------------------------------------


def parse_table_block(lines: List[str], start: int) -> Tuple[List[List[str]], int]:
    rows: List[List[str]] = []
    i = start
    while i < len(lines) and lines[i].lstrip().startswith("|"):
        raw = lines[i].strip()
        cells = [c.strip() for c in raw.strip("|").split("|")]
        if all(re.fullmatch(r":?-+:?", c or "") for c in cells):
            i += 1
            continue
        rows.append(cells)
        i += 1
    return rows, i


# --- work-experience helpers ----------------------------------------------


_ROLE_HEADER = re.compile(
    r"^###\s+(?P<title>.+?)\s+\*\((?P<dates>[^)]+)\)\*\s*$"
)


# --- main markdown -> flowables -------------------------------------------


def md_to_flowables(md: str, styles: dict, body_width: float):
    """Single-pass scan. Most content emits straight to `flow`. When we
    enter a section listed in TWO_COL_SECTIONS we redirect emission into
    `section_buffer`; on the next H2 (or end of doc) the buffer is wrapped
    in BalancedColumns(2) and appended to the main flow."""

    flow: list = []
    lines = md.splitlines()
    i = 0
    n = len(lines)

    pending_bullets: List[str] = []
    last_h3_label = ""
    in_summary_section = False
    in_workexp_section = False
    pending_header: SectionHeader = None  # KeepTogether-pair candidate

    # Two-column buffering state
    in_two_col = False
    section_buffer: list = []

    def emit(item):
        """Append `item` to the active target. If a SectionHeader is
        pending, glue it to this first item via KeepTogether so the title
        never orphans at column/page bottom."""
        nonlocal pending_header
        target = section_buffer if in_two_col else flow
        if pending_header is not None:
            target.append(KeepTogether([pending_header, item]))
            pending_header = None
        else:
            target.append(item)

    def append_raw(item):
        """Append without consuming a pending header — for trailing spacers
        and bullet bodies after the first KeepTogether-anchored bullet."""
        target = section_buffer if in_two_col else flow
        target.append(item)

    def flush_bullets():
        nonlocal pending_bullets
        if not pending_bullets:
            return
        for b in pending_bullets:
            emit(Paragraph(render_inline(b), styles["bullet"], bulletText="•"))
        append_raw(Spacer(1, 3))
        pending_bullets = []

    def close_two_col_section():
        """End-of-section: render content as a SEQUENCE of small two-cell
        Tables — one per (left, right) sub-section pair. This lets the
        section flow naturally across the page (so it doesn't get bumped
        whole to the next page when it doesn't fit) AND keeps each h3
        sub-section atomic in its column (no spilling)."""
        nonlocal in_two_col, section_buffer
        if not in_two_col:
            return
        if section_buffer:
            for pair_table in _render_two_col_section(section_buffer, styles, body_width):
                flow.append(pair_table)
        in_two_col = False
        section_buffer = []

    while i < n:
        raw = lines[i]
        line = raw.rstrip()

        if not line.strip():
            flush_bullets()
            i += 1
            continue

        if re.fullmatch(r"-{3,}", line.strip()):
            flush_bullets()
            append_raw(Spacer(1, 4))
            i += 1
            continue

        if line.startswith("# "):
            flush_bullets()
            close_two_col_section()
            # Underline the document title — ReportLab Paragraph supports
            # the <u> tag, including thickness/offset overrides via the
            # extended `<u>` attributes if we want a heavier rule later.
            title_text = render_inline(line[2:].strip())
            flow.append(
                Paragraph(f'<u>{title_text}</u>', styles["title"])
            )
            flow.append(
                Paragraph(
                    'Senior full-stack developer · Solutions architect &nbsp;·&nbsp; '
                    'Sigulda, Latvia &nbsp;·&nbsp; '
                    '<font face="Courier" size="9">57.15°N · 24.85°E</font>',
                    styles["subtitle"],
                )
            )
            flow.append(Spacer(1, 2))
            flow.append(HRFlowable(width="100%", thickness=0.6, color=ACCENT))
            flow.append(Spacer(1, 2))
            i += 1
            continue

        if line.startswith("## "):
            flush_bullets()
            close_two_col_section()  # close any in-progress 2-col section
            label = line[3:].strip()
            in_summary_section = label.lower() == "summary"
            in_workexp_section = label.lower().startswith("work experience")
            last_h3_label = ""
            if in_summary_section:
                pass  # Summary has no section header, it's the lede
            else:
                # `Technical stack` is a 2-column block — if its header
                # lands close to the bottom of a page the chips on the
                # next line jump alone, so we insert a CondPageBreak
                # asking for ~80mm of clearance. If less is available the
                # whole section header migrates cleanly to the next page.
                if label.lower() == "technical stack":
                    flow.append(CondPageBreak(80 * mm))
                # Section header always lives in the SINGLE-column flow,
                # spanning the full width. The two-column body that follows
                # is appended after this header.
                flow.append(SectionHeader(label))
                # If this section is one of the 2-col ones, switch buffer mode
                if label.lower() in TWO_COL_SECTIONS:
                    in_two_col = True
                    section_buffer = []
                else:
                    pending_header = None  # header already emitted, not pending
            i += 1
            continue

        if line.startswith("### "):
            flush_bullets()
            label = line[4:].strip()
            last_h3_label = label
            m = _ROLE_HEADER.match(line)
            if in_workexp_section and m:
                title = m.group("title")
                dates = m.group("dates")
                meta = ""
                j = i + 1
                if j < n and lines[j].strip().startswith("*") and lines[j].strip().endswith("*"):
                    meta = lines[j].strip().strip("*")
                    j += 1
                role_bullets: List[str] = []
                while j < n:
                    bl = lines[j].rstrip()
                    if not bl.strip():
                        j += 1
                        continue
                    bm = re.match(r"^[\-\*]\s+(.*)$", bl)
                    if bm:
                        role_bullets.append(bm.group(1))
                        j += 1
                        continue
                    if re.fullmatch(r"\*[^*].*\*", bl.strip()):
                        role_bullets.append(f"<i>{bl.strip()[1:-1]}</i>")
                        j += 1
                        continue
                    break

                role_blocks = _role_block(title, dates, meta, role_bullets, styles, body_width)
                emit(role_blocks[0])
                for it in role_blocks[1:]:
                    append_raw(it)
                append_raw(Spacer(1, 3))
                i = j
                continue

            emit(Paragraph(render_inline(label), styles["h3"]))
            i += 1
            continue

        if line.startswith("#### "):
            flush_bullets()
            emit(Paragraph(render_inline(line[5:].strip()), styles["h4"]))
            i += 1
            continue

        if line.lstrip().startswith("|"):
            flush_bullets()
            rows, i = parse_table_block(lines, i)
            built = build_table(rows, styles)
            if isinstance(built, list):
                for it in built:
                    emit(it)
            else:
                emit(built)
            append_raw(Spacer(1, 3))
            continue

        m = re.match(r"^[\-\*]\s+(.*)$", line)
        if m:
            pending_bullets.append(m.group(1))
            i += 1
            continue

        if re.fullmatch(r"\*[^*].*\*", line.strip()):
            flush_bullets()
            inner = line.strip()[1:-1]
            emit(Paragraph(render_inline(inner), styles["small_italic"]))
            i += 1
            continue

        flush_bullets()
        para_lines = [line]
        j = i + 1
        while j < n and lines[j].strip() and not _is_block_start(lines[j]):
            para_lines.append(lines[j].rstrip())
            j += 1
        text = " ".join(s.strip() for s in para_lines)

        if last_h3_label.lower().strip() in CHIP_LABELS:
            tokens = split_chip_tokens(text)
            emit(ChipFlow(tokens))
            append_raw(Spacer(1, 3))
        elif text.count("`") >= 6 and "·" in text:
            tokens = split_chip_tokens(text)
            emit(ChipFlow(tokens))
        elif in_summary_section:
            flow.append(Paragraph(render_inline(text), styles["summary"]))
        else:
            emit(Paragraph(render_inline(text), styles["body"]))
        i = j

    flush_bullets()
    close_two_col_section()
    return flow


def _render_two_col_section(buffer: list, styles: dict, body_width: float):
    """Split a 2-col-section into per-h3 sub-section groups, distribute
    them across left/right via greedy height balancing, then emit a
    SEQUENCE of small 2-cell Tables — one per (left_group, right_group)
    pair. Returning a list lets the section flow naturally across the
    page (an atomic single Table jumps whole to the next page when it
    doesn't fit, leaving the prior page sparse). Each cell still holds a
    whole sub-section so the user's "no spilling" rule is honoured."""
    h3_style_name = styles["h3"].name

    def is_h3(item) -> bool:
        return (
            isinstance(item, Paragraph)
            and getattr(item.style, "name", None) == h3_style_name
        )

    # 1. Split buffer into per-h3 groups.
    groups: List[list] = []
    cur: list = []
    for item in buffer:
        if is_h3(item):
            if cur:
                groups.append(cur)
            cur = [item]
        else:
            cur.append(item)
    if cur:
        groups.append(cur)

    half_w = (body_width - 8) / 2

    # 2. Estimate height per group at column width.
    def estimate(group):
        total = 0
        for it in group:
            if isinstance(it, Spacer):
                total += it.height
            else:
                try:
                    w, h = it.wrap(half_w, 9999)
                    total += h + 1
                except Exception:
                    total += 30
        return total

    heights = [estimate(g) for g in groups]

    # 3. Greedy split into left vs right at the index that minimises the
    # absolute height delta. With only ~5 sub-sections this is fast and
    # produces a near-optimal balance without weird edge cases.
    total_h = sum(heights)
    best_split = 1
    best_delta = float("inf")
    for split in range(1, len(groups)):
        left_h = sum(heights[:split])
        right_h = total_h - left_h
        delta = abs(left_h - right_h)
        if delta < best_delta:
            best_delta = delta
            best_split = split
    left_groups = groups[:best_split]
    right_groups = groups[best_split:]

    # 4. Render as a single 1-row, 2-cell Table. Each cell holds the
    # FULL stack of its column's sub-sections (e.g. right cell stacks
    # Architecture → Security → Working style). This avoids the dead
    # space that a pair-row Table creates: with rows, every row's height
    # equals max(left, right) so a tall left subsection (Leadership)
    # paired with a short right one wastes the difference. With a single
    # row each side fills its own natural height — Working style sits
    # directly under Security regardless of how tall Leadership got.
    left_flow: list = []
    for g in left_groups:
        left_flow.extend(g)
    right_flow: list = []
    for g in right_groups:
        right_flow.extend(g)

    t = Table(
        [[left_flow or "", right_flow or ""]],
        colWidths=[half_w, half_w],
        hAlign="LEFT",
    )
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [t]


def _is_block_start(line: str) -> bool:
    s = line.lstrip()
    return (
        s.startswith("#")
        or s.startswith("|")
        or re.match(r"^[\-\*]\s+", s) is not None
        or re.fullmatch(r"-{3,}", s.strip()) is not None
    )


def _role_block(title, dates, meta, bullets, styles, body_width):
    """Two-column work-experience block matching v7's look. Earlier
    multi-row variant produced misaligned rows — the row 0 right cell
    contained ONE bullet, while the left cell carried 3 lines (company
    + dates + meta), making row 0's height = max(left, right) = the tall
    company stack. The first bullet then floated against the top of a
    too-tall row, leaving an awkward gap before bullet #2.

    Restored design: ONE row, ONE table per role — left cell stacks
    company / dates / meta, right cell stacks ALL bullets vertically,
    each cell flowing to its own natural height. The role can still
    split across pages because each cell holds a list of flowables and
    Platypus will break the cells in tandem.

    The trade-off is that an extremely long single role (more bullets
    than fit in remaining page space) jumps whole to the next page —
    acceptable since our longest role is 6 bullets, well within a page
    even at the bottom."""
    left_w = body_width * 0.28
    right_w = body_width - left_w - 6

    left_cell = [
        Paragraph(render_inline(title), styles["role_company"]),
        Paragraph(render_inline(dates), styles["role_dates"]),
    ]
    if meta:
        left_cell.append(Paragraph(render_inline(meta), styles["role_meta"]))

    right_cell = [
        Paragraph(render_inline(b), styles["bullet"], bulletText="•")
        for b in bullets
    ] or [Paragraph("", styles["bullet"])]

    t = Table(
        [[left_cell, right_cell]],
        colWidths=[left_w, right_w],
        hAlign="LEFT",
    )
    t.setStyle(
        TableStyle(
            [
                # Both cells anchor to the top so the company name lines
                # up with the first bullet on the same baseline-ish.
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                # Accent bar at the very left of the company column.
                ("LINEBEFORE", (0, 0), (0, 0), 1.2, ACCENT),
                ("LEFTPADDING", (0, 0), (0, 0), 7),
            ]
        )
    )
    return [t]


# --- table rendering -------------------------------------------------------


def build_table(rows: List[List[str]], styles: dict):
    if not rows:
        return Spacer(0, 0)

    is_two_col_def = (
        len(rows[0]) == 2
        and all(len(r) == 2 and len(r[0]) > 0 and len(r[0]) < 30 for r in rows)
    )

    if is_two_col_def:
        data = [
            [
                Paragraph(render_inline(label), styles["table_label"]),
                Paragraph(render_inline(value), styles["table_value"]),
            ]
            for (label, value) in rows
        ]
        t = Table(data, colWidths=[35 * mm, None], hAlign="LEFT")
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                    ("LINEBELOW", (0, 0), (-1, -2), 0.2, RULE),
                ]
            )
        )
        return t

    # Generic n-column table — header row gets accent underline.
    header, *body = rows
    data = [
        [
            Paragraph(
                f'<font color="{ACCENT.hexval().replace("0x", "#")}">'
                f"<b>{render_inline(c)}</b></font>",
                styles["table_value"],
            )
            for c in header
        ]
    ]
    for r in body:
        while len(r) < len(header):
            r.append("")
        data.append([Paragraph(render_inline(c), styles["table_value"]) for c in r])
    t = Table(data, hAlign="LEFT", repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, ACCENT),
                ("LINEBELOW", (0, 1), (-1, -1), 0.2, RULE),
            ]
        )
    )
    return t


# --- main ------------------------------------------------------------------


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        md = f.read()

    styles = make_styles()
    body_width = A4[0] - 36 * mm

    flow = md_to_flowables(md, styles, body_width)

    target = OUT
    try:
        with open(OUT, "ab"):
            pass
    except PermissionError:
        target = OUT + ".new.pdf"
        print(f"[warn] {OUT} is locked. Writing to {target} instead.")

    doc = SimpleDocTemplate(
        target,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Gatis Priede - Curriculum Vitae",
        author="Gatis Priede",
    )

    def page_decoration(canvas, _doc):
        # Footer is just the byline + page number now — the motto was on
        # every page and felt overbearing in print, so we drop it. Name
        # stays so a printed page knows who it belongs to if separated.
        canvas.saveState()
        canvas.setFillColor(PAGE_BG)
        canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
        canvas.setFont(FONT_ITALIC, 8.5)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(A4[0] - 18 * mm, 9 * mm, f"Page {canvas.getPageNumber()}")
        canvas.drawString(18 * mm, 9 * mm, "Gatis Priede")
        canvas.restoreState()

    doc.build(flow, onFirstPage=page_decoration, onLaterPages=page_decoration)
    print(f"Wrote {target}")


if __name__ == "__main__":
    sys.exit(main())
