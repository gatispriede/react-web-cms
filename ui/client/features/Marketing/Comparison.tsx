import React from 'react';
import {COMPARISON} from './copy';

const Comparison: React.FC = () => (
    <section
        id="comparison"
        className="marketing__section"
        aria-labelledby="comparison-title"
    >
        <div className="marketing__shell">
            <h2 id="comparison-title" className="marketing__h2">
                {COMPARISON.headline}
            </h2>
            <div className="compare__grid">
                {COMPARISON.items.map((item) => (
                    <div key={item.title} className="compare__item">
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);

export default Comparison;
