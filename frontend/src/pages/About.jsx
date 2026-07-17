import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Target, Eye, Heart, ArrowRight, Users, Building2, TrendingUp, MapPin, RefreshCw, User } from 'lucide-react';
import './About.css';
import SEO from '../components/SEO';
import { useCompanyInfo, useDirectors, useLeadership, useSettings } from '../hooks';

const TeamMemberSkeleton = () => (
    <div className="team-card" style={{ opacity: 0.5 }}>
        <div className="team-photo-wrapper" style={{ background: '#e5e7eb', borderRadius: '50%', width: 120, height: 120 }} />
        <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4, margin: '12px 0 6px', width: '70%' }} />
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '50%' }} />
    </div>
);

// Reusable profile card — shared by the Board Of Directors and Leadership Team
// sections so the card design (size, shadow, radius, image, hover, typography)
// is identical everywhere. In `placeholder` mode it shows a generic avatar and
// a "Profile Coming Soon" note.
const TeamCard = ({ member, placeholder = false }) => {
    const photoUrl = member.photo?.url || member.image || null;
    const initials = member.name?.split(' ').slice(1, 3).map((n) => n[0]).join('') || '??';
    return (
        <div className={`team-card${placeholder ? ' team-card--placeholder' : ''}`}>
            <div className="team-photo-wrapper">
                {photoUrl
                    ? <img src={photoUrl} alt={member.name} loading="lazy" />
                    : placeholder
                        ? <div className="team-photo-fallback team-photo-icon"><User size={54} strokeWidth={1.5} /></div>
                        : <div className="team-photo-fallback">{initials}</div>
                }
            </div>
            <h4>{member.name}</h4>
            <span className="team-title">{member.designation || member.title}</span>
            <p>{placeholder ? 'Profile Coming Soon' : (member.bio || member.description)}</p>
        </div>
    );
};

// Shown only until real directors are added in the CMS.
const directorPlaceholders = [
    { name: 'Director Name', designation: 'Chairman' },
    { name: 'Director Name', designation: 'Managing Director' },
    { name: 'Director Name', designation: 'Director' }
];

const About = () => {
    const location = useLocation();
    const { data: company, loading: companyLoading, error: companyError, refetch: refetchCompany } = useCompanyInfo();
    const { data: directors, loading: directorsLoading, error: directorsError, refetch: refetchDirectors } = useDirectors();
    const { data: leadership, loading: leadershipLoading, error: leadershipError, refetch: refetchLeadership } = useLeadership();
    const { data: settings } = useSettings();

    useEffect(() => {
        if (location.hash) {
            const id = location.hash.replace('#', '');
            setTimeout(() => {
                const element = document.getElementById(id);
                if (element) element.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }
    }, [location]);

    const stats = [
        { number: '35+', label: 'Branches', icon: <Building2 size={24} /> },
        { number: '3', label: 'States', icon: <MapPin size={24} /> },
        { number: '2016', label: 'Founded', icon: <TrendingUp size={24} /> },
        { number: '1L+', label: 'Happy Customers', icon: <Users size={24} /> },
    ];

    const storyText = company?.history || company?.aboutDescription || null;
    const vision = company?.vision || null;
    const mission = company?.mission || null;
    const coreValues = company?.coreValues || null;

    const officeAddress = settings?.officeAddress || null;

    return (
        <div className="about-page">
            <SEO
                title={company?.heroTitle || 'About Us'}
                description={company?.heroSubtitle || company?.aboutDescription || 'Learn about Surjit Finance – an RBI-registered NBFC empowering financial inclusion across North India.'}
            />
            {/* Hero Section */}
            <section className="about-hero">
                <div className="container">
                    <h1>About Us</h1>
                    <p className="hero-subtitle">Empowering Dreams, Enabling Growth</p>
                </div>
            </section>

            {/* Our Story Section */}
            <section id="our-story" className="about-story section">
                <div className="container">
                    <div className="story-content">
                        <div className="story-text">
                            <h2>Our Story</h2>
                            {companyLoading ? (
                                <>
                                    {[1,2,3].map(i => (
                                        <div key={i} style={{ height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: 12, width: i === 3 ? '60%' : '100%' }} />
                                    ))}
                                </>
                            ) : companyError ? (
                                <p style={{ color: '#6b7280' }}>Company information is temporarily unavailable.</p>
                            ) : storyText ? (
                                <p>{storyText}</p>
                            ) : (
                                <p style={{ color: '#6b7280' }}>Company story coming soon.</p>
                            )}
                        </div>
                        <div className="story-stats">
                            {stats.map((stat, index) => (
                                <div key={index} className="stat-card">
                                    <div className="stat-icon">{stat.icon}</div>
                                    <span className="stat-number">{stat.number}</span>
                                    <span className="stat-label">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Vision & Mission */}
            <section className="vision-mission section">
                <div className="container">
                    <div className="vm-grid">
                        {vision && (
                            <div className="vm-card">
                                <div className="vm-icon"><Eye size={32} /></div>
                                <h3>Vision Statement</h3>
                                <p>{vision}</p>
                            </div>
                        )}
                        {mission && (
                            <div className="vm-card">
                                <div className="vm-icon"><Target size={32} /></div>
                                <h3>Mission Statement</h3>
                                <p>{mission}</p>
                            </div>
                        )}
                        {coreValues && (
                            <div className="vm-card">
                                <div className="vm-icon"><Heart size={32} /></div>
                                <h3>Core Values</h3>
                                <p>{coreValues}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Board of Directors */}
            <section id="board" className="team-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Board Of Directors</h2>
                        <p>Meet the visionary leaders guiding Surjit Finance</p>
                    </div>
                    {directorsError ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <p>Failed to load directors.</p>
                            <button onClick={refetchDirectors} className="btn btn-primary" style={{ marginTop: 8 }}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    ) : (
                        <div className="team-grid">
                            {directorsLoading
                                ? Array(3).fill(0).map((_, i) => <TeamMemberSkeleton key={i} />)
                                : (directors && directors.length > 0)
                                    ? directors.map((m) => <TeamCard key={m._id} member={m} />)
                                    : directorPlaceholders.map((m, i) => <TeamCard key={`director-placeholder-${i}`} member={m} placeholder />)
                            }
                        </div>
                    )}
                </div>
            </section>

            {/* Leadership Team */}
            <section id="leadership" className="leadership-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Leadership Team</h2>
                        <p>The experienced professionals driving our success</p>
                    </div>
                    {leadershipError ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <p>Failed to load leadership team.</p>
                            <button onClick={refetchLeadership} className="btn btn-primary" style={{ marginTop: 8 }}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    ) : (
                        <div className="team-grid">
                            {leadershipLoading
                                ? Array(9).fill(0).map((_, i) => <TeamMemberSkeleton key={i} />)
                                : (leadership && leadership.length > 0)
                                    ? leadership.map((m) => <TeamCard key={m._id} member={m} />)
                                    : (
                                        <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7280' }}>
                                            Leadership profiles coming soon.
                                        </p>
                                    )
                            }
                        </div>
                    )}
                </div>
            </section>

            {/* Locations */}
            <section className="locations-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Locations</h2>
                    </div>
                    <div className="locations-grid">
                        {officeAddress && (
                            <div className="location-card">
                                <MapPin size={24} />
                                <h4>Office Address</h4>
                                <address>
                                    {settings.officeAddress}{settings.city ? `, ${settings.city}` : ''}{settings.state ? `, ${settings.state}` : ''}{settings.pinCode ? ` - ${settings.pinCode}` : ''}
                                </address>
                                {settings.googleMapsUrl && (
                                    <a href={settings.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="maps-link">View on Map</a>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="company-info">
                        <span>CIN: U65921UP1993PTC122979</span>
                        <span>RBI Registration No. B-12.00478</span>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="about-cta section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Start Your Financial Journey?</h2>
                        <p>Join thousands of satisfied customers who trust Surjit Finance</p>
                        <Link to="/loan-application" className="btn btn-accent btn-lg">
                            Apply for a Loan
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default About;
