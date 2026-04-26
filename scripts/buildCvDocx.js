/*
 * Build a Word .docx version of the v8 CV from its markdown source.
 *
 * Layout target — mirrors the PDF as closely as Word's section model
 * permits:
 *   • single-column for title, summary, personal info, work experience,
 *     own work, languages, education, in addition
 *   • two-column for candidate skills + technical stack
 *   • Times New Roman everywhere
 *   • underlined document title
 *   • small-caps section headers (Word's `smallCaps: true` does this
 *     natively, no need for tracked-uppercase trickery)
 *   • thin accent border under each section header
 *   • two-column work-experience role blocks (Sapiens-style: company on
 *     left with accent bar, bullets on right) — implemented as 2-cell
 *     borderless tables with a colored left border
 *
 * The document is built as a sequence of "section objects" each carrying
 * its own column config; CONTINUOUS section breaks switch column count
 * inline without forcing page breaks. Output: <stem>.docx alongside the
 * input markdown.
 */

const fs = require("fs");
const path = require("path");
const {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    Footer,
    LevelFormat,
    PageNumber,
    Packer,
    Paragraph,
    SectionType,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    UnderlineType,
    VerticalAlign,
    WidthType,
} = require("docx");

const SRC = process.argv[2]
    || "D:/Work/redis-node-js-cloud/public/CV/Gatis Priede CV v8.md";
const OUT = SRC.replace(/\.md$/i, ".docx");

// --- palette --------------------------------------------------------------
// Subtle accent matching the PDF: muted warm grey for rules + dates,
// near-black ink for body, soft grey for footer.
const INK = "1A1A1A";
const MUTED = "6B6B6B";
const ACCENT = "5E554B";
const RULE = "D6CFBF";
const LINK = "34536E";

const FONT = "Times New Roman";

// --- helpers --------------------------------------------------------------

const splitInline = (text) => {
    /*
     * Tokenise inline markdown into an array of { text, bold, italic, code,
     * href? } runs. Handles **bold**, *italic*, `code`, [link](url), and
     * combinations. Order matters — links first so their label can carry
     * emphasis; then ** before * so we don't split bold into two italics.
     */
    const out = [];
    let rest = text;
    while (rest.length) {
        const link = /^\[([^\]]+)\]\(([^)]+)\)/.exec(rest);
        if (link) {
            out.push({ text: link[1], href: link[2] });
            rest = rest.slice(link[0].length);
            continue;
        }
        const bold = /^\*\*([^*]+)\*\*/.exec(rest);
        if (bold) {
            out.push({ text: bold[1], bold: true });
            rest = rest.slice(bold[0].length);
            continue;
        }
        const italic = /^\*([^*]+)\*/.exec(rest);
        if (italic) {
            out.push({ text: italic[1], italic: true });
            rest = rest.slice(italic[0].length);
            continue;
        }
        const code = /^`([^`]+)`/.exec(rest);
        if (code) {
            out.push({ text: code[1], code: true });
            rest = rest.slice(code[0].length);
            continue;
        }
        // Plain text up to the next markdown trigger
        const next = rest.search(/[\*`\[]/);
        if (next === -1) {
            out.push({ text: rest });
            break;
        }
        if (next > 0) {
            out.push({ text: rest.slice(0, next) });
            rest = rest.slice(next);
        } else {
            // Stray special char — keep it literal and advance one char
            out.push({ text: rest[0] });
            rest = rest.slice(1);
        }
    }
    return out;
};

const buildRuns = (tokens, baseProps = {}) => {
    /*
     * Convert an array of tokens (from splitInline) into TextRun /
     * ExternalHyperlink children for a Paragraph. `baseProps` is merged
     * into every run so a section can be e.g. all-italic or all-muted.
     */
    return tokens.map((t) => {
        const props = {
            text: t.text,
            font: t.code ? "Courier New" : FONT,
            size: baseProps.size ?? 20, // half-points: 20 = 10pt
            bold: t.bold || baseProps.bold || undefined,
            italics: t.italic || baseProps.italics || undefined,
            color: baseProps.color,
        };
        if (t.href) {
            return new ExternalHyperlink({
                link: t.href,
                children: [
                    new TextRun({
                        ...props,
                        color: LINK,
                        underline: { type: UnderlineType.SINGLE, color: LINK },
                    }),
                ],
            });
        }
        return new TextRun(props);
    });
};

const para = (text, opts = {}) => {
    const tokens = splitInline(text);
    return new Paragraph({
        spacing: opts.spacing,
        alignment: opts.alignment,
        indent: opts.indent,
        numbering: opts.numbering,
        border: opts.border,
        children: buildRuns(tokens, opts.run || {}),
    });
};

// --- markdown line parser --------------------------------------------------
//
// Constructs a sequence of "section blocks". Each section block has:
//   { columns: 1|2, children: Paragraph[]|Table[] }
// Adjacent same-column blocks are merged at emit time. Section boundaries
// translate to docx CONTINUOUS section breaks.

const TWO_COL_H2 = new Set(["candidate skills", "technical stack"]);

const parseMd = (md) => {
    const lines = md.split(/\r?\n/);
    const blocks = []; // [{ columns, children }]
    let cur = null;

    let pendingBullets = [];
    let inSummary = false;
    let inWorkExp = false;
    let lastH3 = "";

    const flushBullets = () => {
        if (!pendingBullets.length) return;
        for (const b of pendingBullets) {
            cur.children.push(
                new Paragraph({
                    numbering: { reference: "bullets", level: 0 },
                    spacing: { before: 0, after: 30 },
                    children: buildRuns(splitInline(b), { size: 19 }),
                })
            );
        }
        pendingBullets = [];
    };

    const startBlock = (columns) => {
        if (cur && cur.columns === columns) return cur;
        cur = { columns, children: [] };
        blocks.push(cur);
        return cur;
    };

    startBlock(1); // initial single-column block

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.replace(/\s+$/, "");

        if (!line.trim()) {
            flushBullets();
            continue;
        }

        // `---` separators — visual divider already comes from section
        // headers; emit a small spacer paragraph for breathing room.
        if (/^-{3,}$/.test(line.trim())) {
            flushBullets();
            cur.children.push(
                new Paragraph({ spacing: { before: 0, after: 80 }, children: [] })
            );
            continue;
        }

        // Title
        if (line.startsWith("# ")) {
            flushBullets();
            const title = line.slice(2).trim();
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 60 },
                    children: [
                        new TextRun({
                            text: title,
                            font: FONT,
                            size: 52, // 26pt
                            bold: true,
                            color: INK,
                            underline: { type: UnderlineType.SINGLE, color: INK },
                        }),
                    ],
                })
            );
            // Subtitle
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 60 },
                    children: [
                        new TextRun({
                            text: "Senior full-stack developer · Solutions architect · Sigulda, Latvia · ",
                            font: FONT,
                            size: 21,
                            italics: true,
                            color: MUTED,
                        }),
                        new TextRun({
                            text: "57.15°N · 24.85°E",
                            font: "Courier New",
                            size: 18,
                            italics: true,
                            color: MUTED,
                        }),
                    ],
                })
            );
            // Top accent rule
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 100 },
                    border: {
                        bottom: {
                            style: BorderStyle.SINGLE,
                            size: 6,
                            color: ACCENT,
                            space: 1,
                        },
                    },
                    children: [],
                })
            );
            continue;
        }

        // ## Section header
        if (line.startsWith("## ")) {
            flushBullets();
            const label = line.slice(3).trim();
            inSummary = label.toLowerCase() === "summary";
            inWorkExp = label.toLowerCase().startsWith("work experience");
            lastH3 = "";
            const wantTwoCol = TWO_COL_H2.has(label.toLowerCase());
            startBlock(wantTwoCol ? 2 : 1);

            if (!inSummary) {
                // Small-caps section header with a thin accent border below
                cur.children.push(
                    new Paragraph({
                        spacing: { before: 240, after: 60 },
                        border: {
                            bottom: {
                                style: BorderStyle.SINGLE,
                                size: 4,
                                color: RULE,
                                space: 2,
                            },
                        },
                        children: [
                            new TextRun({
                                text: "◆  ",
                                font: FONT,
                                size: 20,
                                color: ACCENT,
                            }),
                            new TextRun({
                                text: label,
                                font: FONT,
                                size: 20,
                                bold: true,
                                color: ACCENT,
                                smallCaps: true,
                                characterSpacing: 30, // tracked
                            }),
                        ],
                    })
                );
            }
            continue;
        }

        // ### Sub-section (h3) — special-cased for work experience role headers
        if (line.startsWith("### ")) {
            flushBullets();
            const m = /^###\s+(.+?)\s+\*\(([^)]+)\)\*\s*$/.exec(line);
            if (inWorkExp && m) {
                // Collect role bullets + meta into a 2-cell table block
                const title = m[1];
                const dates = m[2];
                let meta = "";
                let j = i + 1;
                if (
                    j < lines.length &&
                    lines[j].trim().startsWith("*") &&
                    lines[j].trim().endsWith("*")
                ) {
                    meta = lines[j].trim().slice(1, -1);
                    j += 1;
                }
                const bullets = [];
                while (j < lines.length) {
                    const bl = lines[j].replace(/\s+$/, "");
                    if (!bl.trim()) {
                        j += 1;
                        continue;
                    }
                    const bm = /^[\-\*]\s+(.*)$/.exec(bl);
                    if (bm) {
                        bullets.push(bm[1]);
                        j += 1;
                        continue;
                    }
                    const im = /^\*([^*].*)\*$/.exec(bl.trim());
                    if (im) {
                        bullets.push(im[1]); // italicised tail line
                        j += 1;
                        continue;
                    }
                    break;
                }
                cur.children.push(
                    buildRoleTable(title, dates, meta, bullets, cur.columns)
                );
                cur.children.push(
                    new Paragraph({ spacing: { before: 0, after: 60 }, children: [] })
                );
                i = j - 1;
                continue;
            }
            const label = line.slice(4).trim();
            lastH3 = label;
            cur.children.push(
                new Paragraph({
                    spacing: { before: 100, after: 30 },
                    children: [
                        new TextRun({
                            text: label,
                            font: FONT,
                            size: 22,
                            bold: true,
                            italics: true,
                            color: INK,
                        }),
                    ],
                })
            );
            continue;
        }

        // Markdown table — render as Word Table
        if (line.startsWith("|")) {
            flushBullets();
            const rows = [];
            let j = i;
            while (j < lines.length && lines[j].lstrip
                ? false
                : lines[j].trim().startsWith("|")) {
                const cells = lines[j].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
                if (cells.every((c) => /^:?-+:?$/.test(c) || c === "")) {
                    j += 1;
                    continue;
                }
                rows.push(cells);
                j += 1;
            }
            i = j - 1;
            cur.children.push(buildMdTable(rows, cur.columns));
            cur.children.push(
                new Paragraph({ spacing: { before: 0, after: 40 }, children: [] })
            );
            continue;
        }

        // Bullet
        const bm = /^[\-\*]\s+(.*)$/.exec(line);
        if (bm) {
            pendingBullets.push(bm[1]);
            continue;
        }

        // Italic-only caption like "*Riga, Latvia · permanent · ...*"
        if (/^\*[^*].*\*$/.test(line.trim())) {
            flushBullets();
            const inner = line.trim().slice(1, -1);
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 60 },
                    children: buildRuns(splitInline(inner), {
                        size: 18,
                        italics: true,
                        color: MUTED,
                    }),
                })
            );
            continue;
        }

        // Default paragraph (collapses across continuation lines)
        flushBullets();
        const paraLines = [line];
        while (i + 1 < lines.length && lines[i + 1].trim() && !isBlockStart(lines[i + 1])) {
            paraLines.push(lines[i + 1].replace(/\s+$/, ""));
            i += 1;
        }
        const text = paraLines.map((s) => s.trim()).join(" ");
        if (inSummary) {
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 80, line: 280 },
                    children: buildRuns(splitInline(text), { size: 21 }),
                })
            );
        } else {
            cur.children.push(
                new Paragraph({
                    spacing: { before: 0, after: 60 },
                    children: buildRuns(splitInline(text), { size: 19 }),
                })
            );
        }
    }
    flushBullets();
    return blocks;
};

const isBlockStart = (line) => {
    const s = line.replace(/^\s+/, "");
    return (
        s.startsWith("#") ||
        s.startsWith("|") ||
        /^[\-\*]\s+/.test(s) ||
        /^-{3,}$/.test(s.trim())
    );
};

// --- Personal info / Languages / Own work tables --------------------------

const buildMdTable = (rows, columns) => {
    if (!rows.length) return new Paragraph({ children: [] });
    const isTwoColDef =
        rows[0].length === 2 &&
        rows.every((r) => r.length === 2 && r[0] && r[0].length < 30);
    // Available content width depends on whether we're in a 2-col section.
    // We shrink table width when in 2-col so it fits a column.
    const fullW = 9026; // A4 - 2*margins (DXA approx)
    const tableW = columns === 2 ? Math.floor(fullW / 2) - 200 : fullW;

    if (isTwoColDef) {
        const labelW = Math.floor(tableW * 0.32);
        const valueW = tableW - labelW;
        return new Table({
            width: { size: tableW, type: WidthType.DXA },
            columnWidths: [labelW, valueW],
            borders: noBorders(),
            rows: rows.map((r) => buildPersonalRow(r, labelW, valueW)),
        });
    }

    // Header row + body. Used for Languages and (now) for Own work.
    const header = rows[0];
    const body = rows.slice(1);
    const colW = Math.floor(tableW / header.length);
    const lastW = tableW - colW * (header.length - 1);
    const widths = header.map((_, i) => (i === header.length - 1 ? lastW : colW));

    return new Table({
        width: { size: tableW, type: WidthType.DXA },
        columnWidths: widths,
        borders: noBorders(),
        rows: [
            new TableRow({
                children: header.map((h, idx) => buildHeaderCell(h, widths[idx])),
            }),
            ...body.map((r) => buildBodyRow(r, widths)),
        ],
    });
};

const buildPersonalRow = (cells, labelW, valueW) =>
    new TableRow({
        children: [
            new TableCell({
                width: { size: labelW, type: WidthType.DXA },
                margins: { top: 30, bottom: 30, left: 0, right: 80 },
                borders: cellNoBorders(),
                children: [
                    new Paragraph({
                        spacing: { before: 0, after: 0 },
                        children: buildRuns(splitInline(cells[0]), {
                            size: 18,
                            italics: true,
                            color: MUTED,
                        }),
                    }),
                ],
            }),
            new TableCell({
                width: { size: valueW, type: WidthType.DXA },
                margins: { top: 30, bottom: 30, left: 0, right: 0 },
                borders: cellNoBorders(),
                children: [
                    new Paragraph({
                        spacing: { before: 0, after: 0 },
                        children: buildRuns(splitInline(cells[1]), { size: 19 }),
                    }),
                ],
            }),
        ],
    });

const buildHeaderCell = (text, w) =>
    new TableCell({
        width: { size: w, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        },
        children: [
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                    new TextRun({
                        text,
                        font: FONT,
                        size: 19,
                        bold: true,
                        color: ACCENT,
                    }),
                ],
            }),
        ],
    });

const buildBodyRow = (cells, widths) =>
    new TableRow({
        children: cells.map(
            (c, idx) =>
                new TableCell({
                    width: { size: widths[idx], type: WidthType.DXA },
                    margins: { top: 50, bottom: 50, left: 80, right: 80 },
                    borders: {
                        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
                        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    },
                    children: [
                        new Paragraph({
                            spacing: { before: 0, after: 0 },
                            children: buildRuns(splitInline(c), { size: 19 }),
                        }),
                    ],
                })
        ),
    });

const noBorders = () => ({
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
});

const cellNoBorders = () => ({
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
});

// --- Work-experience role table ------------------------------------------

const buildRoleTable = (title, dates, meta, bullets, columns) => {
    /*
     * 2-cell table replicating the PDF's role block: bold company name +
     * accent-colored dates + muted meta on the LEFT (with a thick accent
     * left border = "rail"); bullets stacked on the RIGHT.
     */
    const fullW = columns === 2 ? Math.floor(9026 / 2) - 200 : 9026;
    const leftW = Math.floor(fullW * 0.30);
    const rightW = fullW - leftW;

    const leftChildren = [
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({ text: title, font: FONT, size: 21, bold: true, color: INK }),
            ],
        }),
        new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
                new TextRun({
                    text: dates,
                    font: FONT,
                    size: 18,
                    italics: true,
                    color: ACCENT,
                }),
            ],
        }),
    ];
    if (meta) {
        leftChildren.push(
            new Paragraph({
                spacing: { before: 0, after: 0 },
                children: buildRuns(splitInline(meta), {
                    size: 17,
                    italics: true,
                    color: MUTED,
                }),
            })
        );
    }

    const rightChildren = bullets.map(
        (b) =>
            new Paragraph({
                numbering: { reference: "bullets", level: 0 },
                spacing: { before: 0, after: 30 },
                children: buildRuns(splitInline(b), { size: 19 }),
            })
    );
    if (!rightChildren.length) {
        rightChildren.push(new Paragraph({ children: [] }));
    }

    return new Table({
        width: { size: fullW, type: WidthType.DXA },
        columnWidths: [leftW, rightW],
        borders: noBorders(),
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: leftW, type: WidthType.DXA },
                        margins: { top: 40, bottom: 40, left: 100, right: 80 },
                        borders: {
                            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                            left: { style: BorderStyle.SINGLE, size: 18, color: ACCENT },
                            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                        },
                        children: leftChildren,
                    }),
                    new TableCell({
                        width: { size: rightW, type: WidthType.DXA },
                        margins: { top: 40, bottom: 40, left: 80, right: 0 },
                        borders: cellNoBorders(),
                        children: rightChildren,
                    }),
                ],
            }),
        ],
    });
};

// --- main -----------------------------------------------------------------

const main = () => {
    const md = fs.readFileSync(SRC, "utf8");
    const blocks = parseMd(md);

    // Compose docx Sections from the parsed blocks. Each block becomes one
    // Section so column count can change inline. CONTINUOUS section type
    // means no page break between sections — they flow on the same page.
    const sections = blocks.map((b, idx) => ({
        properties: {
            type: SectionType.CONTINUOUS,
            page: {
                size: { width: 11906, height: 16838 }, // A4
                margin: { top: 720, bottom: 720, left: 1080, right: 1080 },
            },
            column: {
                count: b.columns,
                space: 360, // 0.25 inch gap
                equalWidth: true,
                separate: false,
            },
        },
        children: b.children,
        ...(idx === 0
            ? {
                  footers: {
                      default: new Footer({
                          children: [
                              new Paragraph({
                                  alignment: AlignmentType.CENTER,
                                  children: [
                                      new TextRun({
                                          text: "Gatis Priede  ·  Everything is possible.  ·  Page ",
                                          font: FONT,
                                          size: 17,
                                          italics: true,
                                          color: MUTED,
                                      }),
                                      new TextRun({
                                          children: [PageNumber.CURRENT],
                                          font: FONT,
                                          size: 17,
                                          italics: true,
                                          color: MUTED,
                                      }),
                                  ],
                              }),
                          ],
                      }),
                  },
              }
            : {}),
    }));

    const doc = new Document({
        creator: "Gatis Priede",
        title: "Gatis Priede - Curriculum Vitae",
        styles: {
            default: { document: { run: { font: FONT, size: 20 } } },
        },
        numbering: {
            config: [
                {
                    reference: "bullets",
                    levels: [
                        {
                            level: 0,
                            format: LevelFormat.BULLET,
                            text: "•",
                            alignment: AlignmentType.LEFT,
                            style: {
                                paragraph: { indent: { left: 360, hanging: 200 } },
                                run: { font: FONT, size: 19 },
                            },
                        },
                    ],
                },
            ],
        },
        sections,
    });

    Packer.toBuffer(doc).then((buf) => {
        fs.writeFileSync(OUT, buf);
        console.log(`Wrote ${OUT}`);
    });
};

main();
