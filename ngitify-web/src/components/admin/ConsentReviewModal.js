import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './ConsentReviewModal.module.css';
import { consentSectionsEnglish, consentSectionsTagalog } from '../../data/consentDocument';

export default function ConsentReviewModal({ isOpen, onClose, onConfirm, initiallyAcknowledged = false }) {
    const scrollRef = useRef(null);
    const [hasReachedEnd, setHasReachedEnd] = useState(false);
    const [isChecked, setIsChecked] = useState(initiallyAcknowledged);

    const allSections = useMemo(() => ([
        { heading: 'English Version', sections: consentSectionsEnglish },
        { heading: 'Tagalog Version', sections: consentSectionsTagalog },
    ]), []);

    useEffect(() => {
        if (!isOpen) return;
        setIsChecked(initiallyAcknowledged);
        setHasReachedEnd(Boolean(initiallyAcknowledged));
        const frame = requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
        });
        return () => cancelAnimationFrame(frame);
    }, [initiallyAcknowledged, isOpen]);

    const handleScroll = () => {
        if (!scrollRef.current || hasReachedEnd) return;
        const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 12) {
            setHasReachedEnd(true);
        }
    };

    const handleConfirm = () => {
        if (!hasReachedEnd || !isChecked) return;
        onConfirm(true);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Consent Form Review</h3>
                    <p className={styles.subtitle}>
                        Please review the full English and Tagalog consent forms. The acknowledgement checkbox
                        will only be enabled after scrolling through the entire document.
                    </p>
                </div>

                <div className={styles.body} ref={scrollRef} onScroll={handleScroll}>
                    {allSections.map((language) => (
                        <section key={language.heading} className={styles.languageBlock}>
                            <h4 className={styles.languageHeading}>{language.heading}</h4>
                            {language.sections.map((section) => (
                                <article key={`${language.heading}-${section.heading}`} className={styles.sectionCard}>
                                    <h5 className={styles.sectionTitle}>{section.heading}</h5>
                                    <p className={styles.sectionBody}>{section.body}</p>
                                </article>
                            ))}
                        </section>
                    ))}
                </div>

                <div className={styles.footer}>
                    {!hasReachedEnd ? (
                        <p className={styles.scrollPrompt}>Scroll to the end of the consent form to enable acknowledgement.</p>
                    ) : (
                        <p className={styles.scrollDone}>Full consent reviewed. You may now record the acknowledgement.</p>
                    )}

                    <label className={styles.checkboxRow}>
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => setIsChecked(event.target.checked)}
                            disabled={!hasReachedEnd}
                        />
                        <span>I acknowledge that the patient or authorized representative has reviewed the full consent form.</span>
                    </label>

                    <div className={styles.actions}>
                        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Close</button>
                        <button type="button" className={styles.primaryBtn} onClick={handleConfirm} disabled={!hasReachedEnd || !isChecked}>
                            Save Consent Acknowledgement
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
