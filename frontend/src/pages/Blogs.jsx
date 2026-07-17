import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Tag } from 'lucide-react';
import { blogs } from '../data/blogs';
import './Blogs.css';

const Blogs = () => {
    return (
        <div className="blogs-page">
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
                    <div className="blogs-grid">
                        {blogs.map((blog) => (
                            <article key={blog.id} className="blog-card-full">
                                <div className="blog-image-full">
                                    {blog.image && <img src={blog.image} alt={blog.title} className="blog-image-full-img" />}
                                    <span className="blog-category-tag">{blog.category}</span>
                                </div>
                                <div className="blog-content-full">
                                    <div className="blog-meta">
                                        <span className="blog-date">
                                            <Calendar size={14} />
                                            {blog.date}
                                        </span>
                                        <span className="blog-cat">
                                            <Tag size={14} />
                                            {blog.category}
                                        </span>
                                    </div>
                                    <h2>{blog.title}</h2>
                                    <p>{blog.excerpt}</p>
                                    <Link to={`/blogs/${blog.id}`} className="btn btn-primary">
                                        Read more
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Blogs;
