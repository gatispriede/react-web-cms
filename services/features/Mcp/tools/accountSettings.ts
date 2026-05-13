/**
 * client-account-settings-page (Phase 1.E) — MCP tool surface.
 *
 * Tools:
 *   accountSettings.get          — admin-only read of full profile
 *   accountSettings.update       — admin-only patch (validation per type)
 *   customer.type.set            — flip 'client' ↔ 'company' (audit-logged)
 *   customer.list                — list customers (optional filterByType)
 *   customer.company.viesRefresh — re-run VIES check + cache result
 *   customer.profile.get/update  — fine-grained admin alias of accountSettings.*
 *   customer.addresses.*         — address CRUD (admin-mediated)
 *   customer.paymentMethods.*    — payment-method CRUD (admin-mediated)
 *
 * All write tools are `idempotent: true` and tag `auditScope: 'customer'`.
 * Scope mirrors the existing `users.ts` tool family — `admin:auth`.
 */
import type {McpTool, JSONSchemaObject, JSONSchemaProp} from '../types';
import {defineTool} from './_shared';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {getCustomerProfileService} from '@services/features/Customer/CustomerProfileService';

interface ConnHandle {
    database?: unknown;
}

function db(): {collection: (n: string) => never} {
    const conn = getMongoConnection() as unknown as ConnHandle;
    if (!conn.database) throw new Error('Database not ready');
    return conn.database as never;
}
function svc() { return getCustomerProfileService(db()); }

const userIdProp: JSONSchemaProp = {type: 'string', minLength: 1};
const idemKeyProp: JSONSchemaProp = {type: 'string'};
const stringProp: JSONSchemaProp = {type: 'string'};
const boolProp: JSONSchemaProp = {type: 'boolean'};
const customerTypeProp: JSONSchemaProp = {type: 'string', enum: ['client', 'company']};

const justUserId: JSONSchemaObject = {
    type: 'object',
    required: ['userId'],
    properties: {userId: userIdProp},
};

const addressShape: JSONSchemaProp = {
    type: 'object',
    required: ['name', 'line1', 'city', 'postalCode', 'country'],
    properties: {
        name: stringProp,
        line1: stringProp,
        line2: stringProp,
        city: stringProp,
        postalCode: stringProp,
        country: stringProp,
        isDefault: boolProp,
    },
};
const paymentRefShape: JSONSchemaProp = {
    type: 'object',
    required: ['provider', 'tokenizedId'],
    properties: {
        provider: {type: 'string', enum: ['stripe', 'paypal', 'klarna']},
        tokenizedId: stringProp,
        last4: stringProp,
        expiryMonth: {type: 'integer', minimum: 1, maximum: 12},
        expiryYear: {type: 'integer', minimum: 2024, maximum: 2099},
        isDefault: boolProp,
    },
};
const patchProp: JSONSchemaProp = {type: 'object'};

export const accountSettingsGet: McpTool = defineTool({
    name: 'accountSettings.get',
    description: 'Admin-only read of a customer\'s full account-settings record (profile + addresses + payment methods + company sub-record).',
    scopes: ['admin:auth'],
    auditScope: 'customer',
    inputSchema: justUserId,
}, async (args) => {
    const u = await svc().getProfile(String(args.userId));
    if (!u) return {ok: false, error: 'user not found'};
    return {ok: true, user: u};
});

export const accountSettingsUpdate: McpTool = defineTool({
    name: 'accountSettings.update',
    description: 'Admin-only patch of curated customer fields. Drops admin-only fields (`role`, `kind`, `password`). Validates per `customerType`.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'patch'],
        properties: {userId: userIdProp, patch: patchProp, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().updateProfile(String(args.userId), args.patch as Record<string, unknown>));

export const customerTypeSet: McpTool = defineTool({
    name: 'customer.type.set',
    description: 'Flip a customer\'s account discriminator between "client" and "company". `company → client` requires `{ack: true}`.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'type'],
        properties: {userId: userIdProp, type: customerTypeProp, ack: boolProp, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().setCustomerType(String(args.userId), args.type as 'client' | 'company', {ack: Boolean(args.ack)}));

export const customerList: McpTool = defineTool({
    name: 'customer.list',
    description: 'List customers (kind=customer). Optional `filterByType` narrows to client or company. Capped at 500 rows per call.',
    scopes: ['admin:auth'],
    inputSchema: {
        type: 'object',
        properties: {
            filterByType: customerTypeProp,
            limit: {type: 'integer', minimum: 1, maximum: 500},
        },
    },
}, async (args) => {
    const rows = await svc().listCustomers({
        filterByType: args.filterByType as 'client' | 'company' | undefined,
        limit: Number(args.limit ?? 100),
    });
    return {rows};
});

export const customerCompanyViesRefresh: McpTool = defineTool({
    name: 'customer.company.viesRefresh',
    description: 'Re-run VIES verification for a company-type customer. Caches the verdict on `company.viesVerified*`. Soft-fails (returns viesVerified:null) when upstream unreachable — surfaces a "pending verification" badge on the storefront.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {userId: userIdProp, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().verifyCompanyVat(String(args.userId)));

export const customerProfileGet: McpTool = defineTool({
    name: 'customer.profile.get',
    description: 'Admin-only — alias for accountSettings.get.',
    scopes: ['admin:auth'],
    auditScope: 'customer',
    inputSchema: justUserId,
}, async (args) => {
    const u = await svc().getProfile(String(args.userId));
    if (!u) return {ok: false, error: 'user not found'};
    return {ok: true, user: u};
});

export const customerProfileUpdate: McpTool = defineTool({
    name: 'customer.profile.update',
    description: 'Admin-only — alias for accountSettings.update.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'patch'],
        properties: {userId: userIdProp, patch: patchProp, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().updateProfile(String(args.userId), args.patch as Record<string, unknown>));

export const customerAddressesList: McpTool = defineTool({
    name: 'customer.addresses.list',
    description: 'List a customer\'s saved shipping addresses.',
    scopes: ['admin:auth'],
    inputSchema: justUserId,
}, async (args) => {
    const u = await svc().getProfile(String(args.userId));
    return {rows: u?.shippingAddresses ?? []};
});

export const customerAddressesAdd: McpTool = defineTool({
    name: 'customer.addresses.add',
    description: 'Append a saved address. If `isDefault` is true the previous default is cleared.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'address'],
        properties: {userId: userIdProp, address: addressShape, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().addAddress(String(args.userId), args.address));

export const customerAddressesUpdate: McpTool = defineTool({
    name: 'customer.addresses.update',
    description: 'Patch a saved address by id.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'addressId', 'patch'],
        properties: {userId: userIdProp, addressId: {type: 'string', minLength: 1}, patch: patchProp, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().updateAddress(String(args.userId), String(args.addressId), args.patch));

export const customerAddressesDelete: McpTool = defineTool({
    name: 'customer.addresses.delete',
    description: 'Remove a saved address.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'addressId'],
        properties: {userId: userIdProp, addressId: {type: 'string', minLength: 1}, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().deleteAddress(String(args.userId), String(args.addressId)));

export const customerAddressesSetDefault: McpTool = defineTool({
    name: 'customer.addresses.setDefault',
    description: 'Flip the default-shipping flag onto one address (clears all others).',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'addressId'],
        properties: {userId: userIdProp, addressId: {type: 'string', minLength: 1}, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().setDefaultAddress(String(args.userId), String(args.addressId)));

export const customerPaymentMethodsList: McpTool = defineTool({
    name: 'customer.paymentMethods.list',
    description: 'List a customer\'s tokenized payment-method refs.',
    scopes: ['admin:auth'],
    inputSchema: justUserId,
}, async (args) => {
    const u = await svc().getProfile(String(args.userId));
    return {rows: u?.paymentMethods ?? []};
});

export const customerPaymentMethodsAdd: McpTool = defineTool({
    name: 'customer.paymentMethods.add',
    description: 'Append a tokenized payment-method ref. Never accepts raw card data.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'ref'],
        properties: {userId: userIdProp, ref: paymentRefShape, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().addPaymentMethod(String(args.userId), args.ref));

export const customerPaymentMethodsRemove: McpTool = defineTool({
    name: 'customer.paymentMethods.remove',
    description: 'Remove a saved payment-method ref by id.',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'refId'],
        properties: {userId: userIdProp, refId: {type: 'string', minLength: 1}, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().removePaymentMethod(String(args.userId), String(args.refId)));

export const customerPaymentMethodsSetDefault: McpTool = defineTool({
    name: 'customer.paymentMethods.setDefault',
    description: 'Flip the default-payment flag onto one method (clears all others).',
    scopes: ['admin:auth'],
    idempotent: true,
    auditScope: 'customer',
    inputSchema: {
        type: 'object',
        required: ['userId', 'refId'],
        properties: {userId: userIdProp, refId: {type: 'string', minLength: 1}, idempotencyKey: idemKeyProp},
    },
}, async (args) => svc().setDefaultPaymentMethod(String(args.userId), String(args.refId)));

export const ACCOUNT_SETTINGS_TOOLS: McpTool[] = [
    accountSettingsGet,
    accountSettingsUpdate,
    customerTypeSet,
    customerList,
    customerCompanyViesRefresh,
    customerProfileGet,
    customerProfileUpdate,
    customerAddressesList,
    customerAddressesAdd,
    customerAddressesUpdate,
    customerAddressesDelete,
    customerAddressesSetDefault,
    customerPaymentMethodsList,
    customerPaymentMethodsAdd,
    customerPaymentMethodsRemove,
    customerPaymentMethodsSetDefault,
];
