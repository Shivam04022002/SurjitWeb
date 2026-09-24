import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getAdvertisement } from '../services/api';
import {
    displayableAdvertisement, isInternalApplyUrl,
    hasSeenAdvertisement, markAdvertisementSeen
} from './advertisementModel';
import './AdvertisementPopup.css';

// The published advertisement, shown once the site has loaded.
//
// It is optional content: the request is made after mount and nothing waits
// for it, so a slow, failing or empty response leaves the website exactly as
// it is. Nothing is rendered until an advertisement arrives that the popup can
// actually display — there is no empty or loading popup.
//
// Each advertisement is shown at most once per browser session: an
// advertisement the visitor has already been shown is not fetched into view
// again while the tab is open, and a newly published one still appears,
// because what is remembered is that advertisement's own id.
const AdvertisementPopup = () => {
    const navigate = useNavigate();
    const [advertisement, setAdvertisement] = useState(null);
    const [closed, setClosed] = useState(false);
    const dialogRef = useRef(null);
    const closeRef = useRef(null);

    useEffect(() => {
        let active = true;

        getAdvertisement()
            .then((data) => {
                // Validated rather than trusted: a response that is not the
                // shape the popup renders counts as no advertisement.
                const usable = displayableAdvertisement(data);
                // Already shown in this session, so it stays away until the
                // next one — or until a different advertisement is published.
                if (active) setAdvertisement(usable && !hasSeenAdvertisement(usable.id) ? usable : null);
            })
            .catch((error) => {
                // The api client already logs the failure. Visitors never see
                // an advertisement error — they just see the website.
                if (active) setAdvertisement(null);
                void error;
            });

        return () => { active = false; };
    }, []);

    // Dismissed by the visitor — the close button, Escape, the backdrop or
    // Apply. The advertisement has been on screen by this point, so it counts
    // as seen whichever way it goes away.
    const close = useCallback(() => {
        if (advertisement) markAdvertisementSeen(advertisement.id);
        setClosed(true);
    }, [advertisement]);

    // The artwork never arrived, so nothing was shown: the popup goes without
    // consuming the visitor's one showing of this advertisement.
    const dismissBroken = useCallback(() => setClosed(true), []);

    // Shown is the moment the artwork is on screen, which is what the session
    // slot is spent on — not the request, and not a response that turned out
    // to be unusable.
    const onImageLoad = useCallback(() => {
        if (advertisement) markAdvertisementSeen(advertisement.id);
    }, [advertisement]);

    const open = !!advertisement && !closed;

    // Escape closes, and the page behind must not scroll while the popup is
    // up — the same pattern the site's other modals use. The previous value is
    // restored on close and on unmount, so the document is never left altered.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open, close]);

    // Focus starts on the close button, so the popup can be dismissed from the
    // keyboard immediately and a screen reader announces the dialog.
    useEffect(() => {
        if (open) closeRef.current?.focus();
    }, [open]);

    // Tab cycles within the popup while it is open, and never strands focus
    // behind the overlay. There are only a few controls, so this stays simple
    // rather than pulling in a focus-trap library the site does not use.
    const onKeyDownTrap = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = dialogRef.current?.querySelectorAll('button, [href], img[tabindex]');
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    if (!open) return null;

    // A button rather than a link, deliberately: the site counts CTA clicks
    // from link destinations (utils/analytics.js), and an advertisement must
    // not add to those counts. This phase reports nothing about the popup.
    const onApply = () => {
        const { applyUrl } = advertisement;
        close();
        if (isInternalApplyUrl(applyUrl)) {
            navigate(applyUrl);
        } else {
            // Validated as http(s) before the popup rendered; opened without
            // handing the new tab a reference back to this one.
            window.open(applyUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="ad-popup-overlay" onClick={close}>
            <div
                className="ad-popup"
                role="dialog"
                aria-modal="true"
                aria-label={advertisement.name}
                ref={dialogRef}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={onKeyDownTrap}
            >
                {/* Its own row rather than an overlay on the artwork: an
                    advertisement is designed edge to edge, and a floating
                    button would sit on top of whatever the corner carries. */}
                <div className="ad-popup-head">
                    <button
                        className="ad-popup-close"
                        onClick={close}
                        aria-label="Close advertisement"
                        ref={closeRef}
                        type="button"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>

                <div className="ad-popup-image-wrap">
                    <img
                        className="ad-popup-image"
                        src={advertisement.imageUrl}
                        alt={advertisement.name}
                        onLoad={onImageLoad}
                        // An image that fails to load would leave an empty
                        // frame, so the popup goes rather than showing one —
                        // and is not counted as seen.
                        onError={dismissBroken}
                    />
                </div>

                <button className="btn btn-primary ad-popup-apply" onClick={onApply} type="button">
                    {advertisement.applyButtonText}
                </button>
            </div>
        </div>
    );
};

export default AdvertisementPopup;
