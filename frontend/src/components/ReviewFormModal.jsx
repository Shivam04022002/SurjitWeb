import { useEffect, useRef, useState } from 'react';
import { X, Star, Upload, CheckCircle2 } from 'lucide-react';
import { submitReview } from '../services/api';
import './ReviewFormModal.css';

const EMPTY = {
    customerName: '', mobile: '', email: '', city: '', productName: '', rating: 5, review: ''
};

const MAX_PHOTO = 10 * 1024 * 1024;

// Submissions are held for moderation, so the form promises verification
// rather than immediate publication.
const ReviewFormModal = ({ isOpen, onClose }) => {
    const [form, setForm] = useState(EMPTY);
    const [photo, setPhoto] = useState(null);
    const [photoName, setPhotoName] = useState('');
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [serverError, setServerError] = useState('');
    const fileRef = useRef(null);
    const dialogRef = useRef(null);

    // Reset whenever the modal is reopened, so a previous submission's
    // thank-you or errors never greet the next visitor.
    useEffect(() => {
        if (!isOpen) return;
        setForm(EMPTY); setPhoto(null); setPhotoName('');
        setErrors({}); setDone(false); setServerError('');
    }, [isOpen]);

    // Escape closes, and the page behind must not scroll while the modal is up.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const setField = (name, value) => {
        setForm((f) => ({ ...f, [name]: value }));
        setErrors((e) => ({ ...e, [name]: '' }));
    };

    const handlePhoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors((x) => ({ ...x, photo: 'Please choose an image file' }));
            return;
        }
        if (file.size > MAX_PHOTO) {
            setErrors((x) => ({ ...x, photo: 'Image must be under 10 MB' }));
            return;
        }
        setPhoto(file);
        setPhotoName(file.name);
        setErrors((x) => ({ ...x, photo: '' }));
    };

    // Mirrors the server rules so a visitor is corrected before a round trip.
    const validate = () => {
        const e = {};
        if (!form.customerName.trim()) e.customerName = 'Please enter your name';
        if (!form.mobile.trim()) e.mobile = 'Please enter your mobile number';
        else if (!/^[0-9+\-\s()]{7,20}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid mobile number';
        if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
        if (!form.review.trim()) e.review = 'Please write your review';
        else if (form.review.trim().length < 10) e.review = 'Please write at least 10 characters';
        if (!form.rating || form.rating < 1 || form.rating > 5) e.rating = 'Please choose a rating';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setServerError('');
        if (!validate()) return;

        setSubmitting(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
            if (photo) fd.append('photo', photo);
            await submitReview(fd);
            setDone(true);
        } catch (err) {
            const res = err?.response?.data;
            // Field errors from express-validator, otherwise the message.
            if (res?.errors?.length) {
                const mapped = {};
                res.errors.forEach((x) => { if (x.field) mapped[x.field] = x.message; });
                setErrors(mapped);
                setServerError(Object.keys(mapped).length ? '' : (res.message || 'Please check the form.'));
            } else {
                setServerError(res?.message || 'Could not submit your review. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="review-modal-overlay" onClick={onClose}>
            <div
                className="review-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="review-modal-title"
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
            >
                <button className="review-modal-close" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>

                {done ? (
                    <div className="review-thanks">
                        <CheckCircle2 size={48} className="review-thanks-icon" aria-hidden="true" />
                        <h2 id="review-modal-title">Thank you for your feedback.</h2>
                        <p>Your review will be published after verification.</p>
                        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
                    </div>
                ) : (
                    <>
                        <div className="review-modal-header">
                            <h2 id="review-modal-title">Write a Review</h2>
                            <p>Tell us about your experience with Surjit Finance</p>
                        </div>

                        <form className="review-form" onSubmit={handleSubmit} noValidate>
                            <div className="review-field">
                                <label htmlFor="rv-name">Your Name <span aria-hidden="true">*</span></label>
                                <input
                                    id="rv-name" type="text" value={form.customerName} maxLength={120}
                                    onChange={(e) => setField('customerName', e.target.value)}
                                    aria-invalid={!!errors.customerName}
                                />
                                {errors.customerName && <span className="review-error">{errors.customerName}</span>}
                            </div>

                            <div className="review-row">
                                <div className="review-field">
                                    <label htmlFor="rv-mobile">Mobile Number <span aria-hidden="true">*</span></label>
                                    <input
                                        id="rv-mobile" type="tel" value={form.mobile} maxLength={20}
                                        onChange={(e) => setField('mobile', e.target.value)}
                                        aria-invalid={!!errors.mobile}
                                    />
                                    {errors.mobile && <span className="review-error">{errors.mobile}</span>}
                                </div>
                                <div className="review-field">
                                    <label htmlFor="rv-email">Email <span className="review-optional">(optional)</span></label>
                                    <input
                                        id="rv-email" type="email" value={form.email} maxLength={160}
                                        onChange={(e) => setField('email', e.target.value)}
                                        aria-invalid={!!errors.email}
                                    />
                                    {errors.email && <span className="review-error">{errors.email}</span>}
                                </div>
                            </div>

                            <div className="review-row">
                                <div className="review-field">
                                    <label htmlFor="rv-city">City</label>
                                    <input
                                        id="rv-city" type="text" value={form.city} maxLength={120}
                                        onChange={(e) => setField('city', e.target.value)}
                                    />
                                </div>
                                <div className="review-field">
                                    <label htmlFor="rv-product">Product Used</label>
                                    <input
                                        id="rv-product" type="text" value={form.productName} maxLength={150}
                                        placeholder="e.g. Business Loan"
                                        onChange={(e) => setField('productName', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="review-field">
                                <span className="review-label">Rating <span aria-hidden="true">*</span></span>
                                <div className="review-rating" role="radiogroup" aria-label="Rating">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            className={`review-star ${n <= form.rating ? 'is-filled' : ''}`}
                                            onClick={() => setField('rating', n)}
                                            role="radio"
                                            aria-checked={form.rating === n}
                                            aria-label={`${n} star${n > 1 ? 's' : ''}`}
                                        >
                                            <Star size={26} />
                                        </button>
                                    ))}
                                </div>
                                {errors.rating && <span className="review-error">{errors.rating}</span>}
                            </div>

                            <div className="review-field">
                                <label htmlFor="rv-text">Your Review <span aria-hidden="true">*</span></label>
                                <textarea
                                    id="rv-text" rows={4} value={form.review} maxLength={1000}
                                    onChange={(e) => setField('review', e.target.value)}
                                    aria-invalid={!!errors.review}
                                />
                                <span className="review-count">{form.review.length}/1000</span>
                                {errors.review && <span className="review-error">{errors.review}</span>}
                            </div>

                            <div className="review-field">
                                <span className="review-label">Your Photo <span className="review-optional">(optional)</span></span>
                                <button type="button" className="review-upload" onClick={() => fileRef.current?.click()}>
                                    <Upload size={16} />
                                    {photoName || 'Choose a photo'}
                                </button>
                                <input
                                    ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto}
                                />
                                {errors.photo && <span className="review-error">{errors.photo}</span>}
                            </div>

                            {serverError && <div className="review-server-error">{serverError}</div>}

                            <div className="review-actions">
                                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Submitting…' : 'Submit Review'}
                                </button>
                            </div>

                            <p className="review-note">
                                Reviews are published after verification by our team.
                            </p>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReviewFormModal;
