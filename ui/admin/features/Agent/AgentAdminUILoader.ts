import {AdminUILoader, AdminPaneDescriptor} from '@admin/lib/loaders/AdminUILoader';
import AgentPanel from './AgentPanel';

/**
 * AI Agent admin pane — chat UI backed by /api/agent/stream.
 *
 * Runs fully inside the Next.js process (npm run dev / npm run start).
 * No separate server required.
 *
 * Backend selection via env:
 *   AGENT_BACKEND=claude  (default) — Anthropic API
 *   AGENT_BACKEND=ollama            — local Ollama, set OLLAMA_BASE_URL
 */
export class AgentAdminUILoader extends AdminUILoader {
    readonly id = 'agent';
    readonly displayName = 'AI Agent';

    readonly adminPane: AdminPaneDescriptor = {
        id:    'system/agent',
        title: 'AI Agent',
        route: '/admin/system/agent',
        modes: { advanced: AgentPanel },
        advancedOnly: true,
    };
}
