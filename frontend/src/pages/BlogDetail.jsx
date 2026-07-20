import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, User, Tag, Clock, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import { useBlog, useRelatedBlogs, useAdjacentBlogs } from '../hooks';
import './BlogDetail.css';

const SITE_URL = 'https://surjitfinance.com';

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const BlogDetail = () => {
    // The param is still named `id`, matching the route that existed when
    // articles were static — the old ids were already the slugs the CMS now
    // stores, so previously shared links keep resolving.
    const { id: slug } = useParams();
    const navigate = useNavigate();

    const { data: blog, loading, error, refetch } = useBlog(slug);
    const { data: related } = useRelatedBlogs(slug, 3);
    const { data: adjacent } = useAdjacentBlogs(slug);

    if (loading) {
        return (
            <div className="blog-detail-page">
                <div className="container">
                    <div className="blog-detail-header">
                        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '30%', marginBottom: 20 }} />
                        <div style={{ height: 36, background: '#e5e7eb', borderRadius: 4, width: '70%', marginBottom: 16 }} />
                        <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '50%' }} />
                    </div>
                    <div style={{ height: 320, background: '#e5e7eb', borderRadius: 12, margin: '24px 0' }} />
                </div>
            </div>
        );
    }

    if (error || !blog) {
        return (
            <div className="blog-detail-not-found">
                <div className="container">
                    <h2>Blog Post Not Found</h2>
                    <p>The article you&apos;re looking for doesn&apos;t exist or has been removed.</p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={refetch} className="btn btn-secondary">
                            <RefreshCw size={16} /> Retry
                        </button>
                        <Link to="/blogs" className="btn btn-primary">Back to Blogs</Link>
                    </div>
                </div>
            </div>
        );
    }

    const published = blog.publishedAt || blog.createdAt;

    return (
        <div className="blog-detail-page">
            <SEO
                title={blog.seo?.metaTitle || blog.title}
                description={blog.seo?.metaDescription || blog.summary}
                keywords={blog.seo?.metaKeywords}
                canonical={`${SITE_URL}/blogs/${blog.slug}`}
                ogImage={blog.seo?.ogImage?.url || blog.featuredImage?.url}
            />

            <div className="container">
                <div className="blog-detail-header">
                    <button onClick={() => navigate('/blogs')} className="btn-back">
                        <ArrowLeft size={18} /> Back to Blogs
                    </button>
                    <div className="blog-detail-meta">
                        <span><Calendar size={16} /> {formatDate(published)}</span>
                        <span><User size={16} /> Written by {blog.author || 'admin'}</span>
                        {blog.category?.name && (
                            <span className="category-pill"><Tag size={16} /> {blog.category.name}</span>
                        )}
                        {blog.readingTime > 0 && (
                            <span><Clock size={16} /> {blog.readingTime} min read</span>
                        )}
                    </div>
                    <h1>{blog.title}</h1>
                </div>

                {blog.featuredImage?.url && (
                    <div className="blog-detail-image">
                        <img src={blog.featuredImage.url} alt={blog.title} />
                    </div>
                )}

                {/* Content is HTML authored in the CMS editor. */}
                <div
                    className="blog-detail-content"
                    dangerouslySetInnerHTML={{ __html: blog.content }}
                />

                {blog.tags && blog.tags.length > 0 && (
                    <div className="blog-detail-tags">
                        {blog.tags.map((tag) => (
                            <span key={tag} className="blog-tag">#{tag}</span>
                        ))}
                    </div>
                )}

                {/* Previous / next through the archive by publish date. */}
                {(adjacent?.previous || adjacent?.next) && (
                    <nav className="blog-adjacent" aria-label="More articles">
                        {adjacent.previous ? (
                            <Link to={`/blogs/${adjacent.previous.slug}`} className="blog-adjacent-link is-prev">
                                <span className="blog-adjacent-label"><ArrowLeft size={14} /> Previous</span>
                                <span className="blog-adjacent-title">{adjacent.previous.title}</span>
                            </Link>
                        ) : <span />}
                        {adjacent.next ? (
                            <Link to={`/blogs/${adjacent.next.slug}`} className="blog-adjacent-link is-next">
                                <span className="blog-adjacent-label">Next <ArrowRight size={14} /></span>
                                <span className="blog-adjacent-title">{adjacent.next.title}</span>
                            </Link>
                        ) : <span />}
                    </nav>
                )}

                <div className="blog-detail-footer">
                    <button onClick={() => navigate('/blogs')} className="btn btn-secondary">
                        <ArrowLeft size={18} /> Back to all articles
                    </button>
                </div>
            </div>

            {/* Related: same category, this article excluded. */}
            {related && related.length > 0 && (
                <section className="blog-related section">
                    <div className="container">
                        <div className="section-header">
                            <h2>Related Articles</h2>
                        </div>
                        <div className="blog-related-grid">
                            {related.map((item) => (
                                <article key={item._id} className="blog-card">
                                    <div className="blog-image">
                                        {item.featuredImage?.url && (
                                            <img
                                                src={item.featuredImage.url}
                                                alt={item.title}
                                                className="blog-image-img"
                                                loading="lazy"
                                            />
                                        )}
                                        {item.category?.name && (
                                            <div className="blog-category">{item.category.name}</div>
                                        )}
                                    </div>
                                    <div className="blog-content">
                                        <span className="blog-date">{formatDate(item.publishedAt || item.createdAt)}</span>
                                        <h3>{item.title}</h3>
                                        <p>{item.summary}</p>
                                        <Link to={`/blogs/${item.slug}`} className="read-more">
                                            Read more <ArrowRight size={14} />
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default BlogDetail;
