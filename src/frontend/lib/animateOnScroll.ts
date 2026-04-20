let observer: IntersectionObserver | null = null;

function createObserver(): IntersectionObserver {
    return new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('anim-in');
                    observer?.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
}

export function setupAnimations(): void {
    if (typeof window === 'undefined') return;
    if (!observer) observer = createObserver();
    document
        .querySelectorAll<HTMLElement>('[data-anim]:not(.anim-in)')
        .forEach((el) => observer!.observe(el));
}

export function teardownAnimations(): void {
    observer?.disconnect();
    observer = null;
}
