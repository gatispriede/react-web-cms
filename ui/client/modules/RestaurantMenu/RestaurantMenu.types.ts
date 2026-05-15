export type DietaryFlag = 'vegan' | 'vegetarian' | 'gluten-free' | 'spicy' | 'contains-alcohol';

export interface RestaurantMenuItem {
    key: string;
    name: string;
    description?: string;
    priceFormatted: string;
    photoUrl?: string;
    dietary?: DietaryFlag[];
}

export interface RestaurantMenuSection {
    key: string;
    title: string;
    items: RestaurantMenuItem[];
}

export interface RestaurantMenuProps {
    testId: string;
    sections: RestaurantMenuSection[];
    /** Mobile: collapsible sections (default true). When false, all sections expanded. */
    collapsibleOnMobile?: boolean;
}
