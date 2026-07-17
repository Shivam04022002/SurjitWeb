// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SOURCE OF TRUTH — Global Settings
// Extracted from the original hardcoded contact block in Contact.jsx, the Home
// SEO/tagline copy, and the Footer/About legal constants. Shaped to the backend
// GlobalSettings model.
//
// NOTE: the original site had no hardcoded social-media URLs (Footer read them
// from the CMS), so those are left blank for the editor to fill.
// ─────────────────────────────────────────────────────────────────────────────

export const settings = {
    // Company
    companyName: 'Surjit Finance',
    tagline: 'Empowering Dreams, Enabling Growth',
    companyDescription:
        'Surjit Finance is an RBI-registered NBFC providing Business Loans, E-Rickshaw Loans and Micro LAP across North India.',

    // Contact (from Contact.jsx)
    tollFreeNumber: '1800-3131-265',
    phone: '1800-3131-265',
    email: 'info@surjitfinance.com',
    supportEmail: 'info@surjitfinance.com',

    // Address — Head Office (from Contact.jsx)
    officeAddress: '39-C/2, Krishna Nagar, Alambagh',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    country: 'India',
    pinCode: '226023',

    // Social — not present in the original hardcoded site
    facebook: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    twitter: '',

    // Footer / Legal
    footerDescription:
        'Surjit Finance is an RBI-registered NBFC empowering financial inclusion across North India.',
    copyright: 'Copyright © Surjit Finance. All Rights Reserved.',
    footerNote: 'CIN: U65921UP1993PTC122979 | RBI Registration No. B-12.00478',

    // Business Hours (from Contact.jsx: "Mon - Sat: 10:00 AM - 6:00 PM")
    businessHours: {
        monday: '10:00 AM - 6:00 PM',
        tuesday: '10:00 AM - 6:00 PM',
        wednesday: '10:00 AM - 6:00 PM',
        thursday: '10:00 AM - 6:00 PM',
        friday: '10:00 AM - 6:00 PM',
        saturday: '10:00 AM - 6:00 PM',
        sunday: 'Closed'
    }
};

export default { settings };
