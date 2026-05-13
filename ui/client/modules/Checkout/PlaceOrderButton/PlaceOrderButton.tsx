/** PlaceOrderButton — Phase 1.D. Locked final-submit; auth→capture→confirmation. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IPlaceOrderButton} from './PlaceOrderButton.types';
import './PlaceOrderButton.scss';
export interface PlaceOrderButtonProps { item: IItem; onClick?: () => void; }
function parseContent(raw: string|object|undefined): IPlaceOrderButton {
    if (!raw) return {} as IPlaceOrderButton;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as IPlaceOrderButton; } catch { return {} as IPlaceOrderButton; } }
    return raw as IPlaceOrderButton;
}
const PlaceOrderButton: React.FC<PlaceOrderButtonProps> = ({item, onClick}) => {
    const c = parseContent(item.content);
    return (
        <button type="button" className="place-order-button" data-testid="module-place-order-button" onClick={onClick}>
            {c.label ?? 'Place order'}
        </button>
    );
};
export default PlaceOrderButton;
export {PlaceOrderButton};
export {EPlaceOrderButtonStyle, type IPlaceOrderButton} from './PlaceOrderButton.types';
