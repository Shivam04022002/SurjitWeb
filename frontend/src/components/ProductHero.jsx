import { imageUrl } from '../utils/image';
import './ProductHero.css';

// The product hero band. The CMS hero image becomes the section's background
// rather than a separate block on the page, with a dark scrim over it so the
// copy stays legible whatever the photograph looks like.
//
// The image is handed to CSS as a custom property so the URL is declared once
// and the browser fetches a single copy — the same image the API already
// returned, never a second <img>.
//
// No hero image in the CMS means no `has-hero-image` class and no custom
// property, so the section falls back to the brand gradient it has always had.
// Nothing is rendered for a missing image, and nothing can break.
const ProductHero = ({ product, children }) => {
    const src = imageUrl(product?.heroImage);
    // A quote or backslash in the URL would close the CSS url() early, so they
    // are percent-encoded rather than interpolated raw.
    const cssUrl = src && `url("${src.replace(/\\/g, '%5C').replace(/"/g, '%22')}")`;

    return (
        <section
            className={`product-hero${src ? ' has-hero-image' : ''}`}
            style={cssUrl ? { '--product-hero-image': cssUrl } : undefined}
        >
            {children}
        </section>
    );
};

export default ProductHero;
