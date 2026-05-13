/**
 * Product spec-sheet PDF endpoint — Phase 1.F polish.
 *
 * Backs the `DownloadablePdf` module's canonical href:
 *   GET /api/products/<id>/spec-sheet.pdf
 *
 * Renderer strategy:
 *  - Prefer `@react-pdf/renderer` when present (added to package.json
 *    behind a comment marker: install via `npm i @react-pdf/renderer`).
 *  - When the dep is missing, return `503 PDF rendering not configured`
 *    with an operator-clear TODO header so a deploy is never gated by
 *    a quiet-failure 500.
 *
 * Output is `application/pdf` binary. The rendered sheet carries:
 *   - product title + slug
 *   - hero image (first `images[]`, if present)
 *   - attributes table (key/value rows from `attributes`)
 *   - price + currency
 *   - W8g VAT line (line-level VAT breakdown — placeholder until the
 *     InvoiceService primitive is plumbed through; we render the unit
 *     price + "VAT incl./excl." note based on `commerce.vat.inclusive`
 *     when readable).
 */
import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

export const config = {
    api: {responseLimit: false},
};

interface PdfRenderDeps {
    Document: any;
    Page: any;
    Text: any;
    View: any;
    Image: any;
    StyleSheet: any;
    renderToStream: (el: any) => Promise<NodeJS.ReadableStream>;
}

/**
 * Best-effort dynamic load of `@react-pdf/renderer`. Returns `null` when
 * the dep isn't installed so the handler can fall through to a 503.
 */
async function loadPdfDeps(): Promise<PdfRenderDeps | null> {
    try {
        // Indirect dynamic import — keeps TS off the optional peer dep
        // until an operator runs `npm i @react-pdf/renderer`.
        const modName = '@react-pdf/renderer';
        const mod = await (new Function('m', 'return import(m)'))(modName);
        return mod as PdfRenderDeps;
    } catch {
        return null;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({error: 'Method not allowed'} as any);
        return;
    }
    const id = String(req.query.id ?? '');
    if (!id) {
        res.status(400).json({error: 'product id required'} as any);
        return;
    }

    const conn = getMongoConnection();
    const product = await conn.productService.getById(id).catch(() => null);
    if (!product) {
        res.status(404).json({error: 'product not found'} as any);
        return;
    }

    const deps = await loadPdfDeps();
    if (!deps) {
        // Operator-clear failure. Surface the missing-dep hint in a
        // header so curl + browser devtools both pick it up.
        res.setHeader('X-PDF-Renderer', 'missing');
        res.setHeader('X-PDF-Install-Hint', 'npm i @react-pdf/renderer');
        res.status(503).json({
            error: 'PDF rendering not configured. Install @react-pdf/renderer.',
        } as any);
        return;
    }

    // VAT line — read the commerce.vat.* flags defensively; default to
    // "VAT incl." per EU consumer norms. Replace with W8g primitive once
    // the InvoiceService VAT breakdown lands.
    let vatNote = 'VAT included';
    try {
        const raw = await conn.getSiteFlags();
        const flags = JSON.parse(raw);
        if (flags?.commerce?.vat?.inclusive === false) vatNote = 'VAT excluded';
    } catch { /* keep default */ }

    const formattedPrice = (() => {
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency', currency: product.currency || 'EUR',
            }).format((product.price ?? 0) / 100);
        } catch { return `${(product.price ?? 0) / 100} ${product.currency || ''}`.trim(); }
    })();

    const {Document, Page, Text, View, Image, StyleSheet, renderToStream} = deps;
    const styles = StyleSheet.create({
        page: {padding: 32, fontSize: 11, fontFamily: 'Helvetica'},
        h1: {fontSize: 20, marginBottom: 4, fontWeight: 700},
        slug: {fontSize: 9, color: '#666', marginBottom: 12},
        image: {marginBottom: 12, maxHeight: 240, objectFit: 'contain'},
        row: {flexDirection: 'row', borderBottom: '1px solid #eee', paddingVertical: 4},
        key: {width: 140, color: '#555'},
        val: {flex: 1},
        price: {fontSize: 16, marginTop: 16, fontWeight: 700},
        vat: {fontSize: 9, color: '#777'},
    });

    const heroImage = Array.isArray(product.images) ? product.images[0] : undefined;
    const attrEntries = Object.entries(product.attributes ?? {});

    const doc = Document({
        children: Page({
            size: 'A4',
            style: styles.page,
            children: [
                Text({style: styles.h1, children: product.title || product.slug || id}),
                Text({style: styles.slug, children: `/${product.slug || id}`}),
                heroImage ? Image({src: heroImage, style: styles.image}) : null,
                ...attrEntries.map(([k, v]) => View({
                    style: styles.row,
                    children: [
                        Text({style: styles.key, children: k}),
                        Text({style: styles.val, children: String(v)}),
                    ],
                })),
                Text({style: styles.price, children: formattedPrice}),
                Text({style: styles.vat, children: vatNote}),
            ].filter(Boolean),
        }),
    });

    const stream = await renderToStream(doc);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
        'Content-Disposition',
        `inline; filename="${product.sku || product.slug || id}-spec.pdf"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=60');
    (stream as any).pipe(res);
}
