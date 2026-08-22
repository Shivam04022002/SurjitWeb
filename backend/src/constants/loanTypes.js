// `loanType` is a three-value classification that predates the CMS product
// catalogue and is kept for backward compatibility. A product's category is
// what determines it, so the mapping is by CATEGORY slug — not by product.
//
// That distinction matters: any number of products can live under a category
// and are classified automatically, so a new product added in the CMS needs no
// code change here. Only a brand-new *category* would, and an unmapped
// category simply falls back to the submitted loanType rather than failing.
const LOAN_TYPES = ['business', 'vehicle', 'lap'];

const CATEGORY_SLUG_TO_LOAN_TYPE = {
    'business-loan': 'business',
    'commercial-vehicle-loan': 'vehicle',
    'loan-against-property': 'lap'
};

// Returns the loanType implied by a populated product's category, or null when
// the category has no mapping (a category added after this file was written).
const loanTypeForCategorySlug = (slug) => CATEGORY_SLUG_TO_LOAN_TYPE[slug] || null;

module.exports = { LOAN_TYPES, CATEGORY_SLUG_TO_LOAN_TYPE, loanTypeForCategorySlug };
