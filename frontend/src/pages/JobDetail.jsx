import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Briefcase, Building2, MapPin, Clock, Users,
    IndianRupee, CalendarDays, CheckCircle2, GraduationCap, Sparkles,
    FileText, Search, RefreshCw
} from 'lucide-react';
import './JobDetail.css';
import SEO from '../components/SEO';
import { useJob } from '../hooks';
import {
    NOT_SPECIFIED, toText, toList, formatLocation, formatEmploymentType,
    formatVacancies, formatDate, isDeadlinePassed, jobTitleOf, jobApplyPath
} from '../utils/job';

const DetailSkeleton = () => (
    <div className="job-detail-skeleton" aria-hidden="true">
        <div className="skeleton-line" style={{ width: '55%', height: 30 }} />
        <div className="skeleton-line" style={{ width: '35%' }} />
        <div className="skeleton-line" style={{ width: '100%', height: 120 }} />
        <div className="skeleton-line" style={{ width: '100%', height: 160 }} />
    </div>
);

// A labelled row in "General Information". Unlike the listing cards, this table
// is the full record, so a blank value is stated explicitly rather than hidden.
const InfoRow = ({ icon, label, value }) => {
    const Icon = icon;
    return (
        <div className="info-row">
            <span className="info-row__icon"><Icon size={18} aria-hidden="true" /></span>
            <span className="info-row__label">{label}</span>
            <span className={`info-row__value${value ? '' : ' info-row__value--empty'}`}>
                {value || NOT_SPECIFIED}
            </span>
        </div>
    );
};

const BulletSection = ({ icon, title, items }) => {
    const Icon = icon;
    if (!items.length) return null;
    return (
        <section className="job-detail-section">
            <h2 className="job-detail-section__title">
                <Icon size={18} aria-hidden="true" /> {title}
            </h2>
            <ul className="job-detail-bullets">
                {items.map((item, i) => (
                    <li key={`${item}-${i}`}>{item}</li>
                ))}
            </ul>
        </section>
    );
};

const JobDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { data: job, loading, error, refetch } = useJob(id);

    if (loading) {
        return (
            <div className="job-detail-page">
                <div className="container"><DetailSkeleton /></div>
            </div>
        );
    }

    if (error || !job) {
        return (
            <div className="job-detail-page">
                <SEO title="Job Not Found" description="This job opening is no longer available." />
                <div className="container">
                    <div className="job-detail-state">
                        <Search size={36} />
                        <h1>Job opening not available</h1>
                        <p>This position may have been filled or is no longer published.</p>
                        <div className="job-detail-state__actions">
                            <button onClick={refetch} className="btn btn-secondary">
                                <RefreshCw size={16} /> Retry
                            </button>
                            <button onClick={() => navigate('/career')} className="btn btn-primary">
                                View All Openings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const title = jobTitleOf(job);
    const employmentType = formatEmploymentType(job.employmentType);
    const deadline = formatDate(job.applicationDeadline);
    const closed = isDeadlinePassed(job.applicationDeadline);

    const shortDescription = toText(job.shortDescription);
    const fullDescription = toText(job.fullDescription);
    const responsibilities = toList(job.responsibilities);
    const qualifications = toList(job.qualifications);
    const skills = toList(job.skillsRequired);

    const seoTitle = toText(job.seoMetaTitle);
    const seoDescription = toText(job.seoMetaDescription);
    const seoKeywords = toText(job.seoMetaKeywords);

    const applyHref = jobApplyPath(job);

    return (
        <div className="job-detail-page">
            <SEO
                title={seoTitle || title}
                description={seoDescription || shortDescription || `Apply for ${title} at Surjit Finance.`}
                keywords={seoKeywords}
                type="article"
            />

            <section className="job-detail-hero">
                <div className="container">
                    <Link to="/career" className="job-detail-back">
                        <ArrowLeft size={18} /> Back to Careers
                    </Link>

                    <div className="job-detail-hero__row">
                        <div className="job-detail-hero__main">
                            <h1>{title}</h1>
                            <div className="job-detail-hero__chips">
                                {employmentType && <span className="job-type-chip">{employmentType}</span>}
                                {toText(job.department) && <span className="job-type-chip">{job.department}</span>}
                                {formatLocation(job.location) && (
                                    <span className="job-type-chip">{formatLocation(job.location)}</span>
                                )}
                                {closed && (
                                    <span className="job-type-chip job-type-chip--closed">Applications Closed</span>
                                )}
                            </div>
                        </div>
                        <Link to={applyHref} className="btn btn-primary btn-lg job-detail-hero__cta">
                            Apply Now <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            <section className="job-detail-body section">
                <div className="container job-detail-layout">
                    <div className="job-detail-main">
                        <section className="job-detail-section">
                            <h2 className="job-detail-section__title">
                                <Briefcase size={18} aria-hidden="true" /> General Information
                            </h2>
                            <div className="info-grid">
                                <InfoRow icon={Building2} label="Department" value={toText(job.department)} />
                                <InfoRow icon={MapPin} label="Location" value={formatLocation(job.location)} />
                                <InfoRow icon={Briefcase} label="Employment Type" value={employmentType} />
                                <InfoRow icon={Clock} label="Experience" value={toText(job.experienceRequired)} />
                                <InfoRow icon={IndianRupee} label="Salary" value={toText(job.salary)} />
                                <InfoRow icon={Users} label="Vacancies" value={formatVacancies(job.numberOfVacancies)} />
                                <InfoRow icon={CalendarDays} label="Application Deadline" value={deadline} />
                            </div>
                        </section>

                        {(shortDescription || fullDescription) && (
                            <section className="job-detail-section">
                                <h2 className="job-detail-section__title">
                                    <FileText size={18} aria-hidden="true" /> Description
                                </h2>
                                {shortDescription && <p className="job-detail-lead">{shortDescription}</p>}
                                {fullDescription && (
                                    <div className="job-detail-prose">
                                        {fullDescription.split(/\n{2,}/).map((para, i) => (
                                            <p key={i}>{para}</p>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        <BulletSection icon={CheckCircle2} title="Responsibilities" items={responsibilities} />
                        <BulletSection icon={GraduationCap} title="Qualifications" items={qualifications} />

                        {skills.length > 0 && (
                            <section className="job-detail-section">
                                <h2 className="job-detail-section__title">
                                    <Sparkles size={18} aria-hidden="true" /> Skills
                                </h2>
                                <div className="job-chips">
                                    {skills.map((skill, i) => (
                                        <span key={`${skill}-${i}`} className="job-chip">{skill}</span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {(seoTitle || seoDescription || seoKeywords) && (
                            <section className="job-detail-section job-detail-section--seo">
                                <h2 className="job-detail-section__title">
                                    <Search size={18} aria-hidden="true" /> SEO Information
                                </h2>
                                <div className="info-grid info-grid--single">
                                    {seoTitle && <InfoRow icon={Search} label="Meta Title" value={seoTitle} />}
                                    {seoDescription && <InfoRow icon={FileText} label="Meta Description" value={seoDescription} />}
                                    {seoKeywords && <InfoRow icon={Sparkles} label="Meta Keywords" value={seoKeywords} />}
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="job-detail-aside">
                        <div className="job-apply-card">
                            <h3>Interested in this role?</h3>
                            <p>
                                {deadline
                                    ? closed
                                        ? `Applications closed on ${deadline}.`
                                        : `Applications close on ${deadline}.`
                                    : 'Send us your profile and our HR team will get back to you.'}
                            </p>
                            <Link to={applyHref} className="btn btn-primary w-full">
                                Apply Now <ArrowRight size={16} />
                            </Link>
                            <Link to="/career" className="btn btn-secondary w-full">
                                View Other Openings
                            </Link>
                        </div>
                    </aside>
                </div>
            </section>
        </div>
    );
};

export default JobDetail;
