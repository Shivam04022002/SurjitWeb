import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Shield, Clock, Users, MapPin, TrendingUp } from 'lucide-react';
import './Hero.css';
import { useSettings, useCompanyInfo, useProducts, useHomepageStats } from '../hooks';

// The CMS stores a statistic as the single string an editor reads and types
// ("35+", "10K+", "₹50Cr+"). The counter animates a number, so the string is
// split back into the prefix / number / suffix the animation has always used.
// A value with no digits cannot count up — it is rendered literally instead.
const parseStatValue = (value) => {
    const match = String(value ?? '').match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return { target: null, prefix: String(value ?? ''), suffix: '' };
    return { prefix: match[1], target: Number(match[2]), suffix: match[3] };
};

// Shown until the CMS responds, and if it cannot be reached — the counter strip
// is above the fold, so it should never render empty. Same approach as the
// hero product cards below.
const DEFAULT_STATS = [
    { target: 35, prefix: '', suffix: '+', label: 'Branches' },
    { target: 3, prefix: '', suffix: '', label: 'States' },
    { target: 10, prefix: '', suffix: 'K+', label: 'Happy Customers' },
    { target: 50, prefix: '₹', suffix: 'Cr+', label: 'Loans Disbursed' },
];

// Count-up animation hook
const useCountUp = (target, duration = 2000, startCounting = false) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!startCounting) {
            setCount(0);
            return;
        }

        let startTime = null;
        let animationFrame;

        const easeOutQuad = (t) => t * (2 - t);

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutQuad(progress);

            setCount(Math.floor(easedProgress * target));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            } else {
                setCount(target);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [target, duration, startCounting]);

    return count;
};

// Individual animated stat component
const AnimatedStat = ({ target, prefix, suffix, label, isVisible }) => {
    const count = useCountUp(target, 2000, isVisible);

    return (
        <div className="stat-item">
            <span className="stat-number">
                {target === null ? prefix : <>{prefix}{count}{suffix}</>}
            </span>
            <span className="stat-label">{label}</span>
        </div>
    );
};

const Hero = () => {
    const statsRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    const { data: settings } = useSettings();
    const { data: company } = useCompanyInfo();
    const { data: cmsProducts } = useProducts();
    const { data: cmsStats } = useHomepageStats();

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                }
            },
            { threshold: 0.3 }
        );

        if (statsRef.current) {
            observer.observe(statsRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const heroHeading = settings?.tagline || company?.heroTitle || null;
    const heroDesc = company?.heroSubtitle || settings?.companyDescription || null;
    const applyUrl = settings?.headerPrimaryButtonUrl || '/loan-application';
    const applyText = settings?.headerPrimaryButtonText || 'Apply for Loan';

    const statsData = (cmsStats && cmsStats.length > 0)
        ? cmsStats.map((s) => ({ ...parseStatValue(s.value), label: s.title }))
        : DEFAULT_STATS;

    const heroProducts = (cmsProducts && cmsProducts.length > 0)
        ? cmsProducts.slice(0, 3).map((p, i) => ({
            icon: p.icon || ['💼', '🛺', '🏠'][i % 3],
            name: p.name,
            tagline: p.shortDescription ? p.shortDescription.split(' ').slice(0, 4).join(' ') + '…' : '',
            slug: p.slug,
            path: p.category?.slug ? `/products/${p.category.slug}/${p.slug}` : `/products/${p.slug}`,
            cardClass: `hero-card-${i + 1}`,
          }))
        : [
            { icon: '💼', name: 'Business Loan', tagline: 'Up to ₹1.5 Lakh', slug: 'business-loan', path: '/products/business-loan', cardClass: 'hero-card-1' },
            { icon: '🛺', name: 'E-Rickshaw Loan', tagline: 'Easy EMI Options', slug: 'commercial-vehicle-loan', path: '/products/commercial-vehicle-loan', cardClass: 'hero-card-2' },
            { icon: '🏠', name: 'Micro LAP', tagline: 'Up to 120 Months', slug: 'micro-lap', path: '/products/loan-against-property', cardClass: 'hero-card-3' },
          ];

    return (
        <section className="hero">
            <div className="hero-bg">
                <div className="hero-gradient"></div>
                <div className="hero-pattern"></div>
                <div className="hero-circles">
                    <div className="circle circle-1"></div>
                    <div className="circle circle-2"></div>
                    <div className="circle circle-3"></div>
                </div>
            </div>

            <div className="container">
                <div className="hero-content">
                    <div className="hero-text animate-fadeInUp">

                        <h1>
                            {heroHeading
                                ? heroHeading
                                : (<>Empowering Dreams, <br /><span className="text-gradient">Building Futures</span></>)
                            }
                        </h1>
                        <p className="hero-description">
                            {heroDesc || 'Surjit Finance is transforming financial inclusion across North India. From Business Loans to Commercial Vehicle financing, we provide innovative credit solutions tailored for micro-entrepreneurs and small businesses.'}
                        </p>
                        <div className="hero-buttons">
                            <Link to={applyUrl} className="btn btn-primary btn-sm">
                                {applyText}
                                <ArrowRight size={20} />
                            </Link>
                            <Link to="/about" className="btn btn-secondary btn-sm">
                                <Play size={20} />
                                Learn More
                            </Link>
                        </div>
                        <div className="hero-features">
                            <div className="hero-feature">
                                <Clock size={18} />
                                <span>Quick Approval in 48 Hours</span>
                            </div>
                            <div className="hero-feature">
                                <Shield size={18} />
                                <span>100% Secure Process</span>
                            </div>
                        </div>
                    </div>

                    <div className="hero-visual animate-fadeInUp stagger-2">
                        <div className="hero-card-stack">
                            {heroProducts.map((p) => (
                                <Link key={p.slug} to={p.path} className={`hero-card ${p.cardClass}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="card-icon">{p.icon}</div>
                                    <h3>{p.name}</h3>
                                    <p>{p.tagline}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="hero-stats animate-fadeInUp stagger-3" ref={statsRef}>
                    <div className="stats-card">
                        {statsData.map((stat, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <div className="stat-divider"></div>}
                                <AnimatedStat
                                    target={stat.target}
                                    prefix={stat.prefix}
                                    suffix={stat.suffix}
                                    label={stat.label}
                                    isVisible={isVisible}
                                />
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;