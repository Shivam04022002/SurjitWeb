import { Link } from 'react-router-dom';
import EMICalculator from '../components/EMICalculator';
import FAQAccordion from '../components/FAQAccordion';
import { ArrowRight, Check, FileText, Home, Users, Clock, Zap, Shield, TrendingUp, IndianRupee, CalendarDays, Landmark } from 'lucide-react';
import './ProductPage.css';

const MicroLAP = () => {
    const product = {
        title: 'Micro LAP',
        subtitle: 'Loan Against Property',
        heroDescription: 'A Micro Loan Against Property (Micro LAP) is a loan product aimed at small business owners or individuals with limited credit needs. The borrower pledges property as collateral to secure the loan, tailored for lower loan amounts for micro-entrepreneurs or self-employed individuals.',
        features: [
            'Quick Access to Capital',
            'Maintains Business Flexibility',
            'Lower Interest Rates',
            'Improves Cash Flow',
            'Higher Loan-to-Value (LTV) Ratios',
            'Flexible Tenure',
            'Repayment Flexibility'
        ],
        eligibility: [
            { label: 'Nationality', value: 'Indian', icon: Shield },
            { label: 'Customer Profile', value: 'Self Employed, Business Owners', icon: Users },
            { label: 'Loan Tenure', value: 'Up to 120 months', icon: CalendarDays },
            { label: 'Employment Stability', value: '2 Years or more', icon: TrendingUp }
        ],
        interestRate: 'Competitive rates based on profile',
        documents: ['KYC Documents (AADHAR, PAN)', 'Property Documents', 'Income Proof', 'Business Proof'],
        faqs: [
            { question: 'Who is eligible for Micro LAP?', answer: 'Self-employed individuals and business owners with 2+ years of stability are eligible.' },
            { question: 'What is the maximum tenure?', answer: 'Loan tenure is up to 120 months (10 years).' },
            { question: 'What property can be used as collateral?', answer: 'Residential or commercial property can be pledged as collateral.' },
            { question: 'How much can I borrow?', answer: 'Loan amount depends on property value and LTV ratio.' }
        ],
        stats: [
            { icon: Landmark, value: 'Property', label: 'Secured Loan' },
            { icon: CalendarDays, value: '120 Mo', label: 'Max Tenure' },
            { icon: Zap, value: 'Quick', label: 'Access to Capital' },
            { icon: IndianRupee, value: 'High LTV', label: 'Ratios Available' }
        ]
    };

    return (
        <div className="product-page">
            <section className="product-hero">
                <div className="container">
                    <div className="product-hero-content">
                        <div className="product-hero-text animate-in">
                            <span className="product-badge"><Home size={16} /> {product.subtitle}</span>
                            <h1>Micro <span className="text-highlight">LAP</span></h1>
                            <p>{product.heroDescription}</p>
                            <div className="product-hero-actions">
                                <Link to="/loan-application" className="btn-hero-primary">Apply Now <ArrowRight size={20} /></Link>
                                <a href="#features-and-benefits" className="btn-hero-secondary">Learn More <ArrowRight size={18} /></a>
                            </div>
                            <div className="product-quick-links">
                                <a href="#features-and-benefits">Features</a>
                                <a href="#eligibility">Eligibility</a>
                                <a href="#interest-rate">Interest Rates</a>
                                <a href="#emi-calculator">EMI Calculator</a>
                                <a href="#faq">FAQs</a>
                            </div>
                        </div>
                        <div className="product-hero-visual animate-in delay-2">
                            <div className="hero-icon-wrapper"><div className="hero-icon-bg"></div><Home size={100} /></div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="product-stats">
                <div className="container">
                    <div className="stats-grid animate-in delay-3">
                        {product.stats.map((stat, i) => {
                            const S = stat.icon; return (
                                <div key={i} className="stat-item"><div className="stat-icon"><S size={22} /></div><span className="stat-value">{stat.value}</span><span className="stat-label">{stat.label}</span></div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="features-and-benefits" className="product-features">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Why Choose Us</span>
                        <h2>Features & Benefits</h2>
                        <p>Unlock the value of your property with flexible loan options</p>
                    </div>
                    <div className="features-grid-new">
                        {product.features.map((f, i) => (
                            <div key={i} className={`feature-card animate-in delay-${i + 1}`}><div className="feature-icon-box"><Check size={20} /></div><span>{f}</span></div>
                        ))}
                    </div>
                    <div className="features-cta"><Link to="/loan-application" className="btn btn-primary btn-lg">Apply Now <ArrowRight size={18} /></Link></div>
                </div>
            </section>

            <section id="eligibility" className="product-eligibility">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Requirements</span>
                        <h2>Eligibility Criteria</h2>
                        <p>Designed for self-employed individuals and business owners</p>
                    </div>
                    <div className="eligibility-grid-new">
                        {product.eligibility.map((item, i) => {
                            const I = item.icon; return (
                                <div key={i} className={`eligibility-card-new animate-in delay-${i + 1}`}><div className="elig-icon"><I size={24} /></div><span className="elig-label">{item.label}</span><span className="elig-value">{item.value}</span></div>
                            );
                        })}
                    </div>
                    <div className="eligibility-cta"><Link to="/loan-application" className="btn btn-primary btn-lg">Check Eligibility <ArrowRight size={18} /></Link></div>
                </div>
            </section>

            <section id="emi-calculator"><EMICalculator loanType={product.title} /></section>

            <section id="interest-rate" className="product-rates">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Transparent Pricing</span>
                        <h2>Interest Rate & Charges</h2>
                        <p>Competitive and reasonable rates for all our customers</p>
                    </div>
                    <div className="rates-content">
                        <div className="rates-features-list">
                            {['Easy and flexible criteria for eligibility', 'Principal, tenure, and other factors influence the rate', 'Get a good interest rate which is pocket-friendly', 'Industry-standard rates with best service and assistance'].map((t, i) => (
                                <div key={i} className={`rate-feature-item animate-in delay-${i + 1}`}><div className="rate-check"><Check size={16} /></div><span>{t}</span></div>
                            ))}
                        </div>
                        <div className="rate-highlight-card animate-in delay-5"><span className="rate-label">Interest Rate</span><span className="rate-value">{product.interestRate}</span></div>
                        <div className="rates-cta"><Link to="/loan-application" className="btn-hero-primary">Apply Now <ArrowRight size={20} /></Link></div>
                    </div>
                </div>
            </section>

            <section className="product-documents">
                <div className="container">
                    <div className="section-header-new"><span className="section-tag">Paperwork</span><h2>Documents Required</h2><p>Minimal documentation for a hassle-free experience</p></div>
                    <div className="documents-grid">
                        {product.documents.map((d, i) => (<div key={i} className={`document-card animate-in delay-${i + 1}`}><div className="doc-icon"><FileText size={22} /></div><span>{d}</span></div>))}
                    </div>
                </div>
            </section>

            <section id="faq" className="product-faqs">
                <div className="container">
                    <div className="section-header-new"><span className="section-tag">Got Questions?</span><h2>Frequently Asked Questions</h2></div>
                    <div className="faqs-wrapper"><FAQAccordion faqs={product.faqs} /></div>
                </div>
            </section>

            <section className="product-cta-section">
                <div className="container">
                    <div className="cta-inner animate-in"><h2>Unlock Your Property's Value</h2><p>Apply for Micro LAP today and get quick access to funds</p><Link to="/loan-application" className="btn-cta-white">Apply Now <ArrowRight size={20} /></Link></div>
                </div>
            </section>
        </div>
    );
};

export default MicroLAP;
