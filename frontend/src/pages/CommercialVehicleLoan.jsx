import { Link } from 'react-router-dom';
import EMICalculator from '../components/EMICalculator';
import FAQAccordion from '../components/FAQAccordion';
import { ArrowRight, Check, FileText, Truck, Users, Clock, Zap, Shield, TrendingUp, IndianRupee, CalendarDays, Percent } from 'lucide-react';
import './ProductPage.css';

const CommercialVehicleLoan = () => {
    const product = {
        title: 'E-Rickshaw Loan',
        subtitle: 'Commercial Vehicle Loan',
        heroDescription: 'An e-rickshaw loan is a specialized financial product designed to help individuals purchase electric rickshaws. E-rickshaws have become a popular and eco-friendly mode of transportation in urban and semi-urban areas, offering a cost-effective solution for last-mile connectivity.',
        features: [
            'Upto 75% of Ex-Showroom Price Financed',
            'Competitive Interest Rates',
            'Flexible Repayment Tenure',
            'Loan for New and Used Vehicles',
            'Low Down Payment Options',
            'Insurance Coverage',
            'Easy Eligibility Criteria'
        ],
        eligibility: [
            { label: 'Nationality', value: 'Indian', icon: Shield },
            { label: 'Customer Profile', value: 'Driver, Farmer, Individual', icon: Users },
            { label: 'Loan Tenure', value: '12 to 18 Months', icon: CalendarDays },
            { label: 'Residence Stability', value: 'Should have an own house', icon: TrendingUp }
        ],
        interestRate: '16.5% per annum or 1.36%* per month',
        documents: ['KYC Documents (AADHAR, PAN)', 'Driving License', 'Residence Ownership Proof'],
        faqs: [
            { question: 'What is the CIBIL score requirement?', answer: 'CIBIL Score of 650+ and NTC (New To Credit) customers are eligible.' },
            { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
            { question: 'What is the loan tenure?', answer: 'Loan tenure is 12 to 18 months.' },
            { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' }
        ],
        additionalProducts: [{
            title: 'E-Rickshaw Loader',
            description: 'An E-Rickshaw Loader is designed specifically for transporting goods and cargo over short distances. It offers an eco-friendly, cost-effective solution for small businesses, vendors, and logistics operations.'
        }],
        stats: [
            { icon: Percent, value: '75%', label: 'Financing Available' },
            { icon: CalendarDays, value: '18 Mo', label: 'Max Tenure' },
            { icon: Zap, value: 'Same Day', label: 'Disbursement' },
            { icon: IndianRupee, value: '16.5%', label: 'Per Annum' }
        ]
    };

    return (
        <div className="product-page">
            <section className="product-hero">
                <div className="container">
                    <div className="product-hero-content">
                        <div className="product-hero-text animate-in">
                            <span className="product-badge"><Truck size={16} /> {product.subtitle}</span>
                            <h1>E-Rickshaw <span className="text-highlight">Loan</span></h1>
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
                            <div className="hero-icon-wrapper"><div className="hero-icon-bg"></div><Truck size={100} /></div>
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
                        <p>Empowering eco-friendly transportation with accessible financing</p>
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
                        <p>Simple eligibility criteria designed for drivers, farmers, and individuals</p>
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

            <section className="additional-products">
                <div className="container">
                    <div className="section-header-new"><span className="section-tag">Also Available</span><h2>Related Products</h2></div>
                    {product.additionalProducts.map((ap, i) => (
                        <div key={i} className="additional-product-card animate-in"><h3>{ap.title}</h3><p>{ap.description}</p><Link to="/loan-application" className="btn btn-primary btn-lg">Apply Now <ArrowRight size={18} /></Link></div>
                    ))}
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
                    <div className="cta-inner animate-in"><h2>Go Green with E-Rickshaw</h2><p>Start your eco-friendly transportation journey today</p><Link to="/loan-application" className="btn-cta-white">Apply Now <ArrowRight size={20} /></Link></div>
                </div>
            </section>
        </div>
    );
};

export default CommercialVehicleLoan;
