// ─────────────────────────────────────────────────────────────────────────────
// MIGRATION SOURCE OF TRUTH — Gallery
// Real event photos that ship with the website in frontend/src/assets/website.
// Each album lists its image *filenames*; the migration uploads each file to S3
// (idempotently) and stores the returned URL. The first image of each album is
// used as the cover.
// ─────────────────────────────────────────────────────────────────────────────

export const albums = [
    {
        title: 'AGM 2024',
        slug: 'agm-2024',
        description: 'Annual General Meeting 2024.',
        displayOrder: 1,
        images: [
            'AGM-2024-1.jpg', 'AGM-2024-2.jpg', 'AGM-2024-3.jpg', 'AGM-2024-4.jpg',
            'AGM-2024-4 (1).jpg', 'AGM-2024-5.jpg', 'AGM-2024-6.jpg', 'AGM-2024-7.jpg',
            'AGM-2024-8.jpg', 'AGM-2024-9.jpg', 'AGM-2024-10.jpg'
        ]
    },
    {
        title: 'Diwali 2024',
        slug: 'diwali-2024',
        description: 'Diwali celebrations 2024.',
        displayOrder: 2,
        images: [
            'Diwali-2024-1-scaled.jpg', 'Diwali-2024-2-scaled.jpg', 'Diwali-2024-3-scaled.jpg',
            'Diwali-2024-4-scaled.jpg', 'Diwali-2024-5-scaled.jpg', 'Diwali-2024-6-scaled.jpg',
            'Diwali-2024-7-scaled.jpg', 'Diwali-2024-8-scaled.jpg', 'Diwali-2024-9-scaled.jpg',
            'Diwali-2024-10-scaled.jpg', 'Diwali-2024-11-scaled.jpg', 'Diwali-2024-12-scaled.jpg'
        ]
    },
    {
        title: 'Jaunpur Marketing',
        slug: 'jaunpur-marketing',
        description: 'Marketing drive in Jaunpur.',
        displayOrder: 3,
        images: [
            'Jaunpur-Marketing-1.jpg', 'Jaunpur-Marketing-2.jpg', 'Jaunpur-Marketing-3.jpg',
            'Jaunpur-Marketing-4.jpg', 'Jaunpur-Marketing-5.jpg', 'Jaunpur-Marketing-6.jpg',
            'Jaunpur-Marketing-7.jpg', 'Jaunpur-Marketing-8.jpg', 'Jaunpur-Marketing-9.jpg',
            'Jaunpur-Marketing-9 (1).jpg', 'Jaunpur-Marketing-10.jpg'
        ]
    }
];

export default { albums };
