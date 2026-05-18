import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {OrderService, type OrderMailer} from './OrderService';
import {StockReservationService} from './StockReservationService';
import {getPaymentProvider} from './payment';
import type {ProductService} from '@services/features/Products/ProductService';
import type {CartService} from '@services/features/Cart/CartService';
import type {InvoiceService} from '@services/features/Invoicing/InvoiceService';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {log} from '@services/infra/logger';

/**
 * Orders Loader — Class Loader L3 migration of `ordersFeature`.
 *
 * Closes the e-commerce migration chain (Audit → Products → Cart →
 * Inventory → Orders). Owns OrderService + StockReservationService
 * (sibling — its natural owner is the order lifecycle).
 *
 * Six checkout-flow resolvers stay inline (rather than going through the
 * guarded `mongo` proxy) because they need request-scoped context:
 * the guest-checkout site flag, cart cookie, and order_token cookie.
 *
 * Mailer closure dynamic-imports the UI's `_inquiryMailer` so the
 * services tree never hard-depends on the UI tree (tests + the
 * standalone server skip cleanly when SMTP env is unset).
 */

interface OrderResolverHooks {
    getCartCookieId?: () => string | null;
    getOrderTokenCookie?: () => string | null;
    setOrderTokenCookie?: (token: string) => void;
}

interface OrderResolverSession {
    kind?: 'admin' | 'customer' | 'anonymous';
    customerId?: string;
}

interface OrderResolverCtx {
    session: OrderResolverSession;
    hooks?: OrderResolverHooks;
}

/**
 * Guest-checkout policy gate. Returns a serialised error envelope when
 * an anonymous caller hits a checkout-flow mutation but the site flag
 * is off; returns `null` when the call is allowed to proceed.
 */
async function guestCheckoutGuard(session: OrderResolverSession): Promise<string | null> {
    if (session.kind !== 'anonymous') return null;
    try {
        const flagsRaw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(flagsRaw);
        const allowed = flags?.allowGuestCheckout !== false;
        if (allowed) return null;
        return JSON.stringify({error: 'Guest checkout is disabled. Sign in to place an order.'});
    } catch {
        return null;
    }
}

/** Resolve the live MongoDBConnection-bound order proxy for resolver thunks. */
function conn() {
    return getMongoConnection();
}

export class OrdersServiceLoader extends ServiceLoader {
    readonly id = 'orders';
    readonly displayName = 'Orders & checkout';
    readonly requires = ['products', 'cart'] as const;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        const products = ctx.services.products as ProductService | undefined;
        if (!products) {
            throw new Error('OrdersServiceLoader: ProductService missing from ctx.services.products');
        }
        const cart = ctx.services.cart as CartService | undefined;
        if (!cart) {
            throw new Error('OrdersServiceLoader: CartService missing from ctx.services.cart');
        }

        const stockReservation = new StockReservationService(ctx.db, products);

        const mailer: OrderMailer | undefined = (() => {
            if (typeof process !== 'undefined' && process.env && (process.env.SMTP_HOST || process.env.SMTP_HOST_FILE)) {
                return {
                    sendOrderConfirmation: async (order, to) => {
                        // W6a — render through the receipt template
                        // registry so the operator's progress timeline +
                        // VAT line + theme tokens drive the email body.
                        try {
                            const [{renderTemplate}, {resolveEmailTheme}, mod] = await Promise.all([
                                import('@services/features/Email/templates/registry'),
                                import('@services/features/Email/templates/_shared/theme'),
                                import('@client/lib/api-helpers/inquiryMailer').catch(() => null),
                            ]);
                            if (!mod || typeof (mod as any).sendInquiryEmail !== 'function') {
                                log.warn({scope: 'orders.mailer'}, 'mailer unreachable; SMTP env set but `_inquiryMailer` not loadable');
                                return;
                            }
                            const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
                            const theme = resolveEmailTheme({
                                siteName: process.env.SITE_NAME || 'Funisimo',
                                siteUrl,
                            });
                            const orderViewUrl = order.customerId
                                ? `${siteUrl}/account/orders/${order.id}`
                                : `${siteUrl}/orders/by-token/${order.orderToken ?? ''}`;
                            const rendered = renderTemplate('receipt', {
                                order,
                                customerName: order.shippingAddress?.name?.split(' ')[0] ?? 'there',
                                orderViewUrl,
                                vatLabel: order.vatRegime?.note,
                                nextStepDate: 'Within 24 hours',
                            }, theme);
                            await (mod as any).sendInquiryEmail({
                                to,
                                subject: rendered.subject,
                                text: rendered.text,
                                html: rendered.html,
                            });
                        } catch (err) {
                            log.error({scope: 'orders.sendConfirmation', err, orderId: order.id}, 'sendOrderConfirmation failed');
                        }
                    },
                };
            }
            return undefined;
        })();

        // Invoicing is an optional sibling — orders works without it
        // (invoice issuance is a no-op), but when present the finalize
        // flow atomically issues + persists the IInvoice. The dependency
        // is loose so the boot graph stays acyclic.
        const invoices = ctx.services.invoices as InvoiceService | undefined;

        const orders = new OrderService(
            ctx.db,
            products,
            cart,
            stockReservation,
            getPaymentProvider(),
            mailer,
            invoices,
        );

        return {orders, stockReservation};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        // Mirrored from `OrderService.ensureIndexes()`.
        {collection: 'Orders', spec: {id: 1}, options: {unique: true}},
        {collection: 'Orders', spec: {orderNumber: 1}, options: {unique: true, sparse: true}},
        {collection: 'Orders', spec: {customerId: 1, createdAt: -1}},
        {collection: 'Orders', spec: {status: 1, updatedAt: -1}},
        {collection: 'Orders', spec: {'paymentRef.authorizationId': 1}, options: {sparse: true}},
        {collection: 'Orders', spec: {orderToken: 1}, options: {sparse: true, unique: true}},
        // Mirrored from `StockReservationService.ensureIndexes()`.
        {collection: 'StockReservations', spec: {id: 1}, options: {unique: true}},
        {collection: 'StockReservations', spec: {status: 1, expiresAt: 1}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    """Customer-only — current customer's order history."""
    myOrders(limit: Int): String!
    """Customer-only — single order by id (IDOR-checked)."""
    myOrder(id: String!): String
    """Guest confirmation page — token must match the order_token cookie."""
    orderByToken(token: String!): String
    """Admin/editor — paged order list."""
    adminOrders(status: String, limit: Int): String!
    """Admin/editor — order detail."""
    adminOrder(id: String!): String
    """Static shipping methods table; reserved for future per-order rates."""
    shippingMethodsFor(orderId: String!): String!
}
extend type MutationMongo {
    """Snapshot cart -> Order, reserve stock, status:pending. Customer or guest (when allowGuestCheckout)."""
    createDraftOrder(cartId: String, currency: String!, guestEmail: String): String!
    attachOrderAddress(orderId: String!, shipping: JSON!, billing: JSON): String!
    attachOrderShipping(orderId: String!, methodCode: String!): String!
    authorizeOrderPayment(orderId: String!, card: JSON!, idempotencyKey: String!): String!
    finalizeOrder(orderId: String!, idempotencyKey: String!): String!
    cancelOrder(orderId: String!): String!
    """Admin: state-machine transition (editor)."""
    adminTransitionOrder(orderId: String!, next: String!, note: String): String!
    """Admin: refund whole order (admin)."""
    adminRefundOrder(orderId: String!, amount: Int, reason: String): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            adminTransitionOrder: 'editor',
            adminRefundOrder: 'admin',
        },
        queryRequirements: {
            adminOrders: 'editor',
            adminOrder: 'editor',
            shippingMethodsFor: 'editor',
        },
        sessionInjected: [
            'adminTransitionOrder',
            'adminRefundOrder',
        ],
        customerMutations: [
            'createDraftOrder',
            'attachOrderAddress',
            'attachOrderShipping',
            'authorizeOrderPayment',
            'finalizeOrder',
            'cancelOrder',
        ],
        customerQueries: [
            'myOrders',
            'myOrder',
        ],
        customerSessionInjected: [
            'myOrders',
            'myOrder',
            'createDraftOrder',
            'attachOrderAddress',
            'attachOrderShipping',
            'authorizeOrderPayment',
            'finalizeOrder',
            'cancelOrder',
        ],
        anonOpenMutations: [
            'createDraftOrder',
            'attachOrderAddress',
            'attachOrderShipping',
            'authorizeOrderPayment',
            'finalizeOrder',
            'cancelOrder',
        ],
        // Q10 — order-state mutations gate on the Orders feature only.
        // Customer-facing checkout-flow mutations (createDraftOrder etc.)
        // are NOT resourceGated — they're customer/anonymous endpoints
        // that bypass the admin grant model entirely.
        resourceGated: {
            adminTransitionOrder: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Orders'},
            }),
            adminRefundOrder: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Orders'},
            }),
        },
    };

    readonly resolvers = {
        QueryMongo: {
            orderByToken: (_parent: unknown, args: {token: string}, ctx: OrderResolverCtx) => {
                const cookieToken = ctx.hooks?.getOrderTokenCookie?.() ?? null;
                return conn().orderByToken({token: args.token, cookieToken});
            },
        },
        MutationMongo: {
            createDraftOrder: async (parent: any, args: {cartId?: string; currency: string; guestEmail?: string}, ctx: OrderResolverCtx) => {
                const guard = await guestCheckoutGuard(ctx.session);
                if (guard) return guard;
                let cartId = args.cartId;
                if (!cartId && ctx.session.kind !== 'customer') {
                    cartId = ctx.hooks?.getCartCookieId?.() ?? undefined;
                }
                return parent.createDraftOrder({...args, cartId});
            },
            attachOrderAddress: (parent: any, args: any, ctx: OrderResolverCtx) =>
                guestCheckoutGuard(ctx.session).then(g => g ?? parent.attachOrderAddress(args)),
            attachOrderShipping: (parent: any, args: any, ctx: OrderResolverCtx) =>
                guestCheckoutGuard(ctx.session).then(g => g ?? parent.attachOrderShipping(args)),
            authorizeOrderPayment: (parent: any, args: any, ctx: OrderResolverCtx) =>
                guestCheckoutGuard(ctx.session).then(g => g ?? parent.authorizeOrderPayment(args)),
            finalizeOrder: async (parent: any, args: any, ctx: OrderResolverCtx) => {
                const guard = await guestCheckoutGuard(ctx.session);
                if (guard) return guard;
                const result = await parent.finalizeOrder(args);
                try {
                    const parsed = JSON.parse(result);
                    const order = parsed?.finalizeOrder;
                    if (order && !order.customerId && order.orderToken && ctx.hooks?.setOrderTokenCookie) {
                        ctx.hooks.setOrderTokenCookie(order.orderToken);
                    }
                } catch { /* error envelope — pass through */ }
                return result;
            },
            cancelOrder: (parent: any, args: any, ctx: OrderResolverCtx) =>
                guestCheckoutGuard(ctx.session).then(g => g ?? parent.cancelOrder(args)),
        },
    };
}
