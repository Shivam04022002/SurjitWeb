// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SOURCE OF TRUTH — Careers
// The live Career page is CMS-driven; the values below are the exact hardcoded
// fallbacks embedded in Career.jsx (hero title/subtitle, "Why Join" heading and
// the four benefit cards, which are folded into whyJoinDescription).
//
// The original site had NO hardcoded job openings, so `jobOpenings` is empty.
// ─────────────────────────────────────────────────────────────────────────────

export const careerSettings = {
    heroTitle: 'Join Our Team',
    heroSubtitle: "Build your career with one of North India's fastest-growing NBFCs",
    joinOurTeamTitle: 'Join Our Team',
    joinOurTeamDescription:
        "Build your career with one of North India's fastest-growing NBFCs. We are always looking for talented, driven people to help us empower financial inclusion.",
    whyJoinTitle: 'Why Join Surjit Finance?',
    whyJoinDescription:
        'Collaborative Culture — Work with talented colleagues in a supportive environment.\n' +
        'Work-Life Balance — Flexible policies that respect your personal time.\n' +
        'Career Growth — Clear growth paths and learning opportunities.\n' +
        'Regular Events — Team celebrations, outings, and cultural events.',
    seo: {
        metaTitle: 'Careers at Surjit Finance',
        metaDescription: "Build your career with one of North India's fastest-growing NBFCs."
    }
};

// No hardcoded job openings existed on the original website.
export const jobOpenings = [];

export default { careerSettings, jobOpenings };
