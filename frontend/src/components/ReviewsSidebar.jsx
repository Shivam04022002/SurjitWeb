import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Quote, MapPin, ArrowRight, PenLine } from 'lucide-react';
import ReviewFormModal from './ReviewFormModal';
import { getReviews } from '../services/api';
import { useReviews } from '../hooks';
import './ReviewsSidebar.css';

const VISIBLE = 3;
const PAGE_SIZE = 12;
// Guards the page walk against a runaway loop if a page ever comes back short
// of what `total` implies. 50 pages x 12 is far beyond any real article.
const MAX_PAGES = 50;

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

// Approved reviews for one article, in the order set during moderation. Fetches
// a few more than it shows so "View more" can reveal them without a second
// request. The section renders even with no reviews, because it also carries
// the invitation for customers to write one.
//
// blogId scopes both the request and the hook's cache key, which is what keeps
// the list correct when React Router swaps articles underneath this component
// without ever unmounting it.
const ReviewsSidebar = ({ blogId }) => {
    const [expanded, setExpanded] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [extraPages, setExtraPages] = useState([]);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState('');

    // Page 1 comes through the cached hook, so the cache key stays per-blog.
    // Later pages are fetched on demand and accumulated below.
    const { data, loading } = useReviews({ blogId, page: 1, limit: PAGE_SIZE });

    // The server reports how many approved reviews this article has; the length
    // of what is currently loaded would only ever describe the first page.
    const total = data?.total ?? data?.reviews?.length ?? 0;

    // Server order is authoritative — pages are appended in the order they were
    // requested and never re-sorted. The _id guard keeps a page that arrives
    // twice (retry, refetch) from duplicating cards.
    const all = useMemo(() => {
        const seen = new Set();
        return [...(data?.reviews || []), ...extraPages.flat()].filter((r) => {
            if (seen.has(r._id)) return false;
            seen.add(r._id);
            return true;
        });
    }, [data, extraPages]);

    // A different article means a different list: drop anything accumulated for
    // the previous one, since this component is never unmounted between blogs.
    useEffect(() => {
        setExtraPages([]);
        setExpanded(false);
        setLoadingMore(false);
        setLoadError('');
    }, [blogId]);

    const allLoaded = all.length >= total;

    // Walks the remaining pages one at a time, committing each as it lands so a
    // failure part-way keeps what already arrived instead of discarding it.
    const loadRemaining = useCallback(async () => {
        setLoadingMore(true);
        setLoadError('');
        let loaded = all.length;
        let page = Math.floor(loaded / PAGE_SIZE) + 1;
        try {
            while (loaded < total && page <= MAX_PAGES) {
                const res = await getReviews({ blogId, page, limit: PAGE_SIZE });
                const batch = res?.reviews || [];
                if (!batch.length) break;
                setExtraPages((prev) => [...prev, batch]);
                loaded += batch.length;
                page += 1;
            }
        } catch {
            setLoadError('Could not load the remaining reviews.');
        } finally {
            setLoadingMore(false);
        }
    }, [all.length, total, blogId]);

    const handleViewAll = () => {
        setExpanded(true);
        if (all.length < total) loadRemaining();
    };

    const shown = expanded ? all : all.slice(0, VISIBLE);
    const isEmpty = !loading && total === 0;

    return (
        <aside className="reviews-sidebar" aria-label="Customer reviews">
            <div className="reviews-sidebar-inner">
                <div className="reviews-sidebar-header">
                    <h2>
                        Customer Reviews{' '}
                        {total > 0 && <span className="reviews-count">({total})</span>}
                    </h2>
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

                {loadingMore && (
                    <p className="reviews-loading-more">Loading more reviews…</p>
                )}

                {loadError && (
                    <div className="reviews-load-error">
                        <span>{loadError}</span>
                        <button type="button" className="reviews-more" onClick={loadRemaining}>
                            Try Again
                        </button>
                    </div>
                )}

                {/* Collapsed with more to come: offer the full list. Expanded but
                    still short of `total` means a page failed, and the retry above
                    owns that case rather than this button. */}
                {!loading && !expanded && total > VISIBLE && (
                    <button type="button" className="reviews-more" onClick={handleViewAll}>
                        View All Reviews
                        <ArrowRight size={15} aria-hidden="true" />
                    </button>
                )}

                {/* Expanded but short of `total` with nothing in flight: a page
                    walk stopped early. Offer to continue rather than dead-end. */}
                {!loading && expanded && !allLoaded && !loadingMore && !loadError && (
                    <button type="button" className="reviews-more" onClick={loadRemaining}>
                        Load More Reviews
                        <ArrowRight size={15} aria-hidden="true" />
                    </button>
                )}

                {!loading && expanded && allLoaded && total > VISIBLE && (
                    <button type="button" className="reviews-more" onClick={() => setExpanded(false)}>
                        Show Less
                    </button>
                )}

                <button type="button" className="reviews-write" onClick={() => setFormOpen(true)}>
                    <PenLine size={15} aria-hidden="true" />
                    Write a Review
                </button>
            </div>

            <ReviewFormModal isOpen={formOpen} onClose={() => setFormOpen(false)} blogId={blogId} />
        </aside>
    );
};

export default ReviewsSidebar;
