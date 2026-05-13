import React from 'react';
import type {ContactBlockProps, SocialPlatform} from './ContactBlock.types';
import './ContactBlock.scss';

const SOCIAL_LABEL: Record<SocialPlatform, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'Twitter',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
};

const ContactBlock: React.FC<ContactBlockProps> = ({
    testId,
    phone,
    phoneDisplay,
    addressLines,
    mapUrl,
    email,
    social,
    headline = 'Get in touch',
}) => {
    const hasAddress = !!(addressLines && addressLines.length > 0);
    const hasSocial = !!(social && social.length > 0);
    if (!phone && !hasAddress && !email && !hasSocial) return null;

    const addressInner = hasAddress ? (
        <>
            {addressLines!.map((line, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {line}
                </React.Fragment>
            ))}
        </>
    ) : null;

    return (
        <div className="contact-block" data-testid={testId}>
            <h3 className="contact-block__headline">{headline}</h3>
            <dl className="contact-block__fields">
                {phone && (
                    <div className="contact-block__field">
                        <dt className="contact-block__label">Phone</dt>
                        <dd className="contact-block__value">
                            <a
                                className="contact-block__link"
                                href={`tel:${phone.replace(/\s+/g, '')}`}
                                data-testid={`${testId}-phone`}
                            >{phoneDisplay ?? phone}</a>
                        </dd>
                    </div>
                )}
                {hasAddress && (
                    <div className="contact-block__field">
                        <dt className="contact-block__label">Address</dt>
                        <dd className="contact-block__value">
                            <address className="contact-block__address" data-testid={`${testId}-address`}>
                                {mapUrl ? (
                                    <a
                                        className="contact-block__link"
                                        href={mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid={`${testId}-map`}
                                    >{addressInner}</a>
                                ) : addressInner}
                            </address>
                        </dd>
                    </div>
                )}
                {email && (
                    <div className="contact-block__field">
                        <dt className="contact-block__label">Email</dt>
                        <dd className="contact-block__value">
                            <a
                                className="contact-block__link"
                                href={`mailto:${email}`}
                                data-testid={`${testId}-email`}
                            >{email}</a>
                        </dd>
                    </div>
                )}
                {hasSocial && (
                    <div className="contact-block__field">
                        <dt className="contact-block__label">Social</dt>
                        <dd className="contact-block__value">
                            <ul className="contact-block__social" role="list">
                                {social!.map(s => (
                                    <li key={s.platform} className="contact-block__social-item">
                                        <a
                                            className="contact-block__link contact-block__social-link"
                                            href={s.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-testid={`${testId}-social-${s.platform}`}
                                        >{SOCIAL_LABEL[s.platform]}</a>
                                    </li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    );
};

export default ContactBlock;
export {ContactBlock};
export type {ContactBlockProps, ContactSocial, SocialPlatform} from './ContactBlock.types';
