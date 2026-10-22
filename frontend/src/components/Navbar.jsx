import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, Phone } from 'lucide-react';
import './Navbar.css';
import fallbackLogo from "../assets/logo-4-2048x319.png";
import { useSettings, useActiveProductCategories } from '../hooks';

// Must match the breakpoint in Navbar.css where the menu becomes a panel.
const MOBILE_NAV_QUERY = '(max-width: 1024px)';
const isMobileNav = () => window.matchMedia(MOBILE_NAV_QUERY).matches;

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const location = useLocation();
  const { data: settings } = useSettings();
  const { data: cmsCategories } = useActiveProductCategories();

  const logo = settings?.primaryLogo?.url || fallbackLogo;
  const phone = settings?.tollFreeNumber || settings?.phone || '1800-3131-265';
  const primaryBtnText = settings?.headerPrimaryButtonText || 'Apply Now';
  const primaryBtnUrl = settings?.headerPrimaryButtonUrl || '/loan-application';

  // Categories, not products. Each links to /products/:categorySlug, which
  // resolves to that category's first active product — there is no category
  // page. The API already filters out inactive ones and orders by displayOrder;
  // the static list is only a fallback for a failed fetch.
  const productDropdown = (cmsCategories && cmsCategories.length > 0)
    ? cmsCategories.map(c => ({ name: c.name, path: `/products/${c.slug}` }))
    : [
        { name: 'Business Loan', path: '/products/business-loan' },
        { name: 'Commercial Vehicle Loan', path: '/products/commercial-vehicle-loan' },
        { name: 'Loan Against Property', path: '/products/loan-against-property' },
      ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
  }, [location]);

  // While the panel is open the page behind it stays put: a swipe scrolls the
  // menu, never the page. Overflow is hidden rather than the body being fixed,
  // so the reader's place on the page is kept and nothing jumps to the top.
  // The scrollbar's width is padded back where there is one (a narrow desktop
  // window), so the page does not shift sideways.
  useEffect(() => {
    if (!isOpen) return undefined;
    const { documentElement: html, body } = document;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      html.style.overflow = previous.htmlOverflow;
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPaddingRight;
    };
  }, [isOpen]);

  // Widening past the breakpoint hides the panel, so close it rather than
  // leave the page locked behind a menu that is no longer shown.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_NAV_QUERY);
    const handleChange = (e) => {
      if (!e.matches) {
        setIsOpen(false);
        setActiveDropdown(null);
      }
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    {
      name: 'About Us',
      path: '/about',
      hasPage: true,
      dropdown: [
        { name: 'Our Story', path: '/about#our-story' },
        { name: 'Board of Directors', path: '/about#board' },
        { name: 'Leadership Team', path: '/about#leadership' },
      ]
    },
    {
      name: 'Products',
      path: '/products',
      hasPage: true,
      matchPrefix: true,
      dropdown: productDropdown
    },
    { name: 'Career', path: '/career' },
    { name: 'Gallery', path: '/gallery', matchPrefix: true },
    { name: 'Blogs', path: '/blogs' },
    {
      name: 'Customer Service',
      path: '/contact',
      hasPage: true,
      dropdown: [
        { name: 'FAQs', path: '/faqs' },
        { name: 'Contact Us', path: '/contact' },
        { name: 'Grievance Portal', path: 'https://grievance.surjithirepurchase.com', external: true },
      ]
    },
  ];

  const toggleDropdown = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  // In the mobile panel the label still opens its page, and the chevron opens
  // the sub-links instead — otherwise a tap would always navigate away and the
  // dropdown links could never be reached on a phone. On desktop the chevron
  // is part of the link, as before.
  const handleChevron = (e, index) => {
    if (!isMobileNav()) return;
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown(index);
  };

  // Hover opens dropdowns on desktop only. A tap fires an emulated mouseenter,
  // which would open the dropdown a moment before the chevron toggled it shut.
  const handleHover = (index) => {
    if (!isMobileNav()) setActiveDropdown(index);
  };

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">

        {/* LOGO SECTION */}
        <Link to="/" className="navbar-logo">
          <svg
            className="logo-sf-icon"
            viewBox="0 0 50 60"
            width="36"
            height="42"
          >
            <defs>
              <linearGradient id="sfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#E8960C" />
                <stop offset="50%" stopColor="#D4820A" />
                <stop offset="100%" stopColor="#C06E08" />
              </linearGradient>
            </defs>
          </svg>

          <div className="logo-text-group">
            <img
              src={logo}
              alt="Surjit Finance Logo"
              className="logo-img"
              onError={(e) => { e.target.src = fallbackLogo; }}
            />
          </div>
        </Link>

        {/* MENU */}
        <div className={`navbar-menu ${isOpen ? 'active' : ''}`}>
          {navLinks.map((link, index) => (
            <div
              key={index}
              className={`nav-item ${activeDropdown === index ? 'dropdown-open' : ''}`}
              onMouseEnter={() => link.dropdown && handleHover(index)}
              onMouseLeave={() => handleHover(null)}
            >
              {/* If the item has a dropdown but no direct page, use a span trigger */}
              {link.dropdown && !link.hasPage ? (
                <span
                  className={`nav-link nav-link-trigger ${location.pathname.startsWith('/products') ? 'active' : ''}`}
                  onClick={() => toggleDropdown(index)}
                >
                  {link.name}
                  <ChevronDown size={16} className={`chevron-icon ${activeDropdown === index ? 'rotated' : ''}`} />
                </span>
              ) : (
                <Link
                  to={link.path}
                  className={`nav-link ${(link.matchPrefix ? location.pathname.startsWith(link.path) : location.pathname === link.path) ? 'active' : ''}`}
                  onClick={() => link.dropdown && toggleDropdown(index)}
                >
                  {link.name}
                  {link.dropdown && (
                    <span
                      className="chevron-hit"
                      role="button"
                      aria-label={`${activeDropdown === index ? 'Hide' : 'Show'} ${link.name} links`}
                      aria-expanded={activeDropdown === index}
                      onClick={(e) => handleChevron(e, index)}
                    >
                      <ChevronDown size={16} className={`chevron-icon ${activeDropdown === index ? 'rotated' : ''}`} />
                    </span>
                  )}
                </Link>
              )}

              {link.dropdown && activeDropdown === index && (
                <div className="dropdown-menu">
                  {link.dropdown.map((item, i) =>
                    item.external ? (
                      <a
                        key={i}
                        href={item.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dropdown-item"
                      >
                        {item.name}
                      </a>
                    ) : (
                      <Link
                        key={i}
                        to={item.path}
                        className="dropdown-item"
                      >
                        {item.name}
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ACTIONS */}
        <div className="navbar-actions">
          <a href={`tel:${phone}`} className="navbar-phone">
            <Phone size={18} />
            <span>{phone}</span>
          </a>

          {primaryBtnUrl?.startsWith('http') ? (
            <a href={primaryBtnUrl} className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer" data-track="loan_application_click">
              {primaryBtnText}
            </a>
          ) : (
            <Link to={primaryBtnUrl} className="btn btn-primary btn-sm">
              {primaryBtnText}
            </Link>
          )}

          <button
            className="navbar-toggle"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
