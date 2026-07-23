import { useLegalPage } from '../hooks';
import SEO from '../components/SEO';
import './PrivacyPolicy.css';

const SITE_URL = 'https://surjitfinance.com';
const SLUG = 'refund-policy';
const FALLBACK_TITLE = 'Refund Policy';

// Content is CMS-managed (slug: refund-policy). The body — including the
// download button and the key-points box — comes from the Legal Pages module,
// rendered inside the same wrapper markup and CSS the page has always used.
const RefundPolicy = () => {
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

export default RefundPolicy;
