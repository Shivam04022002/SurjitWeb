import { Link } from 'react-router-dom';
import {
    Facebook,
    Instagram,
    Twitter,
    Linkedin,
    Youtube,
    Mail,
    Phone,
    MapPin,
    ArrowUpRight
} from 'lucide-react';
import './Footer.css';
import fallbackLogo from "../assets/logo-4-2048x319.png";
import pressRelease from "../assets/Press_Release.pdf";
import { useSettings, useActiveProductCategories } from '../hooks';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const { data: settings } = useSettings();
    const { data: categories } = useActiveProductCategories();

    const logo = settings?.whiteLogo?.url || settings?.primaryLogo?.url || fallbackLogo;
    const email = settings?.email || settings?.supportEmail || null;
    const tollFree = settings?.tollFreeNumber || settings?.phone || null;
    const address = settings?.officeAddress
        ? `${settings.officeAddress}${settings.city ? ', ' + settings.city : ''}${settings.state ? ', ' + settings.state : ''}${settings.pinCode ? ' - ' + settings.pinCode : ''}`
        : null;
    const footerDesc = settings?.footerDescription || null;
    const copyright = settings?.copyright || `Copyright ©${currentYear} Surjit Finance. All Rights Reserved.`;

    const quickLinks = [
        { name: 'Nodal Officer', path: '/nodal-officer' },
        { name: 'Privacy Policy', path: '/privacy-policy' },
        { name: 'Refund Policy', path: '/refund-policy' },
        { name: 'Terms & Conditions', path: '/terms-and-conditions' },
        { name: 'EMI Calculator', path: '/#emi-calculator' },
        { name: 'FAQs', path: '/faqs' },
    ];

    // Categories rather than products, matching the header: each link resolves
    // to that category's first active product. The API already drops inactive
    // entries and orders by displayOrder.
    const productLinks = (categories && categories.length > 0)
        ? categories.map(c => ({ name: c.name, path: `/products/${c.slug}` }))
        : [
            { name: 'Business Loan', path: '/products/business-loan' },
            { name: 'Commercial Vehicle Loan', path: '/products/commercial-vehicle-loan' },
            { name: 'Loan Against Property', path: '/products/loan-against-property' },
        ];

    const socialMap = [
        { icon: Facebook, key: 'facebook', label: 'Facebook' },
        { icon: Instagram, key: 'instagram', label: 'Instagram' },
        { icon: Twitter, key: 'twitter', label: 'Twitter' },
        { icon: Linkedin, key: 'linkedin', label: 'LinkedIn' },
        { icon: Youtube, key: 'youtube', label: 'YouTube' },
    ];

    const activeSocialLinks = socialMap
        .filter(s => settings?.[s.key])
        .map(s => ({ ...s, url: settings[s.key] }));

    return (
        <footer className="footer">
            <div className="footer-wave">
                <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V0H1380C1320 0 1200 0 1080 0C960 0 840 0 720 0C600 0 480 0 360 0C240 0 120 0 60 0H0V120Z" fill="currentColor" />
                </svg>
            </div>

            <div className="footer-content">
                <div className="container">
                    <div className="footer-grid">
                        {/* Company Info */}
                        <div className="footer-section footer-about">
                            <Link to="/" className="footer-logo">
                                <img
                                    src={logo}
                                    alt="Surjit Finance"
                                    className="footer-logo-img"
                                    onError={(e) => { e.target.src = fallbackLogo; }}
                                />
                            </Link>
                            {footerDesc && <p className="footer-description">{footerDesc}</p>}
                            <div className="footer-badges">
                                <div className="badge">
                                    <span className="badge-label">CIN</span>
                                    <span className="badge-value">U65921UP1993PTC122979</span>
                                </div>
                                <div className="badge">
                                    <span className="badge-label">RBI Reg. No.</span>
                                    <span className="badge-value">B-12.00478</span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div className="footer-section">
                            <h4 className="footer-title">Quick Links</h4>
                            <ul className="footer-links">
                                {quickLinks.map((link, index) => (
                                    <li key={index}>
                                        <Link to={link.path}>
                                            {link.name}
                                            <ArrowUpRight size={14} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Products */}
                        <div className="footer-section">
                            <h4 className="footer-title">Products</h4>
                            <ul className="footer-links">
                                {productLinks.map((product, index) => (
                                    <li key={index}>
                                        <Link to={product.path}>
                                            {product.name}
                                            <ArrowUpRight size={14} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <h4 className="footer-title" style={{ marginTop: '1.5rem' }}>Reports</h4>
                            <ul className="footer-links">
                                <li>
                                    <a href={pressRelease} target="_blank" rel="noopener noreferrer">
                                        Press Release
                                        <ArrowUpRight size={14} />
                                    </a>
                                </li>
                                <li>
                                    <Link to="/reports">
                                        Annual Returns
                                        <ArrowUpRight size={14} />
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Contact */}
                        <div className="footer-section">
                            <h4 className="footer-title">Contact Us</h4>
                            <div className="footer-contact">
                                {email && (
                                    <div className="contact-item">
                                        <Mail size={18} />
                                        <a href={`mailto:${email}`}>{email}</a>
                                    </div>
                                )}
                                {tollFree && (
                                    <div className="contact-item">
                                        <Phone size={18} />
                                        <a href={`tel:${tollFree}`}>{tollFree}</a>
                                    </div>
                                )}
                                {address && (
                                    <div className="contact-item">
                                        <MapPin size={18} />
                                        <address>{address}</address>
                                    </div>
                                )}
                            </div>

                            <div className="footer-social">
                                {activeSocialLinks.map((social, index) => (
                                    <a
                                        key={index}
                                        href={social.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={social.label}
                                        className="social-link"
                                    >
                                        <social.icon size={20} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <div className="container">
                    <p>{copyright}</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
