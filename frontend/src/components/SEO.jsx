import { useEffect } from 'react';

const SEO = ({
    title,
    description,
    canonical,
    ogImage,
    keywords,
    type = 'website',
}) => {
    useEffect(() => {
        const siteName = 'Surjit Finance';
        const fullTitle = title ? `${title} | ${siteName}` : siteName;

        document.title = fullTitle;

        const setMeta = (name, content, attr = 'name') => {
            if (!content) return;
            let el = document.querySelector(`meta[${attr}="${name}"]`);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute(attr, name);
                document.head.appendChild(el);
            }
            el.setAttribute('content', content);
        };

        const setLink = (rel, href) => {
            if (!href) return;
            let el = document.querySelector(`link[rel="${rel}"]`);
            if (!el) {
                el = document.createElement('link');
                el.setAttribute('rel', rel);
                document.head.appendChild(el);
            }
            el.setAttribute('href', href);
        };

        if (description) setMeta('description', description);
        if (keywords) setMeta('keywords', keywords);

        setMeta('og:type', type, 'property');
        setMeta('og:title', fullTitle, 'property');
        if (description) setMeta('og:description', description, 'property');
        if (ogImage) setMeta('og:image', ogImage, 'property');
        if (canonical) setMeta('og:url', canonical, 'property');

        setMeta('twitter:card', 'summary_large_image');
        setMeta('twitter:title', fullTitle);
        if (description) setMeta('twitter:description', description);
        if (ogImage) setMeta('twitter:image', ogImage);

        if (canonical) setLink('canonical', canonical);
    }, [title, description, canonical, ogImage, keywords, type]);

    return null;
};

export default SEO;
