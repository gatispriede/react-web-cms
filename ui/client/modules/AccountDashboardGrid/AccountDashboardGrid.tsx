import React from 'react';
import type {AccountDashboardGridProps} from './AccountDashboardGrid.types';
import './AccountDashboardGrid.scss';

const AccountDashboardGrid: React.FC<AccountDashboardGridProps> = ({testId, cards, ariaLabel = 'Account dashboard'}) => {
    if (cards.length === 0) return null;
    return (
        <ul className="account-dashboard-grid" data-testid={testId} aria-label={ariaLabel}>
            {cards.map(card => (
                <li
                    key={card.key}
                    className="account-dashboard-grid__cell"
                    data-testid={`${testId}-card-${card.key}`}
                >
                    <a className="account-dashboard-grid__link" href={card.href} aria-label={`${card.label} — open`}>
                        {card.icon && (
                            <span className="account-dashboard-grid__icon" aria-hidden data-testid={`${testId}-icon-${card.key}`}>{card.icon}</span>
                        )}
                        <span className="account-dashboard-grid__label" data-testid={`${testId}-label-${card.key}`}>{card.label}</span>
                        {typeof card.count === 'number' && (
                            <span className="account-dashboard-grid__count" data-testid={`${testId}-count-${card.key}`}>{card.count}</span>
                        )}
                        {card.helper && (
                            <span className="account-dashboard-grid__helper" data-testid={`${testId}-helper-${card.key}`}>{card.helper}</span>
                        )}
                    </a>
                </li>
            ))}
        </ul>
    );
};

export default AccountDashboardGrid;
export {AccountDashboardGrid};
export type {AccountDashboardGridProps, AccountDashboardCard, AccountDashboardCardKey} from './AccountDashboardGrid.types';
export {DEFAULT_CARD_DEFS} from './AccountDashboardGrid.types';
