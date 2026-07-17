import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import { blogs } from '../data/blogs';
import './BlogDetail.css';

const BlogDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const blog = blogs.find(b => b.id === id);

    if (!blog) {
        return (
            <div className="blog-detail-not-found">
                <div className="container">
                    <h2>Blog Post Not Found</h2>
                    <p>The article you're looking for doesn't exist or has been removed.</p>
                    <Link to="/blogs" className="btn btn-primary">Back to Blogs</Link>
                </div>
            </div>
        );
    }

    // A simple function to render the markdown-like content safely
    const renderContent = (content) => {
        return content.split('\n\n').map((paragraph, index) => {
            // Check if it's a list item
            if (paragraph.startsWith('- ') || /^\d+\.\s/.test(paragraph)) {
                const items = paragraph.split('\n');
                const isOrdered = /^\d+\.\s/.test(items[0]);
                
                const listItems = items.map((item, i) => {
                    const cleanItem = item.replace(/^(- |\d+\.\s)/, '');
                    const formattedItem = formatBoldText(cleanItem);
                    return <li key={i} dangerouslySetInnerHTML={{ __html: formattedItem }} />;
                });

                return isOrdered 
                    ? <ol key={index}>{listItems}</ol> 
                    : <ul key={index}>{listItems}</ul>;
            }

            // Normal paragraph
            return <p key={index} dangerouslySetInnerHTML={{ __html: formatBoldText(paragraph) }} />;
        });
    };

    const formatBoldText = (text) => {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    };

    return (
        <div className="blog-detail-page">
            <div className="container">
                <div className="blog-detail-header">
                    <button onClick={() => navigate('/blogs')} className="btn-back">
                        <ArrowLeft size={18} /> Back to Blogs
                    </button>
                    <div className="blog-detail-meta">
                        <span><Calendar size={16} /> {blog.date}</span>
                        <span><User size={16} /> Written by {blog.author || 'admin'}</span>
                        <span className="category-pill"><Tag size={16} /> {blog.category}</span>
                    </div>
                    <h1>{blog.title}</h1>
                </div>

                {blog.image && (
                    <div className="blog-detail-image">
                        <img src={blog.image} alt={blog.title} />
                    </div>
                )}

                <div className="blog-detail-content">
                    {renderContent(blog.content)}
                </div>
                
                <div className="blog-detail-footer">
                    <button onClick={() => navigate('/blogs')} className="btn btn-secondary">
                        <ArrowLeft size={18} /> Back to all articles
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BlogDetail;
