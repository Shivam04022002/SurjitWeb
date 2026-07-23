import { useLegalPage } from '../hooks';
import SEO from '../components/SEO';
import './PrivacyPolicy.css';

const SITE_URL = 'https://surjitfinance.com';
const SLUG = 'privacy-policy';
const FALLBACK_TITLE = 'Privacy Policy';

// Content is CMS-managed (slug: privacy-policy). The wrapper markup, classes and
// CSS are unchanged — only the body text now comes from the Legal Pages module.
const PrivacyPolicy = () => {
    const { data: page } = useLegalPage(SLUG);

    return (
        <div className="policy-page">
            <SEO
                title={page?.seoTitle || page?.title || FALLBACK_TITLE}
                description={page?.seoDescription}
                canonical={`${SITE_URL}/${SLUG}`}
            />
            <section className="policy-hero">
                <div className="container">
                    <h1>{page?.title || FALLBACK_TITLE}</h1>
                </div>
            </section>

            <section className="policy-content section">
                <div className="container">
                    <div
                        className="policy-card"
                        dangerouslySetInnerHTML={{ __html: page?.content || '' }}
                    />
                </div>
            </section>
        </div>
    );
};

export default PrivacyPolicy;
