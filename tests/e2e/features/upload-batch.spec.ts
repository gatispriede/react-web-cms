import {createServer, Server} from 'node:http';
import {AddressInfo} from 'node:net';
import {test, expect} from '../fixtures/auth';

// 1x1 transparent PNG — minimum valid bytes, used as both a file payload
// and the body of the local URL-import server below. Bytes are well-known;
// see http://www.libpng.org/pub/png/spec/iso/index-object.html.
const ONE_PIXEL_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
]);

/**
 * Spin up a tiny localhost HTTP server that serves the PNG above with a
 * proper content-type. The bulk endpoint will fetch this URL just like it
 * would S3 / Cloudinary, but we don't need network egress in CI.
 */
async function startImageServer(): Promise<{url: string; close: () => Promise<void>}> {
    const server: Server = createServer((req, res) => {
        if (req.url === '/not-an-image') {
            res.writeHead(200, {'content-type': 'text/plain'});
            res.end('nope');
            return;
        }
        res.writeHead(200, {'content-type': 'image/png', 'content-length': String(ONE_PIXEL_PNG.length)});
        res.end(ONE_PIXEL_PNG);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    return {
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
}

test.describe('upload-batch — files + URL import', () => {
    test('uploads a file and imports an image from a URL in the same batch', async ({adminPage}) => {
        const imgServer = await startImageServer();
        try {
            const resp = await adminPage.request.post('/api/upload-batch', {
                multipart: {
                    ratio: 'free',
                    file: {
                        name: 'pixel.png',
                        mimeType: 'image/png',
                        buffer: ONE_PIXEL_PNG,
                    },
                    urls: JSON.stringify([`${imgServer.url}/pixel.png`]),
                },
            });
            expect(resp.status(), `body: ${await resp.text()}`).toBe(200);
            const body = await resp.json();
            expect(body.total).toBe(2);
            expect(body.succeeded).toBe(2);
            expect(body.failed).toBe(0);
            expect(body.results).toHaveLength(2);
            for (const r of body.results) {
                expect(r.ok).toBe(true);
                expect(r.image?.location).toMatch(/\.png$/);
            }
        } finally {
            await imgServer.close();
        }
    });

    test('reports per-URL failures without aborting the batch', async ({adminPage}) => {
        const imgServer = await startImageServer();
        try {
            const resp = await adminPage.request.post('/api/upload-batch', {
                multipart: {
                    ratio: 'free',
                    urls: JSON.stringify([
                        'ftp://example.com/x.png',                  // bad scheme
                        `${imgServer.url}/not-an-image`,             // wrong content-type
                        `${imgServer.url}/pixel.png`,                // ok
                    ]),
                },
            });
            expect(resp.status()).toBe(200);
            const body = await resp.json();
            expect(body.total).toBe(3);
            expect(body.succeeded).toBe(1);
            expect(body.failed).toBe(2);
            const errors = body.results.filter((r: any) => !r.ok).map((r: any) => r.error);
            expect(errors).toEqual(expect.arrayContaining([
                expect.stringMatching(/only http\/https/),
                expect.stringMatching(/not an image/),
            ]));
        } finally {
            await imgServer.close();
        }
    });

    test('rejects non-admin callers', async ({anonPage, serverUrl}) => {
        const resp = await anonPage.request.post(`${serverUrl}/api/upload-batch`, {
            multipart: {
                ratio: 'free',
                urls: JSON.stringify(['http://127.0.0.1:1/x.png']),
            },
        });
        expect([401, 403]).toContain(resp.status());
    });
});
