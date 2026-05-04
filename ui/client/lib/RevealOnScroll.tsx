import React, {useEffect, useRef, useState} from "react";

interface Props {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    as?: keyof React.JSX.IntrinsicElements;
    /** Optional DOM id forwarded to the rendered tag — used by the
     *  link-target picker so module headlines become deep-link anchors. */
    id?: string;
}

const RevealOnScroll: React.FC<Props> = ({children, delay = 0, className = '', as = 'div', id}) => {
    const ref = useRef<HTMLElement | null>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setShown(true);
            return;
        }
        const io = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setShown(true);
                    io.disconnect();
                    break;
                }
            }
        }, {threshold: 0.12, rootMargin: '0px 0px -40px 0px'});
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const Tag = as as any;
    const style = {transitionDelay: `${delay}ms`};
    return (
        <Tag ref={ref} id={id} className={`reveal-on-scroll ${shown ? 'is-visible' : ''} ${className}`} style={style}>
            {children}
        </Tag>
    );
};

export default RevealOnScroll;
