import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

// Reports one page view per route change, following the same null-rendering
// listener pattern as ScrollToTop.
//
// The effect depends on pathname alone, so a re-render, a hash jump to an
// on-page anchor, or a query-string change does not count as a new page view.
// The ref additionally guards against the same path being reported twice —
// React 18 StrictMode invokes effects twice in development, and without this a
// local run would inflate every figure.
const PageViewTracker = () => {
    const location = useLocation();
    const lastPath = useRef(null);

    useEffect(() => {
        if (lastPath.current === location.pathname) return;
        lastPath.current = location.pathname;
        trackPageView(location.pathname);
    }, [location.pathname]);

    return null;
};

export default PageViewTracker;
