import { FileText, Download, ExternalLink, Calendar, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import { useReports } from '../hooks';
import { reportDownloadUrl } from '../services/api';
import './Reports.css';

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const ReportSkeleton = () => (
    <article className="report-card" style={{ opacity: 0.5 }}>
        <div className="report-icon" style={{ background: '#e5e7eb' }} />
        <div style={{ flex: 1 }}>
            <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4, width: '70%', marginBottom: 10 }} />
            <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '40%' }} />
        </div>
    </article>
);

// Published reports from the CMS, in the order set there. Uploading a report
// publishes it here with no code change.
const Reports = () => {
    const { data: reports, loading, error, refetch } = useReports();
    const list = reports || [];

    return (
        <div className="reports-page">
            <SEO
                title="Annual Reports"
                description="Download annual financial reports and disclosures from Surjit Finance."
            />

            <section className="reports-hero">
                <div className="container">
                    <h1>Annual Reports</h1>
                    <p>Download annual financial reports and disclosures.</p>
                </div>
            </section>

            <section className="reports-list section">
                <div className="container">
                    <div className="reports-grid">
                        {loading
                            ? Array(3).fill(0).map((_, i) => <ReportSkeleton key={i} />)
                            : error
                                ? (
                                    <div className="reports-empty">
                                        <p>Unable to load reports right now.</p>
                                        <button onClick={refetch} className="btn btn-secondary">
                                            <RefreshCw size={16} /> Retry
                                        </button>
                                    </div>
                                )
                                : list.length > 0
                                    ? list.map((report) => (
                                        <article key={report._id} className="report-card">
                                            <div className="report-icon">
                                                {report.thumbnail?.url ? (
                                                    <img src={report.thumbnail.url} alt="" loading="lazy" />
                                                ) : (
                                                    <FileText size={26} aria-hidden="true" />
                                                )}
                                            </div>

                                            <div className="report-body">
                                                <h2 className="report-title">{report.title}</h2>

                                                <div className="report-meta">
                                                    <span className="report-year">
                                                        {report.financialYear || report.year}
                                                    </span>
                                                    <span className="report-date">
                                                        <Calendar size={13} aria-hidden="true" />
                                                        {formatDate(report.createdAt)}
                                                    </span>
                                                </div>

                                                {report.description && (
                                                    <p className="report-desc">{report.description}</p>
                                                )}

                                                <div className="report-actions">
                                                    <a
                                                        href={report.pdf?.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-secondary btn-sm"
                                                    >
                                                        <ExternalLink size={15} aria-hidden="true" />
                                                        View
                                                    </a>
                                                    <a
                                                        href={reportDownloadUrl(report._id)}
                                                        className="btn btn-primary btn-sm"
                                                    >
                                                        <Download size={15} aria-hidden="true" />
                                                        Download
                                                    </a>
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                    : (
                                        <div className="reports-empty">
                                            <p>No reports have been published yet.</p>
                                        </div>
                                    )
                        }
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Reports;
