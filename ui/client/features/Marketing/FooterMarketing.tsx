import React from 'react';
import {FOOTER} from './copy';

const FooterMarketing: React.FC = () => {
    const year = new Date().getFullYear();
    return (
        <footer className="mfooter" aria-label="Marketing footer">
            <div className="marketing__shell mfooter__row">
                <span>{FOOTER.copyright(year)}</span>
                <nav aria-label="Footer navigation">
                    {FOOTER.links.map((link) => (
                        <a key={link.href} href={link.href}>{link.label}</a>
                    ))}
                </nav>
            </div>
        </footer>
    );
};

export default FooterMarketing;
