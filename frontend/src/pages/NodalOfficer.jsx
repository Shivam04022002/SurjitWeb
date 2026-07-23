import { Mail, Phone, MapPin } from 'lucide-react';
import { useNodalOfficers } from '../hooks';
import SEO from '../components/SEO';
import './NodalOfficer.css';

const SITE_URL = 'https://surjitfinance.com';

// The hero copy has always been fixed on this page; only the officer cards were
// hardcoded, and those are now CMS-managed via the Nodal Officers module. The
// wrapper markup, classes, icons and CSS are unchanged — each officer renders
// into the same .nodal-card structure the page has always used.
const HERO_TITLE = 'Nodal Officer';
const HERO_SUBTITLE = 'Contact our nodal officers for grievance redressal';

// The address is stored with line breaks; render each line on its own row, as
// the original hardcoded <address> did (a <br /> between lines, none trailing).
const renderAddress = (address) => {
    const lines = String(address || '').split('\n');
    return lines.map((line, i) => (
        <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
        </span>
    ));
};

// Strip spaces and dashes for the tel: href while keeping the display text as
// entered — matching the original "+91-7042476577" → tel:+917042476577.
const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;

const NodalOfficer = () => {
    const { data: officers } = useNodalOfficers();

    return (
        <div className="nodal-page">
            <SEO
                title={HERO_TITLE}
                description={HERO_SUBTITLE}
                canonical={`${SITE_URL}/nodal-officer`}
            />
            <section className="nodal-hero">
                <div className="container">
                    <h1>{HERO_TITLE}</h1>
                    <p>{HERO_SUBTITLE}</p>
                </div>
            </section>

            <section className="nodal-content section">
                <div className="container">
                    <div className="nodal-grid">
                        {(officers || []).map((officer) => (
                            <div className="nodal-card" key={officer._id}>
                                <h2>{officer.companyName}'s Nodal Officer Details</h2>
                                <div className="officer-info">
                                    <h3>{officer.officerName}</h3>
                                    <p className="officer-title">{officer.designation}</p>

                                    <div className="contact-details">
                                        <div className="contact-row">
                                            <MapPin size={18} />
                                            <address>{renderAddress(officer.address)}</address>
                                        </div>
                                        <div className="contact-row">
                                            <Mail size={18} />
                                            <a href={`mailto:${officer.email}`}>{officer.email}</a>
                                        </div>
                                        <div className="contact-row">
                                            <Phone size={18} />
                                            <a href={telHref(officer.phone)}>{officer.phone}</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default NodalOfficer;
