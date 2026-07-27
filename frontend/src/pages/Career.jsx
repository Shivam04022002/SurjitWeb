import { Link } from 'react-router-dom';
import {
    MapPin, BriefcaseIcon, Clock, Users, ArrowRight, Calendar, RefreshCw,
    Building2, IndianRupee, CalendarDays, CheckCircle2, GraduationCap
} from 'lucide-react';
import './Career.css';
import SEO from '../components/SEO';
import { useJobs, useCareerSettings } from '../hooks';
import {
    toText, toList, formatLocation, formatEmploymentType, formatVacancies,
    formatDate, isDeadlinePassed, jobTitleOf, jobDetailPath, jobApplyPath
} from '../utils/job';

// How much of a long list a card previews before collapsing into "+N more".
const PREVIEW_COUNT = 3;
const SKILL_PREVIEW_COUNT = 6;

const JobSkeleton = () => (
    <div className="job-card job-card--skeleton" aria-hidden="true">
        <div className="skeleton-line" style={{ width: '65%', height: 22 }} />
        <div className="skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton-line" style={{ width: '100%' }} />
        <div className="skeleton-line" style={{ width: '85%' }} />
        <div className="skeleton-line" style={{ width: '55%' }} />
    </div>
);

const JobCard = ({ job }) => {
    const title = jobTitleOf(job);
    const employmentType = formatEmploymentType(job.employmentType);
    const deadline = formatDate(job.applicationDeadline);
    const closed = isDeadlinePassed(job.applicationDeadline);

    const description = toText(job.shortDescription) || toText(job.fullDescription);
    const skills = toList(job.skillsRequired);
    const responsibilities = toList(job.responsibilities);
    const qualifications = toList(job.qualifications);

    // Optional fields are dropped rather than shown as "Not Specified" here —
    // the card stays tidy, and the details page carries the full record.
    const meta = [
        { icon: Building2, label: 'Department', value: toText(job.department) },
        { icon: MapPin, label: 'Location', value: formatLocation(job.location) },
        { icon: Clock, label: 'Experience', value: toText(job.experienceRequired) },
        { icon: IndianRupee, label: 'Salary', value: toText(job.salary) },
        { icon: Users, label: 'Vacancies', value: formatVacancies(job.numberOfVacancies) },
        { icon: CalendarDays, label: 'Apply by', value: deadline },
    ].filter((item) => item.value);

    return (
        <article className="job-card">
            <div className="job-card__body">
                <div className="job-card__top">
                    <div className="job-icon-badge">
                        <BriefcaseIcon size={20} />
                    </div>
                    <div className="job-card__heading">
                        <h3 className="job-card__title">{title}</h3>
                        {employmentType && <span className="job-type-chip">{employmentType}</span>}
                        {closed && <span className="job-type-chip job-type-chip--closed">Applications Closed</span>}
                    </div>
                </div>

                {meta.length > 0 && (
                    <ul className="job-meta">
                        {meta.map((item) => (
                            <li key={item.label} className="job-meta__item">
                                <item.icon size={15} aria-hidden="true" />
                                <span className="job-meta__label">{item.label}:</span>
                                <span className="job-meta__value">{item.value}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {description && <p className="job-description">{description}</p>}

                {skills.length > 0 && (
                    <div className="job-chips" aria-label="Skills required">
                        {skills.slice(0, SKILL_PREVIEW_COUNT).map((skill) => (
                            <span key={skill} className="job-chip">{skill}</span>
                        ))}
                        {skills.length > SKILL_PREVIEW_COUNT && (
                            <span className="job-chip job-chip--more">
                                +{skills.length - SKILL_PREVIEW_COUNT} More
                            </span>
                        )}
                    </div>
                )}

                {responsibilities.length > 0 && (
                    <div className="job-preview-block">
                        <h4 className="job-preview-title">
                            <CheckCircle2 size={15} aria-hidden="true" /> Responsibilities
                        </h4>
                        <ul className="job-preview-list">
                            {responsibilities.slice(0, PREVIEW_COUNT).map((item, i) => (
                                <li key={`${item}-${i}`}>{item}</li>
                            ))}
                        </ul>
                        {responsibilities.length > PREVIEW_COUNT && (
                            <Link to={jobDetailPath(job)} className="job-more-link">
                                +{responsibilities.length - PREVIEW_COUNT} More
                            </Link>
                        )}
                    </div>
                )}

                {qualifications.length > 0 && (
                    <div className="job-preview-block">
                        <h4 className="job-preview-title">
                            <GraduationCap size={15} aria-hidden="true" /> Qualifications
                        </h4>
                        <ul className="job-preview-list">
                            {qualifications.slice(0, PREVIEW_COUNT).map((item, i) => (
                                <li key={`${item}-${i}`}>{item}</li>
                            ))}
                        </ul>
                        {qualifications.length > PREVIEW_COUNT && (
                            <Link to={jobDetailPath(job)} className="job-more-link">
                                +{qualifications.length - PREVIEW_COUNT} More
                            </Link>
                        )}
                    </div>
                )}
            </div>

            <div className="job-card__actions">
                <Link to={jobDetailPath(job)} className="btn btn-secondary job-card__btn">
                    View Details
                </Link>
                <Link to={jobApplyPath(job)} className="btn btn-primary job-card__btn">
                    Apply Now
                    <ArrowRight size={16} />
                </Link>
            </div>
        </article>
    );
};

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

    const openings = Array.isArray(jobs) ? jobs : [];

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
                        <div className="jobs-state">
                            <p>Failed to load job openings.</p>
                            <button onClick={refetchJobs} className="btn btn-primary" style={{ marginTop: 8 }}>
                                <RefreshCw size={16} /> Retry
                            </button>
                        </div>
                    ) : (
                        <div className="jobs-grid">
                            {jobsLoading
                                ? Array(4).fill(0).map((_, i) => <JobSkeleton key={i} />)
                                : openings.length > 0
                                    ? openings.map((job) => <JobCard key={job._id} job={job} />)
                                    : (
                                        <div className="jobs-state jobs-state--empty">
                                            <BriefcaseIcon size={32} />
                                            <p>No open positions at the moment. Check back soon!</p>
                                        </div>
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
