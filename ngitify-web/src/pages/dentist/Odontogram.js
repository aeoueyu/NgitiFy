// ngitify-web/src/pages/dentist/Odontogram.js

import React, { useState, useEffect } from 'react';
import styles from '../../styles/dentist/Odontogram.module.css';
import { FaTooth } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';

// FDI Tooth Numbering Constants
const UPPER_RIGHT = [18,17,16,15,14,13,12,11];
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];

export default function Odontogram({ patientId }) {
    const { addToast } = useToast();

    // Core State Map: { toothNumber: 'statusString' }
    const [chartData, setChartData] = useState({});

    // Modal Interaction States
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempStatus, setTempStatus] = useState('healthy');
    const [isSaving, setIsSaving] = useState(false);

    // ✅ FIX Bug 24: Fetch real odontogram data from the API
    useEffect(() => {
        const fetchOdontogram = async () => {
            if (!patientId) return;
            try {
                const res = await authFetch(`/patients/${patientId}/odontogram`);
                if (res.ok) {
                    const data = await res.json();
                    setChartData(data);
                } else {
                    console.error('Failed to fetch odontogram data.');
                }
            } catch (e) {
                console.error('Error fetching odontogram:', e);
            }
        };
        fetchOdontogram();
    }, [patientId]);

    const getToothStatus = (num) => chartData[num] || 'healthy';

    const openToothModal = (num) => {
        setSelectedTooth(num);
        setTempStatus(getToothStatus(num));
    };

    // ✅ FIX Bug 24: PUT to real API instead of simulating with setTimeout
    const handleSaveStatus = async () => {
        if (!patientId) {
            addToast('No patient ID provided. Cannot save.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const res = await authFetch(`/patients/${patientId}/odontogram`, {
                method: 'PUT',
                body: JSON.stringify({ [selectedTooth]: tempStatus }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save.');

            setChartData(prev => ({ ...prev, [selectedTooth]: tempStatus }));
            addToast(`Tooth #${selectedTooth} successfully updated to ${tempStatus}.`, 'success');
            setSelectedTooth(null);
        } catch (e) {
            console.error('Odontogram save error:', e);
            addToast(e.message || 'Failed to save tooth status.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Render a row of teeth based on an array of numbers
    const renderToothRow = (teethArray, isUpper) => (
        <div className={styles.quadrant}>
            {teethArray.map(num => {
                const status = getToothStatus(num);
                return (
                    <div
                        key={num}
                        className={`${styles.toothContainer} ${styles[status]}`}
                        onClick={() => openToothModal(num)}
                        title={`Tooth ${num} - ${status.toUpperCase()}`}
                    >
                        {isUpper && <span className={styles.toothNum}>{num}</span>}
                        <div className={styles.toothGraphic}>
                            <FaTooth className={styles.toothIcon} />
                        </div>
                        {!isUpper && <span className={styles.toothNum}>{num}</span>}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className={styles.odontogramWrapper}>

            {/* UPPER JAW */}
            <div className={styles.jawSection}>
                <h4 className={styles.jawTitle}>Maxillary Arch (Upper)</h4>
                <div className={styles.arch}>
                    {renderToothRow(UPPER_RIGHT, true)}
                    <div className={styles.divider}></div>
                    {renderToothRow(UPPER_LEFT, true)}
                </div>
            </div>

            {/* LOWER JAW */}
            <div className={styles.jawSection}>
                <h4 className={styles.jawTitle}>Mandibular Arch (Lower)</h4>
                <div className={styles.arch}>
                    {renderToothRow(LOWER_RIGHT, false)}
                    <div className={styles.divider}></div>
                    {renderToothRow(LOWER_LEFT, false)}
                </div>
            </div>

            {/* CHART LEGEND */}
            <div className={styles.chartLegend}>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.healthy}`}></div> Healthy</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.filled}`}></div> Filled</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.decayed}`}></div> Caries / Decayed</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.crown}`}></div> Crown</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.missing}`}></div> Missing / Extracted</div>
            </div>

            {/* UPDATE TOOTH MODAL */}
            {selectedTooth && (
                <div className={styles.modalOverlay}>
                    <div className={styles.overlayBackground} onClick={() => setSelectedTooth(null)}></div>
                    <div className={styles.miniModalCard}>
                        <h3 className={styles.modalTitle}>Update Tooth #{selectedTooth}</h3>
                        <p className={styles.modalSubtitle}>Select the current clinical status.</p>

                        <div className={styles.statusOptionsGrid}>
                            <button
                                className={`${styles.statusBtn} ${tempStatus === 'healthy' ? styles.activeHealthy : ''}`}
                                onClick={() => setTempStatus('healthy')}
                            >
                                Healthy
                            </button>
                            <button
                                className={`${styles.statusBtn} ${tempStatus === 'filled' ? styles.activeFilled : ''}`}
                                onClick={() => setTempStatus('filled')}
                            >
                                Filled
                            </button>
                            <button
                                className={`${styles.statusBtn} ${tempStatus === 'decayed' ? styles.activeDecayed : ''}`}
                                onClick={() => setTempStatus('decayed')}
                            >
                                Caries / Decayed
                            </button>
                            <button
                                className={`${styles.statusBtn} ${tempStatus === 'crown' ? styles.activeCrown : ''}`}
                                onClick={() => setTempStatus('crown')}
                            >
                                Crown
                            </button>
                            <button
                                className={`${styles.statusBtn} ${tempStatus === 'missing' ? styles.activeMissing : ''}`}
                                style={{ gridColumn: 'span 2' }}
                                onClick={() => setTempStatus('missing')}
                            >
                                Missing / Extracted
                            </button>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} onClick={() => setSelectedTooth(null)} disabled={isSaving}>
                                Cancel
                            </button>
                            <button className={styles.submitBtn} onClick={handleSaveStatus} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}