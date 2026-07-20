import { useState } from 'react';
import { Star, Quote, MapPin, ArrowRight } from 'lucide-react';
import { useReviews } from '../hooks';
import './ReviewsSidebar.css';

const VISIBLE = 3;

const initialsOf = (name) => String(name || '?').trim().charAt(0).toUpperCase();

const Stars = ({ rating }) => (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
            <Star
                key={n}
                size={14}
                aria-hidden="true"
                className={n <= rating ? 'is-filled' : ''}
            />
        ))}
    </span>
);

const ReviewSkeleton = () => (
    <div className="review-card" style={{ opacity: 0.5 }}>
        <div className="review-card-head">
            <div className="review-avatar" style={{ background: '#e5e7eb' }} />
            <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '60%', marginBottom: 6 }} />
                <div style={{ height: 10, background: '#e5e7eb', borderRadius: 4, width: '40%' }} />
            </div>
        </div>
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '100%', marginTop: 12 }} />
        <div style={{ height: 12, background: '#e5e7eb', borderRadius: 4, width: '80%', marginTop: 6 }} />
    </div>
);

// Published reviews from the CMS, in the order set there. Fetches a few more
// than it shows so "View more" can reveal them without a second request.
const ReviewsSidebar = () => {
    const [expanded, setExpanded] = useState(false);
    const { data: reviews, loading } = useReviews({ limit: 12 });

    if (!loading && (!reviews || reviews.length === 0)) return null;

    const shown = expanded ? reviews : (reviews || []).slice(0, VISIBLE);
    const hasMore = (reviews || []).length > VISIBLE;

    return (
        <aside className="reviews-sidebar" aria-label="Customer reviews">
            <div className="reviews-sidebar-inner">
                <div className="reviews-sidebar-header">
                    <h2>Customer Reviews</h2>
                    <p>What our borrowers say</p>
                </div>

                {loading
                    ? Array(VISIBLE).fill(0).map((_, i) => <ReviewSkeleton key={i} />)
                    : shown.map((review) => (
                        <article key={review._id} className="review-card">
                            <Quote className="review-quote" size={28} aria-hidden="true" />

                            <div className="review-card-head">
                                {review.customerImage?.url ? (
                                    <img
                                        className="review-avatar"
                                        src={review.customerImage.url}
                                        alt={review.customerName}
                                        loading="lazy"
                                    />
                                ) : (
                                    <span className="review-avatar review-avatar-initials" aria-hidden="true">
                                        {initialsOf(review.customerName)}
                                    </span>
                                )}
                                <div className="review-identity">
                                    <span className="review-name">{review.customerName}</span>
                                    <Stars rating={review.rating} />
                                </div>
                            </div>

                            <p className="review-text">&ldquo;{review.review}&rdquo;</p>

                            {(review.productName || review.location) && (
                                <div className="review-meta">
                                    {review.productName && (
                                        <span className="review-product">{review.productName}</span>
                                    )}
                                    {review.location && (
                                        <span className="review-location">
                                            <MapPin size={12} aria-hidden="true" />
                                            {review.location}
                                        </span>
                                    )}
                                </div>
                            )}
                        </article>
                    ))
                }

                {!loading && hasMore && !expanded && (
                    <button type="button" className="reviews-more" onClick={() => setExpanded(true)}>
                        View More Reviews
                        <ArrowRight size={15} aria-hidden="true" />
                    </button>
                )}
            </div>
        </aside>
    );
};

export default ReviewsSidebar;
