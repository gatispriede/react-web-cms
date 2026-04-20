// Pure-JS bcrypt stub for CI where the native binary is unavailable.
// Returns $2b$-prefixed strings so toMatch(/^\$2[aby]\$/) passes in UserService tests.
import {vi} from 'vitest';

export const hash = vi.fn(async (data: string, _saltOrRounds: string | number): Promise<string> =>
    `$2b$10$mockhash.${Buffer.from(data).toString('base64').slice(0, 22)}`
);

export const compare = vi.fn(async (data: string, encrypted: string): Promise<boolean> =>
    encrypted === `$2b$10$mockhash.${Buffer.from(data).toString('base64').slice(0, 22)}`
);

export const genSalt = vi.fn(async (_rounds?: number): Promise<string> => '$2b$10$mocksalt.mocksalt.mock');

export default {hash, compare, genSalt};
