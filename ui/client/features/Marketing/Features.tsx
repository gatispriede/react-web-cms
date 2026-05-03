import React from 'react';
import {FEATURES} from './copy';

const Features: React.FC = () => (
    <section className="marketing__section" aria-labelledby="features-title">
        <div className="marketing__shell">
            <h2 id="features-title" className="marketing__h2">
                {FEATURES.headline}
            </h2>
            <div className="features__grid">
                {FEATURES.items.map((f) => (
                    <article key={f.title} className="feature">
                        <h3>{f.title}</h3>
                        <p>{f.body}</p>
                    </article>
                ))}
            </div>
        </div>
    </section>
);

export default Features;
