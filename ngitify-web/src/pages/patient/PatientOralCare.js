import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
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

export default function PatientOralCare() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const visitPrediction = useVisitPrediction();
    const preview = useMemo(() => getStaticOralCarePreview(visitPrediction), [visitPrediction]);
    const [factors, setFactors] = useState(preview.factors);
    const [logGroups, setLogGroups] = useState(preview.logGroups);
    const [factorModalOpen, setFactorModalOpen] = useState(false);
    const [logModalOpen, setLogModalOpen] = useState(false);

    React.useEffect(() => {
        setFactors(preview.factors);
        setLogGroups(preview.logGroups);
    }, [preview]);

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

    return (
        <PatientPageFrame
            title="Oral Care Window"
            subtitle={`A larger-screen version of the patient mobile preventive care preview for ${user?.assignedBranch || 'your assigned branch'}.`}
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
                    </div>
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
                        eyebrow="Current Factors"
                        title="Dental-specific multi-select factors"
                        action={(
                            <button type="button" className={styles.buttonGhost} onClick={() => setFactorModalOpen(true)}>
                                Open
                            </button>
                        )}
                    />
                    <article className={styles.summaryCard}>
                        <p className={styles.toolText}>
                            This uses multi-select factors instead of a single-choice radio list so patients can reflect overlapping dental concerns more accurately.
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
                        eyebrow="Quick Log"
                        title="Daily care preview"
                        action={(
                            <button type="button" className={styles.buttonGhost} onClick={() => setLogModalOpen(true)}>
                                Open
                            </button>
                        )}
                    />
                    <article className={styles.summaryCard}>
                        <p className={styles.toolText}>
                            The mobile preview’s one-tap symptom and care chips are also available here on web.
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
                    <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '12px' }}>{preview.education.title}</h3>
                    <p className={styles.toolText}>{preview.education.body}</p>
                    <div className={styles.heroActions}>
                        <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/ai-companion?tab=education')}>
                            More Education
                        </button>
                        <button type="button" className={styles.buttonGhost} onClick={() => navigate(`${location.pathname}?source=oral-care`)}>
                            Refresh Preview
                        </button>
                    </div>
                </article>
            </section>

            {factorModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>Oral Health Factors</h3>
                                <p className={styles.modalSubtitle}>Choose all that apply. These stay multi-select instead of single-choice for better patient accuracy.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setFactorModalOpen(false)}>×</button>
                        </div>
                        <div className={styles.toolGrid}>
                            {factors.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={styles.toolCard}
                                    onClick={() => toggleFactor(item.id)}
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
                    </div>
                </div>
            ) : null}

            {logModalOpen ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>Quick Log</h3>
                                <p className={styles.modalSubtitle}>Preview the same one-tap symptom and oral-care logging pattern used on mobile.</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setLogModalOpen(false)}>×</button>
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
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
