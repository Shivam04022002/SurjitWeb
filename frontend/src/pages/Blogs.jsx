import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Tag, Search, RefreshCw } from 'lucide-react';
import SEO from '../components/SEO';
import { useBlogs, useBlogCategories } from '../hooks';
import './Blogs.css';

const PAGE_SIZE = 9;

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

const BlogSkeleton = () => (
    <article className="blog-card-full" style={{ opacity: 0.5 }}>
        <div className="blog-image-full" style={{ background: '#e5e7eb' }} />
        <div className="blog-content-full">
            <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '40%', marginBottom: 12 }} />
            <div style={{ height: 20, background: '#e5e7eb', borderRadius: 4, width: '80%', marginBottom: 12 }} />
            <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '100%', marginBottom: 6 }} />
            <div style={{ height: 14, background: '#e5e7eb', borderRadius: 4, width: '70%' }} />
        </div>
    </article>
);

// Articles come from the CMS — publishing one there puts it here with no code
// change. Search, category and page live in the URL so a filtered list can be
// linked and survives a refresh.
const Blogs = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(parseInt(searchParams.get('page'), 10) || 1, 1);
    const category = searchParams.get('category') || '';
    const urlSearch = searchParams.get('q') || '';

    const [searchInput, setSearchInput] = useState(urlSearch);

    // Debounced so a request is not fired per keystroke.
    useEffect(() => {
        const t = setTimeout(() => {
            if (searchInput === urlSearch) return;
            const next = new URLSearchParams(searchParams);
            searchInput ? next.set('q', searchInput) : next.delete('q');
            next.delete('page');
            setSearchParams(next, { replace: true });
        }, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    useEffect(() => { setSearchInput(urlSearch); }, [urlSearch]);

    const query = useMemo(() => ({
        page,
        limit: PAGE_SIZE,
        ...(urlSearch ? { search: urlSearch } : {}),
        ...(category ? { category } : {})
    }), [page, urlSearch, category]);

    const { data, loading, error, refetch } = useBlogs(query);
    const { data: categories } = useBlogCategories();

    const blogs = data?.data || [];
    const totalPages = data?.totalPages || 1;

    const setParam = (key, value) => {
        const next = new URLSearchParams(searchParams);
        value ? next.set(key, value) : next.delete(key);
        if (key !== 'page') next.delete('page');
        setSearchParams(next);
    };

    return (
        <div className="blogs-page">
            <SEO
                title="Learning Centre"
                description="Guides and updates on business loans, vehicle finance and loans against property from Surjit Finance."
            />

            {/* Hero */}
            <section className="blogs-hero">
                <div className="container">
                    <h1>Surjit Finance Learning Centre</h1>
                    <p>Stay updated about all the digital news</p>
                </div>
            </section>

            {/* Blog List */}
            <section className="blogs-list section">
                <div className="container">
                    <div className="blogs-toolbar">
                        <div className="blogs-search">
                            <Search size={16} />
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search articles…"
                                aria-label="Search articles"
                            />
                        </div>

                        {categories && categories.length > 0 && (
                            <div className="blogs-filters" role="group" aria-label="Filter by category">
                                <button
                                    type="button"
                                    className={`blogs-filter ${!category ? 'is-active' : ''}`}
                                    onClick={() => setParam('category', '')}
                                >
                                    All
                                </button>
                                {categories.map((c) => (
                                    <button
                                        key={c._id}
                                        type="button"
                                        className={`blogs-filter ${category === c._id ? 'is-active' : ''}`}
                                        onClick={() => setParam('category', c._id)}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="blogs-grid">
                        {loading
                            ? Array(3).fill(0).map((_, i) => <BlogSkeleton key={i} />)
                            : error
                                ? (
                                    <div className="blogs-empty">
                                        <p>Unable to load articles right now.</p>
                                        <button onClick={refetch} className="btn btn-secondary">
                                            <RefreshCw size={16} /> Retry
                                        </button>
                                    </div>
                                )
                                : blogs.length > 0
                                    ? blogs.map((blog) => (
                                        <article key={blog._id} className="blog-card-full">
                                            <div className="blog-image-full">
                                                {blog.featuredImage?.url && (
                                                    <img
                                                        src={blog.featuredImage.url}
                                                        alt={blog.title}
                                                        className="blog-image-full-img"
                                                        loading="lazy"
                                                    />
                                                )}
                                                {blog.category?.name && (
                                                    <span className="blog-category-tag">{blog.category.name}</span>
                                                )}
                                            </div>
                                            <div className="blog-content-full">
                                                <div className="blog-meta">
                                                    <span className="blog-date">
                                                        <Calendar size={14} />
                                                        {formatDate(blog.publishedAt || blog.createdAt)}
                                                    </span>
                                                    {blog.category?.name && (
                                                        <span className="blog-cat">
                                                            <Tag size={14} />
                                                            {blog.category.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <h2>{blog.title}</h2>
                                                <p>{blog.summary}</p>
                                                <Link to={`/blogs/${blog.slug}`} className="btn btn-primary">
                                                    Read more
                                                    <ArrowRight size={16} />
                                                </Link>
                                            </div>
                                        </article>
                                    ))
                                    : (
                                        <div className="blogs-empty">
                                            <p>
                                                {urlSearch || category
                                                    ? 'No articles match your search.'
                                                    : 'No articles published yet.'}
                                            </p>
                                        </div>
                                    )
                        }
                    </div>

                    {!loading && !error && totalPages > 1 && (
                        <nav className="blogs-pagination" aria-label="Blog pages">
                            <button
                                type="button"
                                className="blogs-page-btn"
                                disabled={page <= 1}
                                onClick={() => setParam('page', String(page - 1))}
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`blogs-page-btn ${n === page ? 'is-active' : ''}`}
                                    aria-current={n === page ? 'page' : undefined}
                                    onClick={() => setParam('page', String(n))}
                                >
                                    {n}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="blogs-page-btn"
                                disabled={page >= totalPages}
                                onClick={() => setParam('page', String(page + 1))}
                            >
                                Next
                            </button>
                        </nav>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Blogs;
