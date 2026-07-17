// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SOURCE OF TRUTH — Products
// Extracted verbatim from the original hardcoded `productsData` object in
// frontend/src/pages/Products.jsx (the legacy, now-unrouted product page).
// Shaped to match the backend Product / ProductCategory models.
//
// The original page used a single free-text `interestRate` string; where a
// numeric rate was present it is expressed as one structured `interestRates`
// row + an `emiConfig`, and the original wording is preserved in longDescription
// so nothing is lost.
// ─────────────────────────────────────────────────────────────────────────────

export const categories = [
    { name: 'Business Loan', slug: 'business-loan', shortDescription: 'Loans for New-To-Credit business owners.', displayOrder: 1 },
    { name: 'Commercial Vehicle Loan', slug: 'commercial-vehicle-loan', shortDescription: 'Financing for e-rickshaws and commercial vehicles.', displayOrder: 2 },
    { name: 'Loan Against Property', slug: 'loan-against-property', shortDescription: 'Micro loans against residential or commercial property.', displayOrder: 3 }
];

export const products = [
    {
        slug: 'business-loan',
        name: 'Arambh Business Loan',
        categorySlug: 'business-loan',
        heroTitle: 'Arambh Business Loan',
        heroDescription:
            'Arambh Business Loan is a product specially tailored for New-To-Credit (NTC) Business Owners, to help them access capital to support and grow their businesses. These loans provide funds for various needs, such as purchasing inventory, upgrading equipment, managing cash flow, or expanding the business.',
        shortDescription: 'A business loan tailored for New-To-Credit (NTC) business owners.',
        longDescription: 'Interest Rate: Reducing Rate of Interest 30% per annum or 1.41% per Month*',
        displayOrder: 1,
        features: [
            'Loan up to ₹50,000 to ₹1,50,000',
            'Loan Tenure up to 24 Months',
            'Easy Monthly Installment',
            'Loan Approval within 48 hours',
            'Same day Disbursement after documentation',
            'For New-To-Credit (NTC) customers'
        ],
        eligibility: [
            { title: 'Nationality', description: 'Indian' },
            { title: 'Customer Profile', description: 'Business Owner (NTC)' },
            { title: 'Loan Tenure', description: '24 Months' },
            { title: 'Business Stability', description: '18 Months or More' }
        ],
        documents: [
            'KYC Documents (AADHAR, PAN)',
            'Business Proof',
            'Residence Ownership Proof'
        ],
        interestRates: [
            { loanAmountFrom: 50000, loanAmountTo: 150000, interestRate: 30, tenure: '24 Months' }
        ],
        emiConfig: { minimumAmount: 50000, maximumAmount: 150000, defaultAmount: 100000, interestRate: 30, minimumTenure: 6, maximumTenure: 24, defaultTenure: 24 },
        faqs: [
            { question: 'What is the CIBIL score requirement?', answer: 'New-To-Credit (NTC) customers are eligible.' },
            { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
            { question: 'What is the loan tenure?', answer: 'Loan tenure is up to 24 months.' },
            { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' }
        ]
    },
    {
        slug: 'commercial-vehicle-loan',
        name: 'E-Rickshaw Loan',
        categorySlug: 'commercial-vehicle-loan',
        heroTitle: 'E-Rickshaw Loan',
        heroDescription:
            'An e-rickshaw loan is a specialized financial product designed to help individuals purchase electric rickshaws, also known as e-rickshaws. E-rickshaws have become a popular and eco-friendly mode of transportation in urban and semi-urban areas, offering a cost-effective solution for last-mile connectivity. These loans enable potential buyers to acquire an e-rickshaw without bearing the entire upfront cost, making the transition to sustainable transportation more accessible.',
        shortDescription: 'Financing to purchase new and used electric rickshaws.',
        longDescription:
            'Interest Rate: 16.5% per annum or 1.36%* per month.\n\nE-Rickshaw Loader: An E-Rickshaw Loader is a type of electric vehicle designed specifically for transporting goods and cargo over short distances. It offers an eco-friendly, cost-effective, and efficient solution for small businesses, vendors, and logistics operations, especially in urban and semi-urban areas. E-Rickshaw Loaders are powered by rechargeable batteries, reducing fuel costs and minimizing environmental impact.',
        displayOrder: 2,
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
            { title: 'Nationality', description: 'Indian' },
            { title: 'Customer Profile', description: 'Driver, Farmer, Individual' },
            { title: 'Loan Tenure', description: '12 to 18 Months' },
            { title: 'Residence Stability', description: 'Should have an own house' }
        ],
        documents: [
            'KYC Documents (AADHAR, PAN)',
            'Driving License',
            'Residence Ownership Proof'
        ],
        interestRates: [
            { loanAmountFrom: 50000, loanAmountTo: 150000, interestRate: 16.5, tenure: '12 to 18 Months' }
        ],
        emiConfig: { minimumAmount: 50000, maximumAmount: 150000, defaultAmount: 100000, interestRate: 16.5, minimumTenure: 6, maximumTenure: 18, defaultTenure: 18 },
        faqs: [
            { question: 'What is the CIBIL score requirement?', answer: 'CIBIL Score of 650+ and NTC (New To Credit) customers are eligible.' },
            { question: 'What is the loan amount range?', answer: 'Loan amount ranges from ₹50,000 to ₹1,50,000.' },
            { question: 'What is the loan tenure?', answer: 'Loan tenure is 12 to 18 months.' },
            { question: 'How fast is the disbursement?', answer: 'Same day disbursement after documentation is complete.' }
        ]
    },
    {
        slug: 'micro-lap',
        name: 'Micro LAP',
        categorySlug: 'loan-against-property',
        heroTitle: 'Micro LAP',
        heroDescription:
            "A Micro Loan Against Property (Micro LAP) is a type of loan product aimed at small business owners or individuals with limited credit needs who may not qualify for larger, traditional loans. It's similar to a standard Loan Against Property (LAP), where the borrower pledges property as collateral to secure the loan, but it's tailored for lower loan amounts. Micro LAP products are typically designed for small enterprises, micro-entrepreneurs, or self-employed individuals who need quick access to modest funds for business expansion, working capital, or personal financial needs.",
        shortDescription: 'A micro loan against property for small business owners.',
        longDescription: 'Interest Rate: Competitive rates based on profile.',
        displayOrder: 3,
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
            { title: 'Nationality', description: 'Indian' },
            { title: 'Customer Profile', description: 'Self Employed, Business Owners' },
            { title: 'Loan Tenure', description: 'Up to 120 months' },
            { title: 'Employment Stability', description: '2 Years or more' }
        ],
        documents: [
            'KYC Documents (AADHAR, PAN)',
            'Property Documents',
            'Income Proof',
            'Business Proof'
        ],
        // Original page had no numeric rate ("Competitive rates based on profile") → no structured row.
        interestRates: [],
        emiConfig: { minimumAmount: 100000, maximumAmount: 5000000, defaultAmount: 500000, interestRate: 12, minimumTenure: 12, maximumTenure: 120, defaultTenure: 60 },
        faqs: [
            { question: 'Who is eligible for Micro LAP?', answer: 'Self-employed individuals and business owners with 2+ years of stability are eligible.' },
            { question: 'What is the maximum tenure?', answer: 'Loan tenure is up to 120 months (10 years).' },
            { question: 'What property can be used as collateral?', answer: 'Residential or commercial property can be pledged as collateral.' },
            { question: 'How much can I borrow?', answer: 'Loan amount depends on property value and LTV ratio.' }
        ]
    }
];

export default { categories, products };
