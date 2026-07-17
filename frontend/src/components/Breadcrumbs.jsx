import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './Breadcrumbs.css';

const SITE_URL = 'https://surjitfinance.com';
const JSONLD_ID = 'breadcrumb-jsonld';

/**
 * Renders a breadcrumb trail and mirrors it into a schema.org BreadcrumbList
 * so search engines show the same hierarchy.
 *
 * items: [{ name, path }] — the final item is the current page and omits `path`.
 */
const Breadcrumbs = ({ items = [] }) => {
    // items is rebuilt on every render, so key the effect on its contents.
    const itemsKey = JSON.stringify(items);

    useEffect(() => {
        const trail = JSON.parse(itemsKey);
        if (!trail.length) return undefined;

        let el = document.getElementById(JSONLD_ID);
        if (!el) {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = JSONLD_ID;
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: trail.map((item, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: item.name,
                ...(item.path ? { item: `${SITE_URL}${item.path}` } : {}),
            })),
        });

        return () => {
            const existing = document.getElementById(JSONLD_ID);
            if (existing) existing.remove();
        };
    }, [itemsKey]);

    if (!items.length) return null;

    return (
        <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol className="breadcrumbs-list">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={`${item.name}-${index}`} className="breadcrumbs-item">
                            {isLast || !item.path ? (
                                <span className="breadcrumbs-current" aria-current="page">{item.name}</span>
                            ) : (
                                <>
                                    <Link to={item.path} className="breadcrumbs-link">{item.name}</Link>
                                    <ChevronRight size={14} className="breadcrumbs-sep" aria-hidden="true" />
                                </>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
