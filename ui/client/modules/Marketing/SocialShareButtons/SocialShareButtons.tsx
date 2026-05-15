/** SocialShareButtons — Phase 1.D. Composable share-this-order links. */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {ISocialShareButtons} from './SocialShareButtons.types';

export interface SocialShareButtonsProps { item: IItem; url?: string; }
function parseContent(raw: string|object|undefined): ISocialShareButtons {
    if (!raw) return {} as ISocialShareButtons;
    if (typeof raw === 'string') { try { return JSON.parse(raw) as ISocialShareButtons; } catch { return {} as ISocialShareButtons; } }
    return raw as ISocialShareButtons;
}
const SocialShareButtons: React.FC<SocialShareButtonsProps> = ({item, url}) => {
    const c = parseContent(item.content);
    const shareUrl = encodeURIComponent(url ?? c.url ?? '');
    return (
        <ul className="social-share-buttons" data-testid="module-social-share-buttons">
            <li><a target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${shareUrl}`} data-testid="social-share-twitter">Twitter</a></li>
            <li><a target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} data-testid="social-share-facebook">Facebook</a></li>
            <li><a target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} data-testid="social-share-linkedin">LinkedIn</a></li>
        </ul>
    );
};
export default SocialShareButtons;
export {SocialShareButtons};
export {ESocialShareButtonsStyle, type ISocialShareButtons} from './SocialShareButtons.types';
