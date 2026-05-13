import React from 'react';
import type {ServicesGridFancyProps} from './ServicesGridFancy.types';
import './ServicesGridFancy.scss';

const ServicesGridFancy: React.FC<ServicesGridFancyProps> = ({testId, services, columns = 3}) => {
    if (services.length === 0) return null;
    return (
        <ul
            className={`services-grid-fancy services-grid-fancy--cols-${columns}`}
            data-testid={testId}
            data-columns={columns}
        >
            {services.map(svc => (
                <li
                    key={svc.key}
                    className="services-grid-fancy__card"
                    data-testid={`${testId}-card-${svc.key}`}
                >
                    {svc.icon && (
                        <span
                            className="services-grid-fancy__icon"
                            aria-hidden
                            data-testid={`${testId}-icon-${svc.key}`}
                        >{svc.icon}</span>
                    )}
                    <h4 className="services-grid-fancy__title">
                        {svc.href
                            ? <a href={svc.href} data-testid={`${testId}-link-${svc.key}`}>{svc.title}</a>
                            : svc.title}
                    </h4>
                    <p className="services-grid-fancy__blurb">{svc.blurb}</p>
                </li>
            ))}
        </ul>
    );
};

export default ServicesGridFancy;
export {ServicesGridFancy};
export type {ServicesGridFancyProps, FancyService} from './ServicesGridFancy.types';
