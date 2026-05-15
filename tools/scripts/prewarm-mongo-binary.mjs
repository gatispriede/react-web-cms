#!/usr/bin/env node
/**
 * Download the `mongodb-memory-server` binary once, serially, before
 * vitest fans out across files that each call `MongoMemoryServer.create()`.
 *
 * Why: CI runners start with an empty `~/.cache/mongodb-binaries/`. ~30
 * test files use `MongoMemoryServer.create()` and vitest runs them in
 * parallel by default. Each call sees the missing binary and starts its
 * own download — multiple workers race on the same
 * `mongodb-linux-...tgz.downloading` partial file and one wins the
 * `rename(.downloading, .tgz)` while the others ENOENT.
 *
 * Locally this never reproduces because the binary is already cached
 * from prior runs. CI hits it on every fresh image.
 *
 * Calling `MongoMemoryServer.create()` here downloads the binary into
 * the per-user cache directory; subsequent vitest workers find it on
 * disk and skip the download path entirely.
 *
 * Q4-cap diagnosis (2026-05-13): without an explicit version pin the
 * library auto-detects the platform (e.g. ubuntu2404 on Ubuntu 24.04)
 * and asks for the absolute-latest MongoDB tarball. When MongoDB hasn't
 * published that tarball yet for that platform combo the CDN returns
 * 403 and the library reports it as "Status Code is 403 (MongoDB's 404)".
 * Every Playwright visual spec then dies in fixture setup with a ~3ms
 * instant-fail (the "1ms instant-fail" surfaced in the roadmap). The
 * fix is the `config.mongodbMemoryServer.version` pin in package.json
 * (7.0.14 — the 7.0 LTS series has the widest platform-binary coverage,
 * including ubuntu2404). Bump it when ops want to track a newer series
 * AND the upstream platform matrix supports the target version.
 */
import {MongoMemoryServer} from 'mongodb-memory-server';

const t0 = Date.now();
const m = await MongoMemoryServer.create();
await m.stop();
console.log(`prewarm-mongo-binary: ready in ${Date.now() - t0}ms`);
