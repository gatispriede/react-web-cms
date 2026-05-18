/** AccountWelcome — Phase 1.D. Locked dashboard greeting + quick links. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IAccountWelcome} from './AccountWelcome.types';
export interface AccountWelcomeProps { item: IItem; name?: string; }
function parseContent(raw: string|object|undefined): IAccountWelcome {
    if (!raw) return {} as IAccountWelcome;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IAccountWelcome; } catch { return {} as IAccountWelcome; } }
    return raw as IAccountWelcome;
}
const AccountWelcome: React.FC<AccountWelcomeProps> = ({item, name}) => {
    const c = parseContent(item.content);
    const greeting = c.title ?? (name ? `Hi ${name}!` : 'Welcome back');
    return (
        <section className={`account-welcome${item.style && item.style !== 'default' ? ` ${item.style as string}` : ''}`} data-testid="module-account-welcome">
            <h1>{greeting}</h1>
            <nav className="account-welcome__nav">
                <a href="/account/orders" data-testid="account-welcome-orders">Orders</a>
                <a href="/account/addresses" data-testid="account-welcome-addresses">Addresses</a>
                <a href="/account/settings" data-testid="account-welcome-settings">Settings</a>
            </nav>
        </section>
    );
};
export default AccountWelcome;
export {AccountWelcome};
export {EAccountWelcomeStyle, type IAccountWelcome} from './AccountWelcome.types';
