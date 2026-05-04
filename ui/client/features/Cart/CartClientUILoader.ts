import {ClientUILoader, ClientPublicRoute} from '@client/lib/loaders/ClientUILoader';

/**
 * Cart feature — public routes (Class Loader L4).
 *
 * `/cart` is gated by the `cart` flag. Drawer/icon components live next
 * to this loader but don't need to be registered here — they're imported
 * directly by the layout chrome.
 */
export class CartClientUILoader extends ClientUILoader {
    readonly id = 'cart';
    readonly displayName = 'Cart';

    readonly publicRoutes: readonly ClientPublicRoute[] = [
        {path: '/cart'},
    ];
}
