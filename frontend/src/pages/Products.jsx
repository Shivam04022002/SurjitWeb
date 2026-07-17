import { useParams, Link } from 'react-router-dom';
import EMICalculator from '../components/EMICalculator';
import FAQAccordion from '../components/FAQAccordion';
import { ArrowRight, Check, FileText, Clock, Shield, Users, Zap, TrendingUp, Home, Truck, Building } from 'lucide-react';
import './Products.css';

const Products = () => {
    const { productId } = useParams();

    const productsData = {
        'business-loan': {
            title: 'Arambh Business Loan',
            subtitle: 'Business Loan',
            icon: Building,
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
                { label: 'Nationality', value: 'Indian' },
                { label: 'Customer Profile', value: 'Business Owner (NTC)' },
                { label: 'Loan Tenure', value: '24 Months' },
                { label: 'Business Stability', value: '18 Months or More' }
            ],
            interestRate: 'Reducing Rate of Interest 30% per annum or 1.41% per Month*',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Business Proof',
                'Residence Ownership Proof'
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' }
            ]
        },
        'commercial-vehicle-loan': {
            title: 'E-Rickshaw Loan',
            subtitle: 'Commercial Vehicle Loan',
            icon: Truck,
            heroDescription: 'An e-rickshaw loan is a specialized financial product designed to help individuals purchase electric rickshaws, also known as e-rickshaws. E-rickshaws have become a popular and eco-friendly mode of transportation in urban and semi-urban areas, offering a cost-effective solution for last-mile connectivity. These loans enable potential buyers to acquire an e-rickshaw without bearing the entire upfront cost, making the transition to sustainable transportation more accessible.',
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
                { label: 'Nationality', value: 'Indian' },
                { label: 'Customer Profile', value: 'Driver, Farmer, Individual' },
                { label: 'Loan Tenure', value: '12 to 18 Months' },
                { label: 'Residence Stability', value: 'Should have an own house' }
            ],
            interestRate: '16.5% per annum or 1.36%* per month',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Driving License',
                'Residence Ownership Proof'
            ],
            faqs: [
                { question: 'What is the CIBIL score requirement?', answer: 'CIBIL Score of 650+ and NTC (New To Credit) customers are eligible.' },
                { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
                { question: 'What is the loan tenure?', answer: 'Loan tenure is 12 to 18 months.' },
                { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' }
            ],
            additionalProducts: [
                {
                    title: 'E-Rickshaw Loader',
                    description: 'An E-Rickshaw Loader is a type of electric vehicle designed specifically for transporting goods and cargo over short distances. It offers an eco-friendly, cost-effective, and efficient solution for small businesses, vendors, and logistics operations, especially in urban and semi-urban areas. E-Rickshaw Loaders are powered by rechargeable batteries, reducing fuel costs and minimizing environmental impact.'
                }
            ]
        },
        'micro-lap': {
            title: 'Micro LAP',
            subtitle: 'Loan Against Property',
            icon: Home,
            heroDescription: 'A Micro Loan Against Property (Micro LAP) is a type of loan product aimed at small business owners or individuals with limited credit needs who may not qualify for larger, traditional loans. It\'s similar to a standard Loan Against Property (LAP), where the borrower pledges property as collateral to secure the loan, but it\'s tailored for lower loan amounts. Micro LAP products are typically designed for small enterprises, micro-entrepreneurs, or self-employed individuals who need quick access to modest funds for business expansion, working capital, or personal financial needs.',
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
                { label: 'Nationality', value: 'Indian' },
                { label: 'Customer Profile', value: 'Self Employed, Business Owners' },
                { label: 'Loan Tenure', value: 'Up to 120 months' },
                { label: 'Employment Stability', value: '2 Years or more' }
            ],
            interestRate: 'Competitive rates based on profile',
            documents: [
                'KYC Documents (AADHAR, PAN)',
                'Property Documents',
                'Income Proof',
                'Business Proof'
            ],
            faqs: [
                { question: 'Who is eligible for Micro LAP?', answer: 'Self-employed individuals and business owners with 2+ years of stability are eligible.' },
                { question: 'What is the maximum tenure?', answer: 'Loan tenure is up to 120 months (10 years).' },
                { question: 'What property can be used as collateral?', answer: 'Residential or commercial property can be pledged as collateral.' },
                { question: 'How much can I borrow?', answer: 'Loan amount depends on property value and LTV ratio.' }
            ]
        }
    };

    const product = productsData[productId];

    if (!product) {
        return (
            <div className="product-not-found">
                <div className="container">
                    <h1>Product Not Found</h1>
                    <p>The product you're looking for doesn't exist.</p>
                    <Link to="/" className="btn btn-primary">Go Home</Link>
                </div>
            </div>
        );
    }

    const ProductIcon = product.icon;

    return (
        <div className="product-page">
            {/* Hero */}
            <section className="product-hero">
                <div className="container">
                    <div className="product-hero-content">
                        <div className="product-hero-text">
                            <span className="product-badge">{product.subtitle}</span>
                            <h1>{product.title}</h1>
                            <p>{product.heroDescription}</p>
                            <div className="product-hero-actions">
                                <Link to="/loan-application" className="btn btn-accent btn-lg">
                                    Apply Loan
                                    <ArrowRight size={20} />
                                </Link>
                            </div>
                            <div className="product-quick-links">
                                <a href="#features-and-benefits">Features & Benefits</a>
                                <a href="#eligibility">Eligibility</a>
                                <a href="#interest-rate-and-charges">Interest Rate & Charges</a>
                                <a href="#emi-calculator">EMI Calculator</a>
                                <a href="#faq">FAQ</a>
                            </div>
                        </div>
                        <div className="product-hero-icon">
                            <ProductIcon size={120} />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features-and-benefits" className="product-features section">
                <div className="container">
                    <div className="section-header">
                        <h2>Features & Benefits</h2>
                    </div>
                    <div className="features-grid">
                        {product.features.map((feature, index) => (
                            <div key={index} className="feature-item">
                                <div className="feature-check">
                                    <Check size={20} />
                                </div>
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                    <div className="features-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Apply Loan
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Eligibility */}
            <section id="eligibility" className="product-eligibility section">
                <div className="container">
                    <div className="section-header">
                        <h2>Eligibility</h2>
                        <p>We have diverse eligibility criteria for our loans. This includes your age, income, nature of your business, and more.</p>
                    </div>
                    <div className="eligibility-grid">
                        {product.eligibility.map((item, index) => (
                            <div key={index} className="eligibility-card">
                                <span className="eligibility-label">{item.label}</span>
                                <span className="eligibility-value">{item.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="eligibility-cta">
                        <Link to="/loan-application" className="btn btn-primary">
                            Apply Loan
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* EMI Calculator */}
            <section id="emi-calculator">
                <EMICalculator loanType={product.title} />
            </section>

            {/* Interest Rate & Charges */}
            <section id="interest-rate-and-charges" className="product-rates section">
                <div className="container">
                    <div className="section-header">
                        <h2>Interest Rate & Charges</h2>
                        <p>Our interest rates are competitive and reasonable for customers. They depend on various factors:</p>
                    </div>
                    <div className="rates-features">
                        <div className="rate-feature">
                            <Check size={20} />
                            <span>Easy and flexible criteria for eligibility</span>
                        </div>
                        <div className="rate-feature">
                            <Check size={20} />
                            <span>Principal, tenure, and other factors influence the rate</span>
                        </div>
                        <div className="rate-feature">
                            <Check size={20} />
                            <span>Get a good interest rate which is pocket-friendly</span>
                        </div>
                        <div className="rate-feature">
                            <Check size={20} />
                            <span>Industry-standard rates with best service and assistance</span>
                        </div>
                    </div>
                    <div className="rate-highlight">
                        <span className="rate-label">Interest Rate</span>
                        <span className="rate-value">{product.interestRate}</span>
                    </div>
                    <div className="rates-cta">
                        <Link to="/loan-application" className="btn btn-primary btn-lg">
                            Apply Loan
                            <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Documents Required */}
            <section className="product-documents section">
                <div className="container">
                    <div className="section-header">
                        <h2>Documents Required</h2>
                    </div>
                    <div className="documents-list">
                        {product.documents.map((doc, index) => (
                            <div key={index} className="document-item">
                                <FileText size={20} />
                                <span>{doc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Additional Products (for commercial vehicle) */}
            {product.additionalProducts && (
                <section className="additional-products section">
                    <div className="container">
                        {product.additionalProducts.map((addProduct, index) => (
                            <div key={index} className="additional-product-card">
                                <h3>{addProduct.title}</h3>
                                <p>{addProduct.description}</p>
                                <Link to="/loan-application" className="btn btn-primary">
                                    Apply Loan
                                    <ArrowRight size={18} />
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* FAQs */}
            <section id="faq" className="product-faqs section">
                <div className="container">
                    <div className="section-header">
                        <h2>Frequently Asked Questions</h2>
                    </div>
                    <div className="faqs-wrapper">
                        <FAQAccordion faqs={product.faqs} />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="product-cta section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Apply?</h2>
                        <p>Start your loan application today and get quick approval</p>
                        <Link to="/loan-application" className="btn btn-accent btn-lg">
                            Apply Now
                            <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Products;
