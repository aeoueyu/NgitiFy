import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../styles/admin/SystemConfig.module.css';
import { WEBSITE_PREVIEW_MESSAGE } from '../../pages/website/WebsitePreview';

const PREVIEW_PAGES = [
    { key: 'home', label: 'Home' },
    { key: 'about', label: 'About + Locations' },
    { key: 'services', label: 'Services' },
    { key: 'contact', label: 'Contact' },
    { key: 'appointment', label: 'Appointment' },
];

const VIEWPORTS = [
    { key: 'desktop', label: 'Desktop', width: '100%' },
    { key: 'tablet', label: 'Tablet', width: '768px' },
    { key: 'mobile', label: 'Mobile', width: '390px' },
];

export default function WebsitePreviewModal({ initialPage, publicConfig, onClose }) {
    const iframeRef = useRef(null);
    const [page, setPage] = useState(initialPage || 'home');
    const [viewport, setViewport] = useState('desktop');
    const selectedViewport = VIEWPORTS.find((entry) => entry.key === viewport) || VIEWPORTS[0];

    const sendPreview = useCallback(() => {
        iframeRef.current?.contentWindow?.postMessage({
            type: WEBSITE_PREVIEW_MESSAGE,
            payload: { page, publicConfig },
        }, window.location.origin);
    }, [page, publicConfig]);

    useEffect(() => {
        const handleReady = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === `${WEBSITE_PREVIEW_MESSAGE}:ready`) sendPreview();
        };
        window.addEventListener('message', handleReady);
        return () => window.removeEventListener('message', handleReady);
    }, [sendPreview]);

    useEffect(() => {
        sendPreview();
    }, [sendPreview]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <div className={styles.websitePreviewOverlay} role="dialog" aria-modal="true" aria-label="Website page preview">
            <header className={styles.websitePreviewToolbar}>
                <div className={styles.websitePreviewHeading}>
                    <strong>Website Preview</strong>
                    <span>Unsaved edits are shown here.</span>
                </div>

                <nav className={styles.websitePreviewPages} aria-label="Preview page">
                    {PREVIEW_PAGES.map((entry) => (
                        <button
                            key={entry.key}
                            type="button"
                            className={`${styles.websitePreviewChip} ${page === entry.key ? styles.websitePreviewChipActive : ''}`}
                            onClick={() => setPage(entry.key)}
                        >
                            {entry.label}
                        </button>
                    ))}
                </nav>

                <div className={styles.websitePreviewActions}>
                    <div className={styles.websitePreviewViewports} aria-label="Preview size">
                        {VIEWPORTS.map((entry) => (
                            <button
                                key={entry.key}
                                type="button"
                                className={`${styles.websitePreviewViewportBtn} ${viewport === entry.key ? styles.websitePreviewViewportBtnActive : ''}`}
                                onClick={() => setViewport(entry.key)}
                            >
                                {entry.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className={styles.websitePreviewCloseBtn} onClick={onClose} aria-label="Close website preview">
                        Close
                    </button>
                </div>
            </header>

            <div className={styles.websitePreviewStage}>
                <iframe
                    ref={iframeRef}
                    src="/?website-preview=1"
                    title={`${page} page preview`}
                    className={styles.websitePreviewFrame}
                    style={{ width: selectedViewport.width }}
                    onLoad={sendPreview}
                />
            </div>
        </div>,
        document.body
    );
}
