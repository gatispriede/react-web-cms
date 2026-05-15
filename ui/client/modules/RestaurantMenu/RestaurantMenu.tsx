import React from 'react';
import type {DietaryFlag, RestaurantMenuItem, RestaurantMenuProps, RestaurantMenuSection} from './RestaurantMenu.types';

const DIETARY_LABEL: Record<DietaryFlag, string> = {
    'vegan': 'Vegan',
    'vegetarian': 'Vegetarian',
    'gluten-free': 'Gluten-free',
    'spicy': 'Spicy',
    'contains-alcohol': 'Contains alcohol',
};

function Item({testId, item}: {testId: string; item: RestaurantMenuItem}): React.ReactElement {
    return (
        <li className="restaurant-menu__item" data-testid={`${testId}-item-${item.key}`}>
            <div className="restaurant-menu__item-head">
                <div className="restaurant-menu__item-name-wrap">
                    <span className="restaurant-menu__item-name">{item.name}</span>
                    {item.dietary && item.dietary.length > 0 && (
                        <span className="restaurant-menu__badges">
                            {item.dietary.map(flag => (
                                <span
                                    key={flag}
                                    className={`restaurant-menu__badge restaurant-menu__badge--${flag}`}
                                    data-testid={`${testId}-dietary-${item.key}-${flag}`}
                                    title={DIETARY_LABEL[flag]}
                                >{DIETARY_LABEL[flag]}</span>
                            ))}
                        </span>
                    )}
                </div>
                <span
                    className="restaurant-menu__price"
                    data-testid={`${testId}-price-${item.key}`}
                >{item.priceFormatted}</span>
            </div>
            {item.description && (
                <p className="restaurant-menu__item-desc">{item.description}</p>
            )}
            {item.photoUrl && (
                <img
                    className="restaurant-menu__item-photo"
                    src={item.photoUrl}
                    alt=""
                    loading="lazy"
                    data-testid={`${testId}-photo-${item.key}`}
                />
            )}
        </li>
    );
}

function Section({testId, section, collapsible}: {
    testId: string;
    section: RestaurantMenuSection;
    collapsible: boolean;
}): React.ReactElement {
    const body = (
        <ul className="restaurant-menu__items" role="list">
            {section.items.map(item => (
                <Item key={item.key} testId={testId} item={item} />
            ))}
        </ul>
    );

    if (collapsible) {
        return (
            <section
                className="restaurant-menu__section restaurant-menu__section--collapsible"
                data-testid={`${testId}-section-${section.key}`}
            >
                <details className="restaurant-menu__details" open>
                    <summary className="restaurant-menu__summary">
                        <h3 className="restaurant-menu__title">{section.title}</h3>
                    </summary>
                    {body}
                </details>
            </section>
        );
    }

    return (
        <section
            className="restaurant-menu__section"
            data-testid={`${testId}-section-${section.key}`}
        >
            <h3 className="restaurant-menu__title">{section.title}</h3>
            {body}
        </section>
    );
}

const RestaurantMenu: React.FC<RestaurantMenuProps> = ({testId, sections, collapsibleOnMobile = true}) => {
    if (!sections || sections.length === 0) return null;

    return (
        <div
            className={`restaurant-menu${collapsibleOnMobile ? ' restaurant-menu--collapsible' : ''}`}
            data-testid={testId}
        >
            {sections.map(section => (
                <Section
                    key={section.key}
                    testId={testId}
                    section={section}
                    collapsible={collapsibleOnMobile}
                />
            ))}
        </div>
    );
};

export default RestaurantMenu;
export {RestaurantMenu};
export type {RestaurantMenuProps, RestaurantMenuSection, RestaurantMenuItem, DietaryFlag} from './RestaurantMenu.types';
