import { MongoClient } from 'mongodb';
import { McpTokenService } from '../services/features/Mcp/McpTokenService.js';

const client = await MongoClient.connect('mongodb://localhost:27017');
const db = client.db('DB');
const svc = new McpTokenService(db);
const issued = await svc.issueToken(
  { name: 'local-llm', scopes: ['read:content', 'write:content', 'read:site', 'write:site'], ttlDays: 365 },
  'cli'
);
process.stderr.write('TOKEN_SECRET=' + issued.secret + '\n');
await client.close();
process.exit(0);
