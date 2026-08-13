import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';
import { authFetch } from '../../utils/api';
import {
    PatientPageFrame,
    PatientSectionHeader,
} from '../../components/patient/PatientFrame';
import PatientIcon from '../../components/patient/PatientIcon';
import styles from '../../styles/patient/PatientPortal.module.css';

function useVisitPrediction() {
    const [visitPrediction, setVisitPrediction] = useState(null);

    React.useEffect(() => {
        let isMounted = true;
        const fetchPrediction = async () => {
            try {
                const response = await authFetch('/my/visit-prediction');
                if (!response.ok) return;
                const payload = await response.json();
                if (isMounted) {
                    setVisitPrediction(payload?.prediction || null);
                }
            } catch {
                if (isMounted) {
                    setVisitPrediction(null);
                }
            }
        };

        fetchPrediction();
        return () => {
            isMounted = false;
        };
    }, []);

    return visitPrediction;
}

const toDateKey = (value = new Date()) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function PatientOralCare() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { addToast } = useToast();
    const visitPrediction = useVisitPrediction();
    const [oralHealth, setOralHealth] = useState(null);
    const [oralHealthError, setOralHealthError] = useState('');
    const [saving, setSaving] = useState(false);
    const preview = useMemo(() => getStaticOralCarePreview(visitPrediction, oralHealth), [visitPrediction, oralHealth]);
    const [factors, setFactors] = useState(preview.factors);
    const [logGroups, setLogGroups] = useState(preview.logGroups);
    const [logNotes, setLogNotes] = useState('');
    const [factorModalOpen, setFactorModalOpen] = useState(false);
    const [logModalOpen, setLogModalOpen] = useState(false);

    React.useEffect(() => {
        setFactors(preview.factors);
        setLogGroups(preview.logGroups);
        setLogNotes(oralHealth?.logs?.[0]?.logDateKey === toDateKey() ? oralHealth.logs[0]?.notes || '' : '');
    }, [preview, oralHealth]);

    React.useEffect(() => {
        let isMounted = true;
        const fetchOralHealth = async () => {
            try {
                const response = await authFetch('/my/oral-health');
                const payload = await response.json().catch(() => ({}));
                if (!isMounted) return;
                if (!response.ok) {
                    setOralHealthError(payload.message || 'Could not load oral health data.');
                    return;
                }
                setOralHealth(payload);
                setOralHealthError('');
            } catch {
                if (isMounted) {
                    setOralHealthError('Unable to connect to the oral health service.');
                }
            }
        };

        fetchOralHealth();
        return () => {
            isMounted = false;
        };
    }, []);

    const activeFactors = factors.filter((item) => item.active && item.id !== 'none');
    const selectedLogItems = logGroups.flatMap((group) => group.items.filter((item) => item.selected));

    const toggleFactor = (factorId) => {
        setFactors((current) => {
            if (factorId === 'none') {
                return current.map((item) => ({ ...item, active: item.id === 'none' }));
            }
            const next = current.map((item) => (
                item.id === factorId
                    ? { ...item, active: !item.active }
                    : (item.id === 'none' ? { ...item, active: false } : item)
            ));
            const hasActiveFactor = next.some((item) => item.id !== 'none' && item.active);
            return next.map((item) => (
                item.id === 'none' ? { ...item, active: !hasActiveFactor && item.active } : item
            ));
        });
    };

    const toggleLogItem = (groupId, itemId) => {
        setLogGroups((current) => current.map((group) => (
            group.id !== groupId
                ? group
                : {
                    ...group,
                    items: group.items.map((item) => (
                        item.id === itemId ? { ...item, selected: !item.selected } : item
                    )),
                }
        )));
    };

    const saveFactors = async () => {
        setSaving(true);
        try {
            const response = await authFetch('/my/oral-health/factors', {
                method: 'PATCH',
                body: JSON.stringify({ factors: factors.filter((item) => item.active).map((item) => item.id) }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Failed to save oral health factors.');
            setOralHealth(payload);
            setFactorModalOpen(false);
            addToast(payload.message || 'Oral health factors saved.', 'success');
        } catch (error) {
            addToast(error.message || 'Failed to save oral health factors.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveDailyLog = async () => {
        const symptoms = logGroups.find((group) => group.id === 'symptoms')?.items.filter((item) => item.selected).map((item) => item.id) || [];
        const dailyCare = logGroups.find((group) => group.id === 'dailyCare')?.items.filter((item) => item.selected).map((item) => item.id) || [];

        setSaving(true);
        try {
            const response = await authFetch('/my/oral-health/logs', {
                method: 'POST',
                body: JSON.stringify({ logDate: toDateKey(), symptoms, dailyCare, notes: logNotes }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.message || 'Failed to save daily oral health log.');
            setOralHealth(payload);
            setLogModalOpen(false);
            addToast(payload.message || 'Daily oral health log saved.', 'success');
        } catch (error) {
            addToast(error.message || 'Failed to save daily oral health log.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <PatientPageFrame
            title="Oral Health Management"
            subtitle={`Today, trends, recommended visit windows, and Dental Health Education for ${user?.assignedBranch || 'your assigned branch'}.`}
            actions={(
                <>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/ai-companion?tab=visit-window')}>
                        Open AI Companion
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/book')}>
                        Book Preventive Visit
                    </button>
                </>
            )}
        >
            <div className={styles.heroGrid}>
                <section className={styles.heroCard}>
                    <span className={styles.heroEyebrow}>{preview.hero.eyebrow}</span>
                    <h2 className={styles.heroTitle} style={{ color: '#17364a' }}>{preview.hero.title}</h2>
                    <p className={styles.heroText} style={{ color: '#17364a', fontWeight: 700 }}>{preview.hero.headline}</p>
                    <p className={styles.heroText} style={{ color: '#5f7a8d' }}>{preview.hero.whyThisShowing}</p>
                    <div className={styles.detailPills}>
                        <span className={styles.detailPill}>{preview.hero.statusLabel}</span>
                        <span className={styles.detailPill}>Recommended: {preview.hero.recommendedDateLabel}</span>
                        {oralHealth?.summary?.lastLogDateKey ? <span className={styles.detailPill}>Last log: {oralHealth.summary.lastLogDateKey}</span> : null}
                    </div>
                    {oralHealthError ? <div className={styles.noticeBox}>{oralHealthError}</div> : null}
                    <div className={styles.heroActions}>
                        <button type="button" className={styles.buttonSecondary} onClick={() => setFactorModalOpen(true)}>
                            Review Factors
                        </button>
                        <button type="button" className={styles.buttonGhost} onClick={() => setLogModalOpen(true)}>
                            Open Quick Log
                        </button>
                    </div>
                </section>
                <section className={`${styles.heroCard} ${styles.heroCardDark}`}>
                    <span className={styles.heroTag}>Preview</span>
                    <h2 className={styles.heroTitle}>What this screen helps with</h2>
                    <p className={styles.heroText}>
                        Dentime explains your next preventive care window using clinic-recorded treatment history plus watch signals and at-home care reminders, instead of an invented diagnosis.
                    </p>
                </section>
            </div>

            <section style={{ marginBottom: '24px' }}>
                <PatientSectionHeader
                    eyebrow="Watch Signals"
                    title="What needs attention"
                />
                <div className={styles.toolGrid}>
                    {preview.watchSignals.map((signal) => (
                        <article key={signal.id} className={styles.toolCard}>
                            <span className={styles.toolIcon}>
                                <PatientIcon name={signal.icon} color={signal.iconColor} />
                            </span>
                            <h3 className={styles.toolTitle}>{signal.title}</h3>
                            <p className={styles.toolText}>{signal.summary}</p>
                            <div className={styles.noticeBox}>{signal.action}</div>
                        </article>
                    ))}
                </div>
            </section>

            <section className={styles.splitGrid}>
                <div>
                    <PatientSectionHeader
                        eyebrow="Oral Health Management"
                        title="Dental-specific multi-select factors"
                        action={(
                            <button type="button" className={styles.buttonGhost} onClick={() => setFactorModalOpen(true)}>
                                Open
                            </button>
                        )}
                    />
                    <article className={styles.summaryCard}>
                        <p className={styles.toolText}>
                            Saved factors help personalize watch signals without changing your clinical record.
                        </p>
                        <div className={styles.detailPills}>
                            {(activeFactors.length ? activeFactors : factors.filter((item) => item.id === 'none')).map((item) => (
                                <span key={item.id} className={styles.detailPill}>{item.label}</span>
                            ))}
                        </div>
                    </article>
                </div>
                <div>
                    <PatientSectionHeader
                        eyebrow="Oral Health Management"
                        title="Daily care preview"
                        action={(
                            <button type="button" className={styles.buttonGhost} onClick={() => setLogModalOpen(true)}>
                                Open
                            </button>
                        )}
                    />
                    <article className={styles.summaryCard}>
                        <p className={styles.toolText}>
                            Today's one-tap symptoms and care habits are saved to your patient account.
                        </p>
                        <div className={styles.detailPills}>
                            {selectedLogItems.slice(0, 6).map((item) => (
                                <span key={item.id} className={styles.detailPill}>{item.label}</span>
                            ))}
                        </div>
                    </article>
                </div>
            </section>

            <section className={styles.cardGrid}>
                <article className={styles.summaryCard}>
                    <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '12px' }}>{preview.carePlan.title}</h3>
                    <p className={styles.toolText}>{preview.carePlan.body}</p>
                    <div className={styles.timeline}>
                        {preview.carePlan.checklist.map((item) => (
                            <div key={item} className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <p className={styles.timelineText}>{item}</p>
                            </div>
                        ))}
                    </div>
                </article>

                <article className={styles.summaryCard}>
                    <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '12px' }}>Dental Health Education</h3>
                    <p className={styles.toolText}>{preview.education.body}</p>
                    <div className={styles.heroActions}>
                        <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/ai-companion?tab=education')}>
                            More Dental Health Education
                        </button>
                        <button type="button" className={styles.buttonGhost} onClick={() => navigate(`${location.pathname}?source=oral-care`)}>
                            Refresh Preview
                        </button>
                    </div>
                </article>
            </section>

            {factorModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div
                        className={styles.modalCard}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="oral-health-factors-title"
                        aria-describedby="oral-health-factors-description"
                    >
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="oral-health-factors-title" className={styles.modalTitle}>Oral Health Management Factors</h3>
                                <p id="oral-health-factors-description" className={styles.modalSubtitle}>Choose all that apply. These factors help personalize your oral-care screen.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setFactorModalOpen(false)} aria-label="Close oral health factors dialog">×</button>
                        </div>
                        <div className={styles.toolGrid}>
                            {factors.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={styles.toolCard}
                                    onClick={() => toggleFactor(item.id)}
                                    aria-pressed={Boolean(item.active)}
                                    aria-label={`${item.label}, ${item.active ? 'selected' : 'not selected'}`}
                                    style={{
                                        border: item.active ? '1px solid #01538b' : '1px solid rgba(1, 83, 139, 0.07)',
                                        background: item.active ? '#eef8fd' : '#ffffff',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <h4 className={styles.toolTitle}>{item.label}</h4>
                                    <p className={styles.toolText}>{item.active ? 'Active in this preview' : 'Tap to include in this care context.'}</p>
                                </button>
                            ))}
                        </div>
                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => setFactorModalOpen(false)} disabled={saving}>
                                Cancel
                            </button>
                            <button type="button" className={styles.buttonPrimary} onClick={saveFactors} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Factors'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {logModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div
                        className={styles.modalCard}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="quick-log-title"
                        aria-describedby="quick-log-description"
                    >
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="quick-log-title" className={styles.modalTitle}>Quick Log</h3>
                                <p id="quick-log-description" className={styles.modalSubtitle}>Save today's symptoms and home-care habits.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setLogModalOpen(false)} aria-label="Close quick log dialog">×</button>
                        </div>
                        {logGroups.map((group) => (
                            <section key={group.id} style={{ marginBottom: '18px' }}>
                                <h4 className={styles.sectionTitle} style={{ fontSize: '17px', marginBottom: '12px' }}>{group.title}</h4>
                                <div className={styles.detailPills}>
                                    {group.items.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={styles.detailPill}
                                            onClick={() => toggleLogItem(group.id, item.id)}
                                            aria-pressed={Boolean(item.selected)}
                                            aria-label={`${item.label}, ${item.selected ? 'selected' : 'not selected'}`}
                                            style={{
                                                background: item.selected ? '#dff6fc' : '#ffffff',
                                                borderColor: item.selected ? '#2dccf6' : 'rgba(1, 83, 139, 0.08)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        ))}
                        <label className={styles.field}>
                            <span className={styles.label}>Notes</span>
                            <textarea
                                className={styles.textarea}
                                value={logNotes}
                                onChange={(event) => setLogNotes(event.target.value)}
                                maxLength={500}
                                placeholder="Optional note for yourself before your next visit."
                            />
                        </label>
                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => setLogModalOpen(false)} disabled={saving}>
                                Cancel
                            </button>
                            <button type="button" className={styles.buttonPrimary} onClick={saveDailyLog} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Daily Log'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
