/**
 * MCP tools for the email-provider configuration surface.
 *
 *   email.config.get    — admin-rank read; secrets returned MASKED
 *   email.config.update — admin-rank write; plain `smtpPass` /
 *                         `resendApiKey` get encrypted server-side
 *                         (handled inside SiteFlagsService.sanitizeMailConfig).
 *   email.config.test   — sends a test email through the active provider.
 *
 * The existing `email.send` tool (in inquiries.ts) keeps working — it
 * already routes through the SMTP transport. After this commit it
 * inherits the admin-side config too, since `_inquiryMailer.ts` is a
 * thin shim over `EmailService.sendEmail`.
 */
import {McpTool}                  from '../types';
import {enforceModeForTool}       from '../modeEnforcement';
import {getMongoConnection}       from '@services/infra/mongoDBConnection';
import {defineTool}               from './_shared';
import {sendEmail}                from '@services/features/Email/EmailService';
import {mask}                     from '@services/infra/secretBox';

function sanitiseForRead(mail: any): any {
    if (!mail || typeof mail !== 'object') return null;
    return {
        provider: mail.provider ?? 'disabled',
        from: mail.from ?? '',
        inquiryRecipient: mail.inquiryRecipient ?? '',
        smtpHost: mail.smtpHost ?? '',
        smtpPort: typeof mail.smtpPort === 'number' ? mail.smtpPort : null,
        smtpUser: mail.smtpUser ?? '',
        smtpPassEncrypted: mail.smtpPassEncrypted ? mask(mail.smtpPassEncrypted) : '',
        resendApiKeyEncrypted: mail.resendApiKeyEncrypted ? mask(mail.resendApiKeyEncrypted) : '',
    };
}

export const emailConfigGet: McpTool = defineTool({
    // SAFE: read-only, not a GraphQL mutation
    name: 'email.config.get',
    description: 'Returns the current email-provider config. Secrets returned masked (SMTP password + Resend API key).',
    scopes: ['read:site'],
    auditScope: 'email',
    inputSchema: {type: 'object', properties: {}},
}, async () => {
    const conn = getMongoConnection();
    const flags = await conn.siteFlagsService.get();
    return {mail: sanitiseForRead((flags as any).mail)};
});

export const emailConfigUpdate: McpTool = defineTool({
    name: 'email.config.update',
    description: 'Update the email-provider config. Plain `smtpPass` / `resendApiKey` are encrypted at rest via SECRETBOX_KEY.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'email',
    gqlMutation: 'saveSiteFlags',
    inputSchema: {
        type: 'object',
        properties: {
            provider: {type: 'string', enum: ['smtp', 'resend', 'disabled']},
            from: {type: 'string'},
            inquiryRecipient: {type: 'string'},
            smtpHost: {type: 'string'},
            smtpPort: {type: 'integer'},
            smtpUser: {type: 'string'},
            smtpPass: {type: 'string'},
            resendApiKey: {type: 'string'},
            expectedVersion: {type: 'integer'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'email.config.update');
    const conn = getMongoConnection();
    const current = await conn.siteFlagsService.get();
    const prev = (current as any).mail ?? {provider: 'disabled'};
    const nextMail: any = {
        provider: args.provider ?? prev.provider ?? 'disabled',
        from: args.from ?? prev.from,
        inquiryRecipient: args.inquiryRecipient ?? prev.inquiryRecipient,
        smtpHost: args.smtpHost ?? prev.smtpHost,
        smtpPort: typeof args.smtpPort === 'number' ? args.smtpPort : prev.smtpPort,
        smtpUser: args.smtpUser ?? prev.smtpUser,
        // sanitizeMailConfig (server-side) does the encryption when
        // `smtpPass` / `resendApiKey` are present plaintext; otherwise
        // we keep the existing encrypted blobs intact.
        smtpPass: args.smtpPass,
        smtpPassEncrypted: args.smtpPass ? undefined : prev.smtpPassEncrypted,
        resendApiKey: args.resendApiKey,
        resendApiKeyEncrypted: args.resendApiKey ? undefined : prev.resendApiKeyEncrypted,
    };
    const saved = await conn.siteFlagsService.save(
        {...(current as any), mail: nextMail},
        typeof ctx.actor === 'string' ? ctx.actor : (ctx.actor as any)?.email,
        args.expectedVersion ?? null,
    );
    return {mail: sanitiseForRead((saved as any).mail)};
});

export const emailConfigTest: McpTool = defineTool({
    // SAFE: side-effect via EmailService, not a GraphQL mutation
    name: 'email.config.test',
    description: 'Send a test email through the active email provider to verify config + credentials.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'email',
    rateLimit: {maxPerMinute: 20},
    inputSchema: {
        type: 'object',
        required: ['to'],
        properties: {
            to: {type: 'string', minLength: 3},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'email.config.test');
    const conn = getMongoConnection();
    const flags = await conn.siteFlagsService.get();
    const result = await sendEmail((flags as any).mail, {
        to: args.to,
        subject: 'Test email from your CMS',
        text: 'If you received this, the email provider is configured correctly.',
        html: '<p>If you received this, the email provider is configured correctly.</p>',
    });
    return {
        ok: result.ok,
        provider: result.provider,
        durationMs: result.durationMs,
        messageId: result.messageId,
        error: result.error,
    };
});

export const EMAIL_TOOLS: McpTool[] = [emailConfigGet, emailConfigUpdate, emailConfigTest];
