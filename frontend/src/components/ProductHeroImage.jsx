import { useState } from 'react';
import { imageUrl } from '../utils/image';
import './ProductHeroImage.css';

// The product's hero image, shared by the single-product hero and by each
// carousel slide so the two stay byte-identical in markup.
//
// Renders nothing at all when the CMS has no hero image for this product — the
// hero's gradient is the design's own empty state, so a product without an
// image looks exactly as it did before rather than gaining a placeholder box.
// A URL that fails to load at runtime is treated the same way, via onError.
const ProductHeroImage = ({ product }) => {
    const [failed, setFailed] = useState(false);
    const src = imageUrl(product?.heroImage);

    if (!src || failed) return null;

    return (
        <div className="product-hero-media">
            <img
                src={src}
                alt={product?.name || product?.title || 'Product'}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
            />
        </div>
    );
};

export default ProductHeroImage;
