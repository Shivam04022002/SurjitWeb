import { useState } from 'react';
import { imageUrl } from '../utils/image';
import './ProductBanner.css';

// Full-width banner strip between the hero and the product sections.
// The whole section is omitted when the CMS has no banner for this product, so
// nothing on the page shifts for a product that never had one.
const ProductBanner = ({ product }) => {
    const [failed, setFailed] = useState(false);
    const src = imageUrl(product?.bannerImage);

    if (!src || failed) return null;

    return (
        <section className="product-banner" aria-label="Product banner">
            <div className="container">
                <div className="product-banner-frame">
                    <img
                        src={src}
                        alt={`${product?.name || product?.title || 'Product'} banner`}
                        loading="lazy"
                        decoding="async"
                        onError={() => setFailed(true)}
                    />
                </div>
            </div>
        </section>
    );
};

export default ProductBanner;
