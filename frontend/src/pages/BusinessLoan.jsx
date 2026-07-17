import { useState } from 'react';
import { Link } from 'react-router-dom';
import EMICalculator from '../components/EMICalculator';
import FAQAccordion from '../components/FAQAccordion';
import { ArrowRight, Check, FileText, Building, Users, Clock, Zap, Shield, TrendingUp, IndianRupee, CalendarDays } from 'lucide-react';
import './ProductPage.css';

const BusinessLoan = () => {
    const [activeIndex, setActiveIndex] = useState(0);

    const products = [
        {
            title: 'Arambh Business Loan',
            subtitle: 'Business Loan',
            heroDescription: 'Arambh Business Loan is a product specially tailored for New-To-Credit (NTC) Business Owners, to help them access capital to support and grow their businesses. These loans provide funds for various needs, such as purchasing inventory, upgrading equipment, managing cash flow, or expanding the business.',
            features: [
                'Loan up to ₹50,000 to ₹1,50,000',
                'Loan Tenure up to 24 Months',
                'Easy Monthly Installment',
                'Loan Approval within 48 hours',
                'Same day Disbursement after documentation',
                'For New-To-Credit (NTC) customers'
            ],
            eligibility: [
                { label: 'Nationality', value: 'Indian', icon: Shield },
                { label: 'Customer Profile', value: 'Business Owner (NTC)', icon: Users },
                { label: 'Loan Tenure', value: '24 Months', icon: CalendarDays },
                { label: 'Business Stability', value: '18 Months or More', icon: TrendingUp }
            ],
            interestRate: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Business Proof',
                'Residence Ownership Proof'
            ],
            charges: [
                { label: 'Interest Rate', value: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*' },
                { label: 'Processing Charges', value: '2.5% + GST (18% on Processing Fees)' },
                { label: 'Documentation Charges', value: 'NIL' },
                { label: 'Maximum Repayment Tenure', value: '24 Months' }
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' },
                { question: 'What are the processing charges?', answer: 'Processing charges are 2.5% + GST (18% on Processing Fees).' },
                { question: 'Are there any documentation charges?', answer: 'No, documentation charges are NIL.' },
                { question: 'What is the maximum repayment tenure?', answer: 'The maximum repayment tenure is 24 months.' }
            ],
            stats: [
                { icon: IndianRupee, value: '₹1.5L', label: 'Max Loan Amount' },
                { icon: CalendarDays, value: '24 Mo', label: 'Max Tenure' },
                { icon: Zap, value: '48 Hrs', label: 'Quick Approval' },
                { icon: Clock, value: 'Same Day', label: 'Disbursement' }
            ]
        },
        {
            title: 'Sahaj Business Loan',
            subtitle: 'Business Loan',
            heroDescription: 'Sahaj Business Loan is a product specially tailored for Business Owners, to help them access capital to support and grow their businesses. These loans provide funds for various needs, such as purchasing inventory, upgrading equipment, managing cash flow, or expanding the business.',
            features: [
                'Loan up to ₹50,000 to ₹1,50,000',
                'Loan Tenure up to 24 Months',
                'Easy Monthly Installment',
                'Loan Approval within 48 hours',
                'Same day Disbursement after documentation',
                'For New-To-Credit (NTC) customers'
            ],
            eligibility: [
                { label: 'Nationality', value: 'Indian', icon: Shield },
                { label: 'Customer Profile', value: 'Business Owner (NTC)', icon: Users },
                { label: 'Loan Tenure', value: '24 Months', icon: CalendarDays },
                { label: 'Business Stability', value: '18 Months or More', icon: TrendingUp }
            ],
            interestRate: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Business Proof',
                'Residence Ownership Proof'
            ],
            charges: [
                { label: 'Interest Rate', value: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*' },
                { label: 'Processing Charges', value: '2.5% + GST (18% on Processing Fees)' },
                { label: 'Documentation Charges', value: 'NIL' },
                { label: 'Maximum Repayment Tenure', value: '24 Months' }
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' },
                { question: 'What are the processing charges?', answer: 'Processing charges are 2.5% + GST (18% on Processing Fees).' },
                { question: 'Are there any documentation charges?', answer: 'No, documentation charges are NIL.' },
                { question: 'What is the maximum repayment tenure?', answer: 'The maximum repayment tenure is 24 months.' }
            ],
            stats: [
                { icon: IndianRupee, value: '₹1.5L', label: 'Max Loan Amount' },
                { icon: CalendarDays, value: '24 Mo', label: 'Max Tenure' },
                { icon: Zap, value: '48 Hrs', label: 'Quick Approval' },
                { icon: Clock, value: 'Same Day', label: 'Disbursement' }
            ]
        },
        {
            title: 'Vridhii Business Loan',
            subtitle: 'Business Loan',
            heroDescription: 'Vridhii Business Loan is a product specially tailored for Business Owners, to help them access capital to support and grow their businesses. These loans provide funds for various needs, such as purchasing inventory, upgrading equipment, managing cash flow, or expanding the business.',
            features: [
                'Loan up to ₹50,000 to ₹1,50,000',
                'Loan Tenure up to 24 Months',
                'Easy Monthly Installment',
                'Loan Approval within 48 hours',
                'Same day Disbursement after documentation',
                'For New-To-Credit (NTC) customers'
            ],
            eligibility: [
                { label: 'Nationality', value: 'Indian', icon: Shield },
                { label: 'Customer Profile', value: 'Business Owner (NTC)', icon: Users },
                { label: 'Loan Tenure', value: '24 Months', icon: CalendarDays },
                { label: 'Business Stability', value: '18 Months or More', icon: TrendingUp }
            ],
            interestRate: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Business Proof',
                'Residence Ownership Proof'
            ],
            charges: [
                { label: 'Interest Rate', value: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*' },
                { label: 'Processing Charges', value: '2.5% + GST (18% on Processing Fees)' },
                { label: 'Documentation Charges', value: 'NIL' },
                { label: 'Maximum Repayment Tenure', value: '24 Months' }
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' },
                { question: 'What are the processing charges?', answer: 'Processing charges are 2.5% + GST (18% on Processing Fees).' },
                { question: 'Are there any documentation charges?', answer: 'No, documentation charges are NIL.' },
                { question: 'What is the maximum repayment tenure?', answer: 'The maximum repayment tenure is 24 months.' }
            ],
            stats: [
                { icon: IndianRupee, value: '₹1.5L', label: 'Max Loan Amount' },
                { icon: CalendarDays, value: '24 Mo', label: 'Max Tenure' },
                { icon: Zap, value: '48 Hrs', label: 'Quick Approval' },
                { icon: Clock, value: 'Same Day', label: 'Disbursement' }
            ]
        },
        {
            title: 'Samriddhi Business Loan',
            subtitle: 'Business Loan',
            heroDescription: 'Samriddhi Business Loan is a product specially tailored for Business Owners, to help them access capital to support and grow their businesses. These loans provide funds for various needs, such as purchasing inventory, upgrading equipment, managing cash flow, or expanding the business.',
            features: [
                'Loan up to ₹50,000 to ₹1,50,000',
                'Loan Tenure up to 24 Months',
                'Easy Monthly Installment',
                'Loan Approval within 48 hours',
                'Same day Disbursement after documentation',
                'For New-To-Credit (NTC) customers'
            ],
            eligibility: [
                { label: 'Nationality', value: 'Indian', icon: Shield },
                { label: 'Customer Profile', value: 'Business Owner (NTC)', icon: Users },
                { label: 'Loan Tenure', value: '24 Months', icon: CalendarDays },
                { label: 'Business Stability', value: '18 Months or More', icon: TrendingUp }
            ],
            interestRate: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Business Proof',
                'Residence Ownership Proof'
            ],
            charges: [
                { label: 'Interest Rate', value: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*' },
                { label: 'Processing Charges', value: '2.5% + GST (18% on Processing Fees)' },
                { label: 'Documentation Charges', value: 'NIL' },
                { label: 'Maximum Repayment Tenure', value: '24 Months' }
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' },
                { question: 'What are the processing charges?', answer: 'Processing charges are 2.5% + GST (18% on Processing Fees).' },
                { question: 'Are there any documentation charges?', answer: 'No, documentation charges are NIL.' },
                { question: 'What is the maximum repayment tenure?', answer: 'The maximum repayment tenure is 24 months.' }
            ],
            stats: [
                { icon: IndianRupee, value: '₹1.5L', label: 'Max Loan Amount' },
                { icon: CalendarDays, value: '24 Mo', label: 'Max Tenure' },
                { icon: Zap, value: '48 Hrs', label: 'Quick Approval' },
                { icon: Clock, value: 'Same Day', label: 'Disbursement' }
            ]
        }
    ];

    const product = products[activeIndex];

    return (
        <div className="product-page">
            {/* Hero */}
            <section className="product-hero">
                <div className="container">
                    <div className="product-hero-content">
                        <div className="product-hero-text animate-in">
                            {/* Product selector tabs in place of the badge */}
                            <div className="product-selector-tabs">
                                {products.map((p, index) => (
                                    <button
                                        key={index}
                                        className={`product-tab-btn ${index === activeIndex ? 'active' : ''}`}
                                        onClick={() => setActiveIndex(index)}
                                    >
                                        <Building size={14} />
                                        {p.title}
                                    </button>
                                ))}
                            </div>
                            <h1>{product.title.split(' ')[0]} <span className="text-highlight">{product.title.split(' ').slice(1).join(' ')}</span></h1>
                            <p>{product.heroDescription}</p>
                            <div className="product-hero-actions">
                                <Link to="/loan-application" className="btn-hero-primary">
                                    Apply Now <ArrowRight size={20} />
                                </Link>
                                <a href="#features-and-benefits" className="btn-hero-secondary">
                                    Learn More <ArrowRight size={18} />
                                </a>
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
                            <div className="hero-icon-wrapper">
                                <div className="hero-icon-bg"></div>
                                <Building size={100} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="product-stats">
                <div className="container">
                    <div className="stats-grid animate-in delay-3">
                        {product.stats.map((stat, index) => {
                            const StatIcon = stat.icon;
                            return (
                                <div key={index} className="stat-item">
                                    <div className="stat-icon">
                                        <StatIcon size={22} />
                                    </div>
                                    <span className="stat-value">{stat.value}</span>
                                    <span className="stat-label">{stat.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features-and-benefits" className="product-features">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Why Choose Us</span>
                        <h2>Features & Benefits</h2>
                        <p>Designed to empower new business owners with quick access to capital</p>
                    </div>
                    <div className="features-grid-new">
                        {product.features.map((feature, index) => (
                            <div key={index} className={`feature-card animate-in delay-${index + 1}`}>
                                <div className="feature-icon-box">
                                    <Check size={20} />
                                </div>
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                    <div className="features-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Apply Now <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Eligibility */}
            <section id="eligibility" className="product-eligibility">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Requirements</span>
                        <h2>Eligibility Criteria</h2>
                        <p>We have diverse eligibility criteria including age, income, nature of business, and more</p>
                    </div>
                    <div className="eligibility-grid-new">
                        {product.eligibility.map((item, index) => {
                            const EligIcon = item.icon;
                            return (
                                <div key={index} className={`eligibility-card-new animate-in delay-${index + 1}`}>
                                    <div className="elig-icon">
                                        <EligIcon size={24} />
                                    </div>
                                    <span className="elig-label">{item.label}</span>
                                    <span className="elig-value">{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="eligibility-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Check Eligibility <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* EMI Calculator */}
            <section id="emi-calculator">
                <EMICalculator loanType={product.title} />
            </section>

            {/* Interest Rates */}
            <section id="interest-rate" className="product-rates">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Transparent Pricing</span>
                        <h2>Interest Rate & Charges</h2>
                        <p>Competitive and reasonable rates for all our customers</p>
                    </div>
                    <div className="rates-content">
                        <div className="rates-features-list">
                            <div className="rate-feature-item animate-in delay-1">
                                <div className="rate-check"><Check size={16} /></div>
                                <span>Easy and flexible criteria for eligibility</span>
                            </div>
                            <div className="rate-feature-item animate-in delay-2">
                                <div className="rate-check"><Check size={16} /></div>
                                <span>Principal, tenure, and other factors influence the rate</span>
                            </div>
                            <div className="rate-feature-item animate-in delay-3">
                                <div className="rate-check"><Check size={16} /></div>
                                <span>Get a good interest rate which is pocket-friendly</span>
                            </div>
                            <div className="rate-feature-item animate-in delay-4">
                                <div className="rate-check"><Check size={16} /></div>
                                <span>Industry-standard rates with best service and assistance</span>
                            </div>
                        </div>
                        <div className="rate-highlight-card animate-in delay-5">
                            <span className="rate-label">Interest Rate</span>
                            <span className="rate-value">{product.interestRate}</span>
                        </div>
                        <div className="rates-cta">
                            <Link to="/loan-application" className="btn-hero-primary">
                                Apply Now <ArrowRight size={20} />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Charges & Limits */}
            <section className="product-charges">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Pricing</span>
                        <h2>Charges & Limits</h2>
                        <p>Clear and upfront charges with no hidden fees</p>
                    </div>
                    <div className="charges-table-wrapper animate-in delay-1">
                        <table className="charges-table">
                            <thead>
                                <tr>
                                    <th>Particulars</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.charges.map((charge, index) => (
                                    <tr key={index}>
                                        <td>{charge.label}</td>
                                        <td><strong>{charge.value}</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* Documents */}
            <section className="product-documents">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Paperwork</span>
                        <h2>Documents Required</h2>
                        <p>Minimal documentation for a hassle-free experience</p>
                    </div>
                    <div className="documents-grid">
                        {product.documents.map((doc, index) => (
                            <div key={index} className={`document-card animate-in delay-${index + 1}`}>
                                <div className="doc-icon">
                                    <FileText size={22} />
                                </div>
                                <span>{doc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQs */}
            <section id="faq" className="product-faqs">
                <div className="container">
                    <div className="section-header-new">
                        <span className="section-tag">Got Questions?</span>
                        <h2>Frequently Asked Questions</h2>
                    </div>
                    <div className="faqs-wrapper">
                        <FAQAccordion faqs={product.faqs} />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="product-cta-section">
                <div className="container">
                    <div className="cta-inner animate-in">
                        <h2>Ready to Grow Your Business?</h2>
                        <p>Start your loan application today and get quick approval within 48 hours</p>
                        <Link to="/loan-application" className="btn-cta-white">
                            Apply Now <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default BusinessLoan;
