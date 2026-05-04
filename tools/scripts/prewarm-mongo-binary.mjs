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
 */
import {MongoMemoryServer} from 'mongodb-memory-server';

const t0 = Date.now();
const m = await MongoMemoryServer.create();
await m.stop();
console.log(`prewarm-mongo-binary: ready in ${Date.now() - t0}ms`);
