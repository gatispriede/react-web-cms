import {Collection, Db} from 'mongodb';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';

const KEY = 'footer';

export class FooterService {
    private settings: Collection;

    constructor(db: Db) {
        this.settings = db.collection('SiteSettings');
    }

    async get(): Promise<IFooterConfig> {
        const doc = await this.settings.findOne({key: KEY});
        const value = (doc as any)?.value as IFooterConfig | undefined;
        return {
            enabled: value?.enabled ?? DEFAULT_FOOTER.enabled,
            columns: Array.isArray(value?.columns) ? value!.columns : DEFAULT_FOOTER.columns,
            bottom: value?.bottom ?? DEFAULT_FOOTER.bottom,
            version: (doc as any)?.version ?? 0,
            editedBy: (doc as any)?.editedBy,
            editedAt: (doc as any)?.editedAt,
        };
    }

    async save(config: IFooterConfig, editedBy?: string, expectedVersion?: number | null): Promise<{ok: true; version: number}> {
        const existing = await this.settings.findOne({key: KEY});
        const existingVersion = (existing as any)?.version as number | undefined;
        requireVersion(await this.get(), existingVersion, expectedVersion, 'Footer');
        const sanitized: IFooterConfig = {
            enabled: Boolean(config.enabled),
            bottom: typeof config.bottom === 'string' ? config.bottom.slice(0, 500) : undefined,
            columns: (config.columns ?? [])
                .slice(0, 8)
                .map(col => ({
                    title: String(col.title ?? '').slice(0, 60),
                    entries: (col.entries ?? []).slice(0, 20).map(e => ({
                        label: String(e.label ?? '').slice(0, 80),
                        url: typeof e.url === 'string' ? e.url.slice(0, 500) : undefined,
                    })),
                })),
        };
        const version = nextVersion(existingVersion);
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: sanitized, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return {ok: true, version};
    }
}
