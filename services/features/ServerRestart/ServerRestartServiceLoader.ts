import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext} from '@services/infra/featureManifest';
import {ServerRestartService} from './ServerRestartService';

/**
 * Server-restart Loader — implementation of `docs/features/platform/server-restart.md`.
 *
 * `coreInfrastructure: true` because operators that DO have a supervisor
 * shouldn't be able to flip the feature off (would leave them with no
 * way to apply boot-time config without shell access). Operators who
 * don't want it can still set `SERVER_RESTART_ENABLED=false` at the env
 * level — env > admin UI for this one.
 */
export class ServerRestartServiceLoader extends ServiceLoader {
    readonly id = 'serverRestart';
    readonly displayName = 'Server restart';
    readonly coreInfrastructure = true;

    buildServices(): Record<string, unknown> {
        return {serverRestart: new ServerRestartService()};
    }

    readonly schemaSDL = `extend type QueryMongo {
    """Restart status — current bootId, uptime, supervisor detection, pending restart reasons."""
    getRestartStatus: String!
}
extend type MutationMongo {
    """Schedule a graceful server shutdown; supervisor respawns. Returns the current bootId so the caller can poll /api/health for the new process."""
    requestServerRestart: String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            getRestartStatus: 'admin',
        },
        mutationRequirements: {
            requestServerRestart: 'admin',
        },
        sessionInjected: [
            // Stamp the actor on the audit log so we know who triggered.
            'requestServerRestart',
        ],
    };
}
