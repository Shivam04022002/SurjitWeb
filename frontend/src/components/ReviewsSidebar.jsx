import { useState } from 'react';
import { Star, Quote, MapPin, ArrowRight, PenLine } from 'lucide-react';
import ReviewFormModal from './ReviewFormModal';
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

// Approved reviews, in the order set during moderation. Fetches a few more
// than it shows so "View more" can reveal them without a second request.
// The section renders even with no reviews, because it also carries the
// invitation for customers to write one.
const ReviewsSidebar = () => {
    const [expanded, setExpanded] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const { data: reviews, loading } = useReviews({ limit: 12 });

    const all = reviews || [];
    const shown = expanded ? all : all.slice(0, VISIBLE);
    const hasMore = all.length > VISIBLE;
    const isEmpty = !loading && all.length === 0;

    return (
        <aside className="reviews-sidebar" aria-label="Customer reviews">
            <div className="reviews-sidebar-inner">
                <div className="reviews-sidebar-header">
                    <h2>Customer Reviews</h2>
                    <p>{isEmpty ? 'Be the first to share your experience' : 'What our borrowers say'}</p>
                </div>

                {loading
                    ? Array(VISIBLE).fill(0).map((_, i) => <ReviewSkeleton key={i} />)
                    : shown.map((review) => (
                        <article key={review._id} className="review-card">
                            <Quote className="review-quote" size={28} aria-hidden="true" />

                            <div className="review-card-head">
                                {review.photo?.url ? (
                                    <img
                                        className="review-avatar"
                                        src={review.photo.url}
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

                            {(review.productName || review.city) && (
                                <div className="review-meta">
                                    {review.productName && (
                                        <span className="review-product">{review.productName}</span>
                                    )}
                                    {review.city && (
                                        <span className="review-location">
                                            <MapPin size={12} aria-hidden="true" />
                                            {review.city}
                                        </span>
                                    )}
                                </div>
                            )}
                        </article>
                    ))
                }

                {isEmpty && (
                    <p className="reviews-empty">No reviews yet — yours could be the first.</p>
                )}

                {!loading && hasMore && !expanded && (
                    <button type="button" className="reviews-more" onClick={() => setExpanded(true)}>
                        View More Reviews
                        <ArrowRight size={15} aria-hidden="true" />
                    </button>
                )}

                <button type="button" className="reviews-write" onClick={() => setFormOpen(true)}>
                    <PenLine size={15} aria-hidden="true" />
                    Write a Review
                </button>
            </div>

            <ReviewFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} />
        </aside>
    );
};

export default ReviewsSidebar;
