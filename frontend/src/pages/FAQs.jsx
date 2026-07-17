import FAQAccordion from '../components/FAQAccordion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './FAQs.css';

const FAQs = () => {
    const faqCategories = [
        {
            title: 'General Questions',
            faqs: [
                {
                    question: 'What are types of loans that I can apply for?',
                    answer: 'Surjit Finance offers three main types of loans: Business Loans (Arambh) for New-To-Credit business owners, Commercial Vehicle Loans for E-Rickshaws and E-Rickshaw Loaders, and Micro LAP (Loan Against Property) for self-employed individuals and business owners.'
                },
                {
                    question: 'What is the minimum business loan amount that I can avail?',
                    answer: 'The minimum business loan amount starts from ₹50,000. You can avail loans up to ₹1,50,000 based on your eligibility and business requirements.'
                },
                {
                    question: 'What is the maximum tenure for loan repayment?',
                    answer: 'The tenure varies by product: Business Loans offer up to 24 months, Commercial Vehicle Loans offer 12-18 months, and Micro LAP offers the longest tenure of up to 120 months (10 years).'
                }
            ]
        },
        {
            title: 'Eligibility & Documents',
            faqs: [
                {
                    question: 'What documents are required to apply for a loan?',
                    answer: 'Basic documents required include KYC documents (Aadhaar and PAN Card), Business Proof (for business loans), Residence Ownership Proof, and Driving License (for vehicle loans). Additional documents may be required based on the loan type.'
                },
                {
                    question: 'What is the eligibility criteria for loans?',
                    answer: 'Eligibility varies by loan type. Generally, you should be an Indian national, meet the minimum age requirement, have stable business/employment for the required period, and meet the CIBIL score requirements (650+ for vehicle loans, NTC accepted for business loans).'
                },
                {
                    question: 'Can I apply if I have no credit history (New-To-Credit)?',
                    answer: 'Yes! Our Arambh Business Loan is specifically designed for New-To-Credit (NTC) business owners who don\'t have an existing credit history.'
                }
            ]
        },
        {
            title: 'Interest Rates & Charges',
            faqs: [
                {
                    question: 'What are the interest rates?',
                    answer: 'Interest rates vary by product: Business Loans have a reducing rate of 30% per annum, Commercial Vehicle Loans range from 16% to 18% per annum, and Micro LAP offers competitive rates based on property value and other factors.'
                },
                {
                    question: 'Are there any hidden charges?',
                    answer: 'No, we believe in complete transparency. All charges including processing fees, documentation charges, and other applicable fees are clearly communicated upfront before loan disbursement.'
                },
                {
                    question: 'Can I prepay my loan?',
                    answer: 'Yes, you can prepay your loan. Prepayment terms and any applicable charges vary by product type. Please contact our customer service for specific details about your loan.'
                }
            ]
        },
        {
            title: 'Application Process',
            faqs: [
                {
                    question: 'How long does the loan approval process take?',
                    answer: 'We offer quick processing with loan approval typically within 48 hours and same-day disbursement after documentation is complete.'
                },
                {
                    question: 'How can I track my loan application status?',
                    answer: 'You can track your loan application status through our customer service helpline (1800-3131-265) or by visiting your nearest branch. Our team will keep you updated at every step.'
                },
                {
                    question: 'What happens after loan approval?',
                    answer: 'After approval, you\'ll need to complete the documentation process. Once verified, the loan amount will be disbursed to your account or directly to the dealer (for vehicle loans) on the same day.'
                }
            ]
        }
    ];

    return (
        <div className="faqs-page">
            {/* Hero */}
            <section className="faqs-hero">
                <div className="container">
                    <h1>Frequently Asked Questions</h1>
                    <p>Solutions at Your Fingertips: Navigating Your Queries with Our FAQ Hub</p>
                </div>
            </section>

            {/* FAQs */}
            <section className="faqs-main section">
                <div className="container">
                    {faqCategories.map((category, index) => (
                        <div key={index} className="faq-category">
                            <h2>{category.title}</h2>
                            <FAQAccordion faqs={category.faqs} />
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="faqs-cta">
                <div className="container">
                    <div className="cta-content">
                        <h2>Still have questions?</h2>
                        <p>Our team is here to help you with any queries</p>
                        <div className="cta-buttons">
                            <Link to="/contact" className="btn btn-primary btn-lg">
                                Contact Us
                                <ArrowRight size={20} />
                            </Link>
                            <a href="tel:1800-3131-265" className="btn btn-secondary btn-lg">
                                Call: 1800-3131-265
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default FAQs;
