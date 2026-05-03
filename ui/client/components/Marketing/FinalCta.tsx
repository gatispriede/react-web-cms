import React from 'react';
import {FINAL_CTA} from './copy';

const FinalCta: React.FC = () => (
    <section
        className="marketing__section finalCta"
        aria-labelledby="final-cta-title"
    >
        <div className="marketing__shell">
            <h2 id="final-cta-title" className="marketing__h2">
                {FINAL_CTA.headline}
            </h2>
            <p>{FINAL_CTA.body}</p>
            <a className="btn btn--primary" href={FINAL_CTA.cta.href}>
                {FINAL_CTA.cta.label}
            </a>
        </div>
    </section>
);

export default FinalCta;
