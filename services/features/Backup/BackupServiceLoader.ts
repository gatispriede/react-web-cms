import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {BackupService} from './BackupService';
import {registerBackupCron} from './BackupScheduler';
import {log} from '@services/infra/logger';

/**
 * W8e — Backup feature loader.
 *
 * Builds the `BackupService` (always — gating happens inside the service
 * via env checks so the admin pane always renders, surfacing a clear
 * "backup disabled" state when creds are missing) and registers the cron
 * scheduler on boot.
 *
 * `coreInfrastructure: true` — backup is a platform concern; we don't
 * want operators accidentally toggling it off via the feature flag pane.
 */
export class BackupServiceLoader extends ServiceLoader {
    readonly id = 'backup';
    readonly displayName = 'Backup + disaster recovery';
    readonly coreInfrastructure = true;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {backup: new BackupService({db: ctx.db})};
    }

    async onBoot(ctx: FeatureContext): Promise<void> {
        const svc = ctx.services.backup as BackupService | undefined;
        if (!svc) return;
        // Wire audit (lazy — AuditService lives on the connection class).
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const {getMongoConnection} = require('@services/infra/mongoDBConnection');
            const conn = getMongoConnection() as {auditService?: unknown};
            if (conn?.auditService) svc.setAuditService(conn.auditService as never);
        } catch { /* audit optional */ }
        try {
            const result = registerBackupCron(svc);
            log.info({scope: 'backup.boot', cronRegistered: result.registered, reason: result.reason}, 'backup boot complete');
        } catch (err) {
            log.warn({scope: 'backup.boot', err}, 'backup cron registration failed');
        }
    }

    readonly schemaSDL = `extend type QueryMongo {
    """W8e — latest backup status + last drill result. Admin-only."""
    backupStatus: String!
    """W8e — recent backup snapshots from the restic repo. Admin-only."""
    backupListSnapshots: String!
}
extend type MutationMongo {
    """W8e — trigger an immediate backup. Admin-only."""
    backupNow(label: String): String!
    """W8e — run \`restic check\` against the latest snapshot. Admin-only."""
    backupVerify: String!
    """W8e — restore a snapshot into a sandbox staging directory. Admin-only."""
    backupRestoreToStaging(snapshotId: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            backupStatus: 'admin',
            backupListSnapshots: 'admin',
        },
        mutationRequirements: {
            backupNow: 'admin',
            backupVerify: 'admin',
            backupRestoreToStaging: 'admin',
        },
        sessionInjected: [
            'backupNow',
            'backupVerify',
            'backupRestoreToStaging',
        ],
    };
}
