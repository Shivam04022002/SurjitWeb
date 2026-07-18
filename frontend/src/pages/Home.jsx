import Hero from '../components/Hero';
import EMICalculator from '../components/EMICalculator';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Building2, Award, TrendingUp } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import './Home.css';
import { blogs } from '../data/blogs';

// Partner Logos
import auBank from '../assets/website/AU-BANK-1.png';
import boi from '../assets/website/BOI.png';
import hdfc from '../assets/website/HDFC.png';
import indusind from '../assets/website/IndusInd.png';
import sbi from '../assets/website/SBI-LOGO.png';
import csbBank from '../assets/website/CSB-Bank.png';
import cubBank from '../assets/website/CUB.png';
import arthmate from '../assets/website/Arthmate-logo.png';
import baidFinance from '../assets/website/Baid-Finance-1.png';
import vivriti from '../assets/website/Vivriti-Capital-1.png';
import namdev from '../assets/website/Namdev-Finvest.jpg';
import southIndian from '../assets/website/South-Indian-Bank.jpg';
import easebuzz from '../assets/website/Easebuzz.png';
import payu from '../assets/website/Payu-1.png';
import { useProducts, useSettings } from '../hooks';

const GRADIENTS = ['primary', 'secondary', 'accent'];

const Home = () => {
    const { data: cmsProducts, loading: productsLoading, error: productsError } = useProducts();
    const { data: settings } = useSettings();

    const products = (cmsProducts && cmsProducts.length > 0)
        ? cmsProducts.map((p, i) => ({
            title: p.name,
            description: p.shortDescription || p.description || '',
            icon: p.icon || ['💼', '🛺', '🏠'][i % 3],
            link: p.category?.slug ? `/products/${p.category.slug}/${p.slug}` : `/products/${p.slug}`,
            gradient: GRADIENTS[i % GRADIENTS.length],
            highlight: i === 0,
            features: []
        }))
        : [];

    const partners = [
        { name: 'AU Small Finance Bank', logo: auBank },
        { name: 'Bank of India', logo: boi },
        { name: 'HDFC Bank', logo: hdfc },
        { name: 'IndusInd Bank', logo: indusind },
        { name: 'State Bank of India', logo: sbi },
        { name: 'South Indian Bank', logo: southIndian },
        { name: 'CSB Bank', logo: csbBank },
        { name: 'City Union Bank', logo: cubBank },
        { name: 'Arthmate', logo: arthmate },
        { name: 'Baid Finance', logo: baidFinance },
        { name: 'Vivriti Capital', logo: vivriti },
        { name: 'Namdev Finvest', logo: namdev },
        { name: 'Easebuzz', logo: easebuzz },
        { name: 'PayU', logo: payu }
    ];

    return (
        <div className="home-page">
            <SEO
                title={settings?.tagline || 'Empowering Financial Inclusion'}
                description={settings?.companyDescription || 'Surjit Finance is an RBI-registered NBFC providing Business Loans, E-Rickshaw Loans and Micro LAP across North India.'}
            />
            <Hero />

            {/* Products Section */}
            <section className="products-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Our Products</h2>
                        <p>Tailored financial solutions designed to unlock your potential and fuel your ambitions</p>
                    </div>
                    {productsLoading
                        ? (
                            <div className="products-grid grid grid-3">
                                {Array(3).fill(0).map((_, i) => (
                                    <div key={i} className="product-card" style={{ opacity: 0.5 }}>
                                        <div style={{ width: 56, height: 56, background: '#e5e7eb', borderRadius: '50%', marginBottom: 16 }} />
                                        <div style={{ height: 20, background: '#e5e7eb', borderRadius: 4, width: '60%', marginBottom: 12 }} />
                                        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '100%', marginBottom: 6 }} />
                                        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '80%' }} />
                                    </div>
                                ))}
                            </div>
                        )
                        : productsError
                            ? <p style={{ textAlign: 'center', color: '#6b7280' }}>Unable to load products. Please try again later.</p>
                            : products.length > 0
                                ? (
                                    <div className="products-slider">
                                        <Swiper
                                            modules={[Navigation, Pagination]}
                                            spaceBetween={30}
                                            slidesPerView={1}
                                            speed={450}
                                            grabCursor
                                            navigation
                                            pagination={{ clickable: true }}
                                            breakpoints={{
                                                768: { slidesPerView: 2 },
                                                1024: { slidesPerView: 3 }
                                            }}
                                        >
                                            {products.map((product, index) => (
                                                <SwiperSlide key={index}>
                                                    <ProductCard {...product} />
                                                </SwiperSlide>
                                            ))}
                                        </Swiper>
                                    </div>
                                )
                                : <p style={{ textAlign: 'center', color: '#6b7280' }}>No products available at the moment.</p>
                    }
                </div>
            </section>

            {/* Tagline Section */}
            <section className="tagline-section">
                <div className="container">
                    <div className="tagline-content">
                        <h2>Fulfilling Dreams, Nurturing Futures</h2>
                        <p>Everywhere We Serve</p>
                    </div>
                </div>
            </section>

            {/* Partners Section */}
            <section className="partners-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Trusted Partners</h2>
                        <p>Explore the strength of our alliances</p>
                    </div>
                    <div className="partners-slider-container">
                        <div className="partners-slider-track">
                            {[...partners, ...partners].map((partner, index) => (
                                <div key={index} className="partner-slide">
                                    <div className="partner-logo-container">
                                        <img src={partner.logo} alt={partner.name} className="partner-logo-img" title={partner.name} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* EMI Calculator */}
            <EMICalculator />

            {/* Why Choose Us */}
            <section className="why-us-section section">
                <div className="container">
                    <div className="section-header">
                        <h2>Why Choose Surjit Finance?</h2>
                        <p>We're committed to empowering your financial journey</p>
                    </div>
                    <div className="why-us-grid grid grid-4">
                        <div className="why-card">
                            <div className="why-icon">
                                <TrendingUp size={32} />
                            </div>
                            <h4>Fast Processing</h4>
                            <p>Loan approval within 48 hours with minimal documentation</p>
                        </div>
                        <div className="why-card">
                            <div className="why-icon">
                                <Users size={32} />
                            </div>
                            <h4>Customer First</h4>
                            <p>Personalized service with dedicated relationship managers</p>
                        </div>
                        <div className="why-card">
                            <div className="why-icon">
                                <Building2 size={32} />
                            </div>
                            <h4>Wide Network</h4>
                            <p>35+ branches across 3 states serving thousands of customers</p>
                        </div>
                        <div className="why-card">
                            <div className="why-icon">
                                <Award size={32} />
                            </div>
                            <h4>RBI Registered</h4>
                            <p>Trusted NBFC with transparent and ethical practices</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Learning Centre / Blogs */}
            <section className="blogs-section section">
                <div className="container">
                    <div className="section-header">
                        <div className="section-header-row">
                            <div>
                                <h2>Surjit Finance Learning Centre</h2>
                                <p>Stay updated with the latest in finance</p>
                            </div>
                            <Link to="/blogs" className="btn btn-secondary">
                                View All
                                <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>
                    <div className="blogs-row-container">
                        {blogs.map((blog) => (
                            <article key={blog.id} className="blog-card">
                                <div className="blog-image">
                                    {blog.image && <img src={blog.image} alt={blog.title} className="blog-image-img" loading="lazy" />}
                                    <div className="blog-category">{blog.category}</div>
                                </div>
                                <div className="blog-content">
                                    <span className="blog-date">{blog.date}</span>
                                    <h3>{blog.title}</h3>
                                    <p>{blog.excerpt}</p>
                                    <Link to={`/blogs/${blog.id}`} className="read-more">
                                        Read more <ArrowRight size={14} />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2>Ready to Get Started?</h2>
                        <p>Apply for a loan today and take the first step towards your financial goals</p>
                        <div className="cta-buttons">
                            <Link to="/loan-application" className="btn btn-accent btn-lg">
                                Apply for a Loan
                                <ArrowRight size={20} />
                            </Link>
                            <Link to="/contact" className="btn btn-secondary btn-lg">
                                Contact Us
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
