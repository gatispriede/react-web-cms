/**
 * W8c — Lazy singletons for the deliverability services so that callers
 * (EmailService, webhook handler, MCP tools, admin APIs) don't each
 * re-instantiate against the same Db.
 *
 * Kept off `MongoDBConnection.featureServices` deliberately: those slots
 * are reserved for the Class-Loader migration. Email is still in the
 * legacy "module-level functions" world; rather than wire a full
 * EmailServiceLoader (and conflict with the in-flight W6a receipt-email
 * agent), we provide thin lazy accessors here.
 *
 * `database` may be `undefined` during early boot — callers must handle
 * a `null` return (treat as "service not ready, skip the check").
 */

import type {Db} from 'mongodb';
import {SuppressionListService} from './SuppressionListService';
import {WarmupRateLimiter} from './WarmupRateLimiter';
import {EmailLogService} from './EmailLogService';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

let suppressionInst: SuppressionListService | null = null;
let warmupInst: WarmupRateLimiter | null = null;
let logInst: EmailLogService | null = null;
let lastDb: Db | undefined;

function reset(): void {
    suppressionInst = null;
    warmupInst = null;
    logInst = null;
}

function db(): Db | undefined {
    try {
        const conn = getMongoConnection();
        const cur = conn.database;
        if (cur !== lastDb) {
            lastDb = cur;
            reset();
        }
        return cur;
    } catch {
        return undefined;
    }
}

export function getSuppressionList(): SuppressionListService | null {
    const d = db();
    if (!d) return null;
    if (!suppressionInst) suppressionInst = new SuppressionListService(d);
    return suppressionInst;
}

export function getWarmupLimiter(): WarmupRateLimiter | null {
    const d = db();
    if (!d) return null;
    if (!warmupInst) warmupInst = new WarmupRateLimiter(d);
    return warmupInst;
}

export function getEmailLog(): EmailLogService | null {
    const d = db();
    if (!d) return null;
    if (!logInst) logInst = new EmailLogService(d);
    return logInst;
}

/** Test-only — purge cache between cases. */
export function _resetEmailServicesCache(): void {
    reset();
    lastDb = undefined;
}
