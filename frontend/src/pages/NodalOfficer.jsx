import { useLegalPage } from '../hooks';
import SEO from '../components/SEO';
import './NodalOfficer.css';

const SITE_URL = 'https://surjitfinance.com';
const SLUG = 'nodal-officer';
const FALLBACK_TITLE = 'Nodal Officer';
const FALLBACK_DESC = 'Contact our nodal officers for grievance redressal';

// Content is CMS-managed (slug: nodal-officer). The officer cards live in the
// rich-text body; the wrapper markup, classes and CSS are unchanged, so the
// existing two-column card layout and icons render exactly as before.
const NodalOfficer = () => {
    const { data: page } = useLegalPage(SLUG);

    return (
        <div className="nodal-page">
            <SEO
                title={page?.seoTitle || page?.title || FALLBACK_TITLE}
                description={page?.seoDescription}
                canonical={`${SITE_URL}/${SLUG}`}
            />
            <section className="nodal-hero">
                <div className="container">
                    <h1>{page?.title || FALLBACK_TITLE}</h1>
                    <p>{page?.description || FALLBACK_DESC}</p>
                </div>
            </section>

            <section className="nodal-content section">
                <div
                    className="container"
                    dangerouslySetInnerHTML={{ __html: page?.content || '' }}
                />
            </section>
        </div>
    );
};

export default NodalOfficer;
