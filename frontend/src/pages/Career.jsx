import { Link } from 'react-router-dom';
import { MapPin, BriefcaseIcon, Clock, Users, ArrowRight, Calendar, RefreshCw } from 'lucide-react';
import './Career.css';
import SEO from '../components/SEO';
import { useJobs, useCareerSettings } from '../hooks';

const JobSkeleton = () => (
    <div className="job-card" style={{ opacity: 0.5 }}>
        <div style={{ height: 20, background: '#e5e7eb', borderRadius: 4, width: '60%', marginBottom: 12 }} />
        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '40%', marginBottom: 8 }} />
        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '100%', marginBottom: 4 }} />
        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '80%' }} />
    </div>
);

const Career = () => {
    const { data: jobs, loading: jobsLoading, error: jobsError, refetch: refetchJobs } = useJobs();
    const { data: careerSettings } = useCareerSettings();

    const benefits = [
        { icon: Users, title: 'Collaborative Culture', description: 'Work with talented colleagues in a supportive environment' },
        { icon: Clock, title: 'Work-Life Balance', description: 'Flexible policies that respect your personal time' },
        { icon: BriefcaseIcon, title: 'Career Growth', description: 'Clear growth paths and learning opportunities' },
        { icon: Calendar, title: 'Regular Events', description: 'Team celebrations, outings, and cultural events' }
    ];

    const heroTitle = careerSettings?.heroTitle || 'Join Our Team';
    const heroSubtitle = careerSettings?.heroSubtitle || "Build your career with one of North India's fastest-growing NBFCs";

    return (
        <div className="career-page">
            <SEO
                title={careerSettings?.seo?.metaTitle || heroTitle}
                description={careerSettings?.seo?.metaDescription || heroSubtitle}
                keywords={careerSettings?.seo?.metaKeywords}
                canonical={careerSettings?.seo?.canonicalUrl}
                ogImage={careerSettings?.seo?.ogImage?.url}
            />
            {/* Hero */}
            <section className="career-hero">
                <div className="container">
                    <h1>{heroTitle}</h1>
                    <p>{heroSubtitle}</p>
                </div>
            </section>

            {/* Jobs Section */}
            <section id="jobs" className="jobs-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Jobs @ Surjit Finance</h2>
                        <p>Explore exciting career opportunities and grow with us</p>
                    </div>

                    {jobsError ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <p>Failed to load job openings.</p>
                            <button onClick={refetchJobs} className="btn btn-primary" style={{ marginTop: 8 }}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    ) : (
                        <div className="jobs-grid">
                            {jobsLoading
                                ? Array(4).fill(0).map((_, i) => <JobSkeleton key={i} />)
                                : (jobs && jobs.length > 0)
                                    ? jobs.map((job) => (
                                        <div key={job._id} className="job-card">
                                            <div className="job-header">
                                                <BriefcaseIcon size={24} className="job-icon" />
                                                <h3>{job.title}</h3>
                                            </div>
                                            <div className="job-location">
                                                <MapPin size={16} />
                                                <span>{Array.isArray(job.location) ? job.location.join(', ') : job.location}</span>
                                            </div>
                                            <p className="job-description">{job.shortDescription || job.description}</p>
                                            <Link to={`/apply-job/${encodeURIComponent(job.title)}?jobId=${job._id}`} className="btn btn-primary">
                                                Apply Now
                                                <ArrowRight size={16} />
                                            </Link>
                                        </div>
                                    ))
                                    : (
                                        <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                                            No open positions at the moment. Check back soon!
                                        </p>
                                    )
                            }
                        </div>
                    )}
                </div>
            </section>

            {/* Benefits Section */}
            <section className="benefits-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Why Join Surjit Finance?</h2>
                        <p>We believe in creating an environment where everyone can thrive</p>
                    </div>
                    <div className="benefits-grid">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="benefit-card">
                                <div className="benefit-icon">
                                    <benefit.icon size={28} />
                                </div>
                                <h4>{benefit.title}</h4>
                                <p>{benefit.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="career-cta section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Start Your Journey?</h2>
                        <p>Join our growing team and build a rewarding career in financial services</p>
                        <Link to="/contact" className="btn btn-accent btn-lg">
                            Contact Us
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Career;
