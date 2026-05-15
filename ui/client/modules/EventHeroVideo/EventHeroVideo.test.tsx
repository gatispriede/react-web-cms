// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import EventHeroVideo from './EventHeroVideo';

describe('EventHeroVideo', () => {
    it('motion path renders <video>', () => {
        render(
            <EventHeroVideo
                testId="hv"
                videoUrl="/v.mp4"
                posterUrl="/p.jpg"
                headline="Hello"
            />,
        );
        expect(screen.getByTestId('hv-video').tagName).toBe('VIDEO');
        expect(screen.queryByTestId('hv-poster')).toBeNull();
    });

    it('reduced-motion path renders <img poster>', () => {
        render(
            <EventHeroVideo
                testId="hv"
                videoUrl="/v.mp4"
                posterUrl="/p.jpg"
                headline="Hello"
                forceReducedMotion
            />,
        );
        expect(screen.getByTestId('hv-poster').tagName).toBe('IMG');
        expect(screen.getByTestId('hv-poster').getAttribute('src')).toBe('/p.jpg');
        expect(screen.queryByTestId('hv-video')).toBeNull();
    });

    it('headline + sub render', () => {
        render(
            <EventHeroVideo
                testId="hv"
                videoUrl="/v.mp4"
                posterUrl="/p.jpg"
                headline="Big Headline"
                subHeadline="Sub line"
            />,
        );
        expect(screen.getByTestId('hv-headline')).toHaveTextContent('Big Headline');
        expect(screen.getByText('Sub line')).toBeInTheDocument();
    });

    it('countdownTarget propagates to CountdownTimer', () => {
        render(
            <EventHeroVideo
                testId="hv"
                videoUrl="/v.mp4"
                posterUrl="/p.jpg"
                headline="Hello"
                countdownTarget="2030-01-01T00:00:00.000Z"
                forceReducedMotion
            />,
        );
        expect(screen.getByTestId('hv-countdown')).toBeInTheDocument();
    });

    it('CTA renders with correct href', () => {
        render(
            <EventHeroVideo
                testId="hv"
                videoUrl="/v.mp4"
                posterUrl="/p.jpg"
                headline="Hello"
                primaryCta={{label: 'Register', href: '/r'}}
            />,
        );
        const cta = screen.getByTestId('hv-cta');
        expect(cta.getAttribute('href')).toBe('/r');
        expect(cta).toHaveTextContent('Register');
    });

    it('renders nothing when both URLs absent', () => {
        const {container} = render(
            <EventHeroVideo testId="hv" videoUrl="" posterUrl="" headline="Hello" />,
        );
        expect(container.firstChild).toBeNull();
    });
});
