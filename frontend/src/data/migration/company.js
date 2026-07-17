// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SOURCE OF TRUTH — Company / About
// Extracted from the original hardcoded website content (About hero, Home SEO
// copy, Footer/About legal constants) and the team portrait assets that ship in
// frontend/src/assets/website. Images are referenced by *filename* (relative to
// that assets folder); the migration resolves + uploads them to S3.
//
// NOTE: The original React pages only contained team *photos* (no structured
// designations), so every person below is imported as LEADERSHIP with a truthful
// generic title ("Team Member"), except where a title was encoded in the file
// name. Re-classify actual Board Directors inside the CMS after migration.
// ─────────────────────────────────────────────────────────────────────────────

export const company = {
    companyName: 'Surjit Finance',
    tagline: 'Empowering Dreams, Enabling Growth',
    aboutDescription:
        'Surjit Finance is an RBI-registered NBFC providing Business Loans, E-Rickshaw Loans and Micro LAP across North India. We are committed to empowering financial inclusion and enabling growth for New-To-Credit customers, small business owners and micro-entrepreneurs.',
    mission: '',
    vision: '',
    history: '',
    heroTitle: 'About Us',
    heroSubtitle: 'Empowering Dreams, Enabling Growth',
    // Legal identifiers shown on the original About/Footer
    cin: 'U65921UP1993PTC122979',
    rbiRegistration: 'B-12.00478'
};

// Board of Directors — the source website did not carry structured director data
// (names + designations). Left intentionally empty; populate via the CMS.
export const directors = [];

// Leadership / Team — real people whose portraits ship with the website.
export const leadership = [
    { name: 'Kapil Arjariya', designation: 'State Head', photo: 'Kapil Arjariya State Head.png' },
    { name: 'Adarsh Kumar Singh', designation: 'Team Member', photo: 'Adarsh Kumar Singh.png' },
    { name: 'Ajay Singh Negi', designation: 'Team Member', photo: 'Ajay Singh Negi.jpg' },
    { name: 'Alok Kumar Singh', designation: 'Team Member', photo: 'Alok Kumar Singh.jpg' },
    { name: 'Anubhav Singh', designation: 'Team Member', photo: 'Anubhav Singh.png' },
    { name: 'Anurag Singh', designation: 'Team Member', photo: 'Anurag Singh.jpg' },
    { name: 'Jai Shankar Singh', designation: 'Team Member', photo: 'Jai Shankar Singh.png' },
    { name: 'Pawan Kumar Pandey', designation: 'Team Member', photo: 'Pawan Kumar Pandey.jpg' },
    { name: 'Rajan Singh', designation: 'Team Member', photo: 'Rajan Singh.png' },
    { name: 'Santosh Yadav', designation: 'Team Member', photo: 'Santosh Yadav.png' },
    { name: 'Shesh Dhar Singh', designation: 'Team Member', photo: 'Shesh Dhar Singh.png' },
    { name: 'Shyam Dhar Singh', designation: 'Team Member', photo: 'Shyam Dhar Singh.png' },
    { name: 'Varun Kumar Yadav', designation: 'Team Member', photo: 'Varun Kumar Yadav.jpg' },
    { name: 'Vinod Singh Solanki', designation: 'Team Member', photo: 'Vinod Singh Solanki.png' },
    { name: 'Vivek Tyagi', designation: 'Team Member', photo: 'Vivek Tyagi.png' }
].map((m, i) => ({ ...m, displayOrder: i + 1 }));

export default { company, directors, leadership };
