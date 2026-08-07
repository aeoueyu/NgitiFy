import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaBook, FaCalendarAlt, FaTooth } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import PatientMonthCalendar from '../../components/patient/PatientMonthCalendar';
import PatientIcon from '../../components/patient/PatientIcon';
import { PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import {
    EDUCATION_ARTICLES,
    ORAL_HEALTH_TIPS,
    formatDateDisplay,
    parseDateKey,
    toDateKey,
} from '../../utils/patientPortal';
import styles from '../../styles/patient/PatientPortal.module.css';

const SECTIONS = [
    { key: 'overview', label: 'Overview' },
    { key: 'education', label: 'Education' },
    { key: 'oral-health', label: 'Oral Health' },
    { key: 'visit-window', label: 'Visit Window' },
];

const buildVisitWindowMarks = (visitInfo, selectedDate) => {
    if ((!visitInfo?.windowStart && !visitInfo?.windowStartKey) || (!visitInfo?.windowEnd && !visitInfo?.windowEndKey)) {
        return {};
    }

    const windowStart = parseDateKey(visitInfo.windowStartKey) || new Date(visitInfo.windowStart);
    const windowEnd = parseDateKey(visitInfo.windowEndKey) || new Date(visitInfo.windowEnd);
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
        return {};
    }

    const marks = {};
    const cursor = new Date(windowStart);
    const selectedKey = selectedDate || visitInfo.recommendedDateKey || toDateKey(windowStart);
    while (cursor <= windowEnd) {
        const key = toDateKey(cursor);
        marks[key] = {
            selected: key === selectedKey,
            highlight: key !== selectedKey,
            dotColor: '#2dccf6',
        };
        cursor.setDate(cursor.getDate() + 1);
    }
    if (selectedKey && !marks[selectedKey]) {
        marks[selectedKey] = { selected: true, dotColor: '#01538b' };
    }
    return marks;
};

export default function PatientAiCompanion() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [activeSection, setActiveSection] = useState(searchParams.get('tab') || 'overview');
    const [visitInfo, setVisitInfo] = useState(null);
    const [treatmentHistory, setTreatmentHistory] = useState([]);
    const [loadingVisit, setLoadingVisit] = useState(true);
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [selectedVisitDate, setSelectedVisitDate] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    const fetchVisitData = useCallback(async () => {
        try {
            const [logsResponse, predictionResponse] = await Promise.all([
                authFetch('/my/treatment-logs'),
                authFetch('/my/visit-prediction'),
            ]);

            if (logsResponse.ok) {
                const logsPayload = await logsResponse.json();
                setTreatmentHistory(Array.isArray(logsPayload) ? logsPayload : []);
            }

            if (predictionResponse.ok) {
                const predictionPayload = await predictionResponse.json();
                const prediction = predictionPayload?.prediction || null;
                setVisitInfo(prediction);
                if (prediction?.recommendedDateKey) {
                    setSelectedVisitDate(prediction.recommendedDateKey);
                    const monthDate = parseDateKey(prediction.recommendedDateKey);
                    if (monthDate) {
                        setCalendarMonth(monthDate);
                    }
                }
            }
        } catch {
            setTreatmentHistory([]);
            setVisitInfo(null);
        } finally {
            setLoadingVisit(false);
        }
    }, []);

    useEffect(() => {
        fetchVisitData();
    }, [fetchVisitData]);

    useEffect(() => {
        const next = searchParams.get('tab') || 'overview';
        if (SECTIONS.some((item) => item.key === next)) {
            setActiveSection(next);
        }
    }, [searchParams]);

    const updateSection = (sectionKey) => {
        setActiveSection(sectionKey);
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('tab', sectionKey);
            return next;
        }, { replace: true });
    };

    const visitWindowMarks = useMemo(
        () => buildVisitWindowMarks(visitInfo, selectedVisitDate),
        [selectedVisitDate, visitInfo]
    );

    const renderOverview = () => (
        <>
            <div className={styles.heroGrid}>
                <section className={`${styles.heroCard} ${styles.heroCardDark}`}>
                    <span className={styles.heroTag}>AI Care Companion</span>
                    <h2 className={styles.heroTitle}>Education and care reminders</h2>
                    <p className={styles.heroText}>
                        Review approved dental education, oral health guidance, and your next care window based on clinic-recorded treatment history.
                    </p>
                    <div className={styles.heroActions}>
                        <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/book')}>
                            Book Appointment
                        </button>
                    </div>
                </section>

                <section className={styles.metricGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 0 }}>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Visit Prediction</span>
                        <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{visitInfo?.label || 'Preview Mode'}</h3>
                        <p className={styles.metricSub}>{visitInfo?.windowLabel || 'Preventive window will appear after treatment history is recorded.'}</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Treatment Records Used</span>
                        <h3 className={styles.metricValue}>{visitInfo?.historyCount || treatmentHistory.length}</h3>
                        <p className={styles.metricSub}>Used to explain the visit window, not invent one.</p>
                    </article>
                    <article className={styles.metricCard}>
                        <span className={styles.metricLabel}>Assigned Branch</span>
                        <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{user?.assignedBranch || 'Pending'}</h3>
                        <p className={styles.metricSub}>Where your booking slots and clinic schedule are sourced.</p>
                    </article>
                </section>
            </div>

            <div className={styles.toolGrid}>
                {[
                    { title: 'Dental Education', text: 'Read patient-friendly articles and oral health reminders.', icon: <FaBook />, action: () => updateSection('education') },
                    { title: 'Oral Health', text: 'Review daily care reminders and watch signals.', icon: <FaTooth />, action: () => updateSection('oral-health') },
                    { title: 'Visit Window', text: 'Review your preventive window and the recent treatment data behind it.', icon: <FaCalendarAlt />, action: () => updateSection('visit-window') },
                ].map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        className={styles.toolCard}
                        onClick={item.action}
                        style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                    >
                        <span className={styles.toolIcon}>{item.icon}</span>
                        <h3 className={styles.toolTitle}>{item.title}</h3>
                        <p className={styles.toolText}>{item.text}</p>
                    </button>
                ))}
            </div>
        </>
    );

    const renderEducation = () => (
        <section className={styles.tabPanel}>
            <PatientSectionHeader
                eyebrow="Learning"
                title="Dental education library"
                description="Approved patient-friendly guidance carried over from the mobile companion."
            />
            <div className={styles.toolGrid}>
                {EDUCATION_ARTICLES.map((article) => (
                    <button
                        key={article.id}
                        type="button"
                        className={styles.toolCard}
                        onClick={() => setSelectedArticle(article)}
                        style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                    >
                        <span className={styles.toolIcon}>
                            <PatientIcon name={article.iconName} color={article.iconColor} />
                        </span>
                        <h3 className={styles.toolTitle}>{article.title}</h3>
                        <p className={styles.toolText}>{article.summary}</p>
                    </button>
                ))}
            </div>
        </section>
    );

    const renderOralHealth = () => (
        <section className={styles.tabPanel}>
            <PatientSectionHeader
                eyebrow="Daily Care"
                title="Oral health reminders"
                description="Routine tips that complement your preventive care window."
            />
            <div className={styles.toolGrid}>
                {ORAL_HEALTH_TIPS.map((tip) => (
                    <article key={tip.id} className={styles.toolCard}>
                        <span className={styles.toolIcon}>
                            <PatientIcon name={tip.iconName} color={tip.iconColor} />
                        </span>
                        <h3 className={styles.toolTitle}>{tip.title}</h3>
                        <p className={styles.toolText}>{tip.tip}</p>
                    </article>
                ))}
            </div>
            <div className={styles.alertCard}>
                <span className={styles.toolIcon}><FaTooth /></span>
                <div>
                    <h3 className={styles.alertTitle}>Reminder</h3>
                    <p className={styles.alertText}>
                        AI can provide routine education and clinic workflow guidance, but it should never replace a dentist&apos;s judgment for diagnosis or treatment decisions.
                    </p>
                </div>
            </div>
        </section>
    );

    const renderVisitWindow = () => (
        <section className={styles.tabPanel}>
            <PatientSectionHeader
                eyebrow="Prediction"
                title="Your next recommended visit window"
                description="This view explains the existing Dentime prediction using your treatment history. It does not invent its own interval."
            />
            {loadingVisit ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading visit prediction...</span>
                </div>
            ) : visitInfo ? (
                <>
                    <div className={styles.metricGrid}>
                        <article className={styles.metricCard}>
                            <span className={styles.metricLabel}>Status</span>
                            <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{visitInfo.label}</h3>
                            <p className={styles.metricSub}>{visitInfo.recommendationReason}</p>
                        </article>
                        <article className={styles.metricCard}>
                            <span className={styles.metricLabel}>Window</span>
                            <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{visitInfo.windowLabel}</h3>
                            <p className={styles.metricSub}>Recommended date: {visitInfo.recommendedDateLabel || visitInfo.nextDate}</p>
                        </article>
                        <article className={styles.metricCard}>
                            <span className={styles.metricLabel}>Last Procedure</span>
                            <h3 className={styles.metricValue} style={{ fontSize: '22px' }}>{visitInfo.lastProcedure || 'Not available'}</h3>
                            <p className={styles.metricSub}>Last visit: {formatDateDisplay(visitInfo.lastVisitDate)}</p>
                        </article>
                    </div>

                    <PatientMonthCalendar
                        currentMonth={calendarMonth}
                        selectedDate={selectedVisitDate}
                        marks={visitWindowMarks}
                        onChangeMonth={(direction) => {
                            setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
                        }}
                        onSelectDate={(dateKey) => setSelectedVisitDate(dateKey)}
                    />

                    <div className={styles.cardGrid} style={{ marginTop: '18px' }}>
                        <article className={styles.summaryCard}>
                            <span className={styles.infoLabel}>Recommendation Basis</span>
                            <p className={styles.infoValue}>{visitInfo.recommendationReason}</p>
                            <div className={styles.timeline} style={{ marginTop: '16px' }}>
                                {treatmentHistory.slice(0, 5).map((log) => (
                                    <div key={log._id} className={styles.timelineItem}>
                                        <span className={styles.timelineDot} />
                                        <div>
                                            <h4 className={styles.timelineTitle}>{log.procedure || 'Treatment recorded'}</h4>
                                            <p className={styles.timelineMeta}>{formatDateDisplay(log.date)} • {log.branch || 'Clinic record'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                        <article className={styles.summaryCard}>
                            <span className={styles.infoLabel}>Next Step</span>
                            <p className={styles.infoValue}>
                                Book a preventive check-up within the recommended window and mention any sensitivity, gum bleeding, or other watch signals you&apos;ve noticed.
                            </p>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/book')}>
                                    Book Your Next Visit
                                </button>
                            </div>
                        </article>
                    </div>
                </>
            ) : (
                <div className={styles.alertCard}>
                    <span className={styles.toolIcon}><FaCalendarAlt /></span>
                    <div>
                        <h3 className={styles.alertTitle}>No prediction yet</h3>
                        <p className={styles.alertText}>
                            Once the clinic records treatment history in your file, Dentime will highlight a preventive visit window here.
                        </p>
                    </div>
                </div>
            )}
        </section>
    );

    return (
        <PatientPageFrame
            title="AI Care Companion"
            subtitle="The patient-side hub for education, oral health guidance, and predictive visit windows."
        >
            <div className={styles.tabs}>
                {SECTIONS.map((section) => (
                    <button
                        key={section.key}
                        type="button"
                        className={`${styles.tabButton} ${activeSection === section.key ? styles.tabButtonActive : ''}`}
                        onClick={() => updateSection(section.key)}
                    >
                        {section.label}
                    </button>
                ))}
            </div>

            {activeSection === 'overview' ? renderOverview() : null}
            {activeSection === 'education' ? renderEducation() : null}
            {activeSection === 'oral-health' ? renderOralHealth() : null}
            {activeSection === 'visit-window' ? renderVisitWindow() : null}

            {selectedArticle ? (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 className={styles.modalTitle}>{selectedArticle.title}</h3>
                                <p className={styles.modalSubtitle}>{selectedArticle.summary}</p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setSelectedArticle(null)}>×</button>
                        </div>
                        <p className={styles.infoValue}>{selectedArticle.body}</p>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
