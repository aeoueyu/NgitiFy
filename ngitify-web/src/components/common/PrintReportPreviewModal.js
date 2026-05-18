import React, { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../styles/common/PrintReportPreviewModal.module.css';
import { buildPrintReportDocument } from '../../utils/exportHelpers';

export default function PrintReportPreviewModal({
    isOpen,
    reportConfig,
    onClose,
}) {
    const frameRef = useRef(null);
    const srcDoc = useMemo(() => (
        reportConfig ? buildPrintReportDocument(reportConfig) : ''
    ), [reportConfig]);

    if (!isOpen || !reportConfig || typeof document === 'undefined') {
        return null;
    }

    const handlePrint = () => {
        const frameWindow = frameRef.current?.contentWindow;
        if (!frameWindow) return;
        frameWindow.focus();
        frameWindow.print();
    };

    return createPortal(
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${reportConfig.title} preview`}>
            <div className={styles.backdrop} onClick={onClose} />
            <div className={styles.card}>
                <div className={styles.toolbar}>
                    <div>
                        <h2 className={styles.title}>Formal Report Preview</h2>
                        <p className={styles.subtitle}>Review the document, then print or choose Save as PDF in the browser dialog.</p>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className={styles.closeButton} onClick={onClose}>
                            Close
                        </button>
                        <button type="button" className={styles.printButton} onClick={handlePrint}>
                            Print
                        </button>
                    </div>
                </div>
                <div className={styles.previewFrameShell}>
                    <iframe
                        ref={frameRef}
                        title={`${reportConfig.title} preview`}
                        className={styles.previewFrame}
                        srcDoc={srcDoc}
                    />
                </div>
            </div>
        </div>,
        document.body,
    );
}
