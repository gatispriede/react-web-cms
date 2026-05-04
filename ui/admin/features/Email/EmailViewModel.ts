/**
 * Admin email-provider config — VM3 (no useState).
 *
 * Reads + writes through the existing GraphQL surface that MCP uses
 * (`getSiteFlags` / `saveSiteFlags`). Secrets are encrypted server-side
 * via `services/infra/secretBox.ts` so the admin transmits plaintext
 * exactly once, never re-reads it.
 *
 * Pattern rules (per VM3 spec):
 *   - No JSX / React imports here.
 *   - Async actions mutate `this.*` directly; reactivity layer notifies.
 *   - Errors flash through AntD `message`.
 */
import {message}        from 'antd';
import SiteFlagsApi     from '@services/api/client/SiteFlagsApi';

export type EmailProvider = 'smtp' | 'resend' | 'disabled';

export interface IMailDraft {
    provider: EmailProvider;
    from: string;
    inquiryRecipient: string;
    smtpHost: string;
    smtpPort: number | null;
    smtpUser: string;
    smtpPassDisplay: string;     // masked or empty when reading; plaintext while editing
    smtpPassDirty: boolean;      // true → send `smtpPass` to server
    resendApiKeyDisplay: string;
    resendApiKeyDirty: boolean;
}

export class EmailViewModel {
    loading = false;
    saving = false;
    testing = false;
    lastTestResult: {ok: boolean; provider?: string; error?: string; durationMs?: number} | null = null;
    testRecipient = '';
    draft: IMailDraft = {
        provider: 'disabled',
        from: '',
        inquiryRecipient: '',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassDisplay: '',
        smtpPassDirty: false,
        resendApiKeyDisplay: '',
        resendApiKeyDirty: false,
    };
    private flagsApi = new SiteFlagsApi();

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const flags = await this.flagsApi.get();
            const m = (flags as any).mail;
            if (m) {
                this.draft = {
                    provider: m.provider ?? 'disabled',
                    from: m.from ?? '',
                    inquiryRecipient: m.inquiryRecipient ?? (flags as any).inquiryRecipientEmail ?? '',
                    smtpHost: m.smtpHost ?? '',
                    smtpPort: typeof m.smtpPort === 'number' ? m.smtpPort : 587,
                    smtpUser: m.smtpUser ?? '',
                    // Show "set" indicator without exposing secrets. Operator
                    // must clear-and-retype to change.
                    smtpPassDisplay: m.smtpPassEncrypted ? '••••••••' : '',
                    smtpPassDirty: false,
                    resendApiKeyDisplay: m.resendApiKeyEncrypted ? '••••••••' : '',
                    resendApiKeyDirty: false,
                };
            }
        } catch (err) {
            console.error('[EmailViewModel.refresh]', err);
            message.error(String((err as Error)?.message ?? err));
        } finally {
            this.loading = false;
        }
    }

    setProvider(p: EmailProvider): void { this.draft = {...this.draft, provider: p}; }
    setFrom(v: string): void { this.draft = {...this.draft, from: v}; }
    setRecipient(v: string): void { this.draft = {...this.draft, inquiryRecipient: v}; }
    setSmtpHost(v: string): void { this.draft = {...this.draft, smtpHost: v}; }
    setSmtpPort(v: number | null): void { this.draft = {...this.draft, smtpPort: v}; }
    setSmtpUser(v: string): void { this.draft = {...this.draft, smtpUser: v}; }
    setSmtpPass(v: string): void { this.draft = {...this.draft, smtpPassDisplay: v, smtpPassDirty: true}; }
    setResendKey(v: string): void { this.draft = {...this.draft, resendApiKeyDisplay: v, resendApiKeyDirty: true}; }
    setTestRecipient(v: string): void { this.testRecipient = v; }

    async save(): Promise<void> {
        this.saving = true;
        try {
            const current = await this.flagsApi.get();
            const next: any = {
                ...current,
                mail: {
                    ...((current as any).mail ?? {}),
                    provider: this.draft.provider,
                    from: this.draft.from || undefined,
                    inquiryRecipient: this.draft.inquiryRecipient || undefined,
                    smtpHost: this.draft.smtpHost || undefined,
                    smtpPort: typeof this.draft.smtpPort === 'number' ? this.draft.smtpPort : undefined,
                    smtpUser: this.draft.smtpUser || undefined,
                    smtpPass: this.draft.smtpPassDirty ? this.draft.smtpPassDisplay : undefined,
                    resendApiKey: this.draft.resendApiKeyDirty ? this.draft.resendApiKeyDisplay : undefined,
                },
            };
            await this.flagsApi.save(next);
            message.success('Email config saved.');
            await this.refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            this.saving = false;
        }
    }

    async testSend(): Promise<void> {
        if (!this.testRecipient || !this.testRecipient.includes('@')) {
            message.warning('Enter a recipient email first.');
            return;
        }
        this.testing = true;
        this.lastTestResult = null;
        try {
            const r = await fetch('/api/email/test', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({to: this.testRecipient}),
            });
            const json = await r.json();
            this.lastTestResult = {ok: !!json.ok, provider: json.provider, error: json.error, durationMs: json.durationMs};
            if (json.ok) message.success(`Sent via ${json.provider} in ${json.durationMs}ms`);
            else message.error(`Test failed: ${json.error ?? 'unknown'}`);
        } catch (err) {
            const msg = String((err as Error)?.message ?? err);
            this.lastTestResult = {ok: false, error: msg};
            message.error(msg);
        } finally {
            this.testing = false;
        }
    }
}
