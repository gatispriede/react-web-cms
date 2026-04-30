/**
 * Hand-rolled GraphQL client for the checkout flow. Mirrors the shape
 * `account/_gqlClient.ts` uses — every checkout mutation returns a
 * JSON-envelope String, so we POST and parse the inner shape here.
 */

async function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
    const res = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query, variables}),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0]?.message || 'GraphQL error');
    return json.data;
}

const parse = (raw: string | null | undefined) => {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
};

export async function createDraftOrder(args: {cartId?: string; currency: string; guestEmail?: string}) {
    const data = await gql(
        `mutation CreateDraft($cartId: String, $currency: String!, $guestEmail: String) { mongo { createDraftOrder(cartId: $cartId, currency: $currency, guestEmail: $guestEmail) } }`,
        args,
    );
    return parse(data?.mongo?.createDraftOrder);
}

export async function attachOrderAddress(args: {orderId: string; shipping: any; billing?: any}) {
    const data = await gql(
        `mutation AttachAddr($orderId: String!, $shipping: JSON!, $billing: JSON) { mongo { attachOrderAddress(orderId: $orderId, shipping: $shipping, billing: $billing) } }`,
        args,
    );
    return parse(data?.mongo?.attachOrderAddress);
}

export async function attachOrderShipping(args: {orderId: string; methodCode: string}) {
    const data = await gql(
        `mutation AttachShip($orderId: String!, $methodCode: String!) { mongo { attachOrderShipping(orderId: $orderId, methodCode: $methodCode) } }`,
        args,
    );
    return parse(data?.mongo?.attachOrderShipping);
}

export async function authorizeOrderPayment(args: {orderId: string; card: any; idempotencyKey: string}) {
    const data = await gql(
        `mutation Authorize($orderId: String!, $card: JSON!, $idempotencyKey: String!) { mongo { authorizeOrderPayment(orderId: $orderId, card: $card, idempotencyKey: $idempotencyKey) } }`,
        args,
    );
    return parse(data?.mongo?.authorizeOrderPayment);
}

export async function finalizeOrder(args: {orderId: string; idempotencyKey: string}) {
    const data = await gql(
        `mutation Finalize($orderId: String!, $idempotencyKey: String!) { mongo { finalizeOrder(orderId: $orderId, idempotencyKey: $idempotencyKey) } }`,
        args,
    );
    return parse(data?.mongo?.finalizeOrder);
}

export async function shippingMethodsFor(orderId: string) {
    const data = await gql(
        `query Ships($orderId: String!) { mongo { shippingMethodsFor(orderId: $orderId) } }`,
        {orderId},
    );
    return parse(data?.mongo?.shippingMethodsFor) || [];
}

export async function myOrder(id: string) {
    const data = await gql(
        `query MyOrder($id: String!) { mongo { myOrder(id: $id) } }`,
        {id},
    );
    return parse(data?.mongo?.myOrder);
}

export async function myOrders(limit = 25) {
    const data = await gql(
        `query MyOrders($limit: Int) { mongo { myOrders(limit: $limit) } }`,
        {limit},
    );
    return parse(data?.mongo?.myOrders) || [];
}

export async function orderByToken(token: string) {
    const data = await gql(
        `query ByToken($token: String!) { mongo { orderByToken(token: $token) } }`,
        {token},
    );
    return parse(data?.mongo?.orderByToken);
}

export const formatMoney = (amount: number | undefined, currency: string | null | undefined) => {
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'USD'}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency ?? ''}`;
    }
};
