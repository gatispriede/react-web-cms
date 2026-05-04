import {ClientUILoader, ClientPublicRoute} from '@client/lib/loaders/ClientUILoader';

/**
 * Orders feature — public routes (Class Loader L4).
 *
 * The `/checkout` flow is gated by the `orders` feature flag (the
 * downstream PSP calls live in the orders backend). The cart page sits
 * on the `cart` flag — see `CartClientUILoader`.
 */
export class OrdersClientUILoader extends ClientUILoader {
    readonly id = 'orders';
    readonly displayName = 'Orders';

    readonly publicRoutes: readonly ClientPublicRoute[] = [
        {path: '/checkout'},
    ];
}
