import { useEffect } from 'react';
import { classifyClick, trackEvent } from '../utils/analytics';

// Reports tracked user actions — Loan Application CTAs, contact, phone, email,
// product, blog, career and download clicks — from one delegated listener,
// rather than a handler on each of the dozens of buttons and links involved.
// What a click counts as is decided by utils/analytics.js#classifyClick.
//
// Capture phase, so a component that stops propagation still gets counted.
// Pointer clicks and keyboard activation both arrive as `click`; middle-click
// (open in new tab) arrives as `auxclick`.
const ActionTracker = () => {
    useEffect(() => {
        const onClick = (e) => {
            if (e.type === 'auxclick' && e.button !== 1) return;
            if (!(e.target instanceof Element)) return;
            const hit = classifyClick(e.target);
            if (hit) trackEvent(hit.action, { target: hit.target });
        };

        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);
        return () => {
            document.removeEventListener('click', onClick, true);
            document.removeEventListener('auxclick', onClick, true);
        };
    }, []);

    return null;
};

export default ActionTracker;
