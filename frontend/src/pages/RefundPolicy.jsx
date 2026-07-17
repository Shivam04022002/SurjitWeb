import { Download } from 'lucide-react';
import './PrivacyPolicy.css';

const RefundPolicy = () => {
    return (
        <div className="policy-page">
            <section className="policy-hero">
                <div className="container">
                    <h1>Refund Policy</h1>
                </div>
            </section>

            <section className="policy-content section">
                <div className="container">
                    <div className="policy-card" style={{ textAlign: 'center' }}>
                        <h2>Refund Policy</h2>
                        <p>
                            Please refer to our detailed refund policy document for complete information about our refund and cancellation procedures.
                        </p>

                        <a
                            href="https://www.surjitfinance.com/wp-content/uploads/2024/02/refund-policy.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary btn-lg"
                            style={{ marginTop: '2rem' }}
                        >
                            <Download size={20} />
                            Download Refund Policy
                        </a>

                        <div style={{ marginTop: '3rem', padding: '2rem', background: 'var(--gray-50)', borderRadius: 'var(--radius-xl)' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Key Points</h3>
                            <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
                                <li>Refund requests must be submitted within the specified timeframe</li>
                                <li>Processing fees may be non-refundable in certain cases</li>
                                <li>Refunds are processed within 7-10 business days</li>
                                <li>For queries, contact us at 1800-3131-265</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default RefundPolicy;
