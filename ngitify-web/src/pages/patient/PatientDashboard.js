import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaCalendarAlt,
    FaClipboardList,
    FaRobot,
    FaTooth,
    FaUserCircle,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';
import {
    formatDateDisplay,
    formatTime24,
} from '../../utils/patientPortal';
import PasswordChangeWarning from '../../components/common/PasswordChangeWarning';
import {
    PatientEmptyState,
    PatientPageFrame,
    PatientSectionHeader,
    PatientStatusBadge,
} from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'To be assigned';
};

export default function PatientDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [upcomingAppointment, setUpcomingAppointment] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [visitPrediction, setVisitPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [appointmentError, setAppointmentError] = useState('');

    const fetchDashboard = useCallback(async () => {
        if (!user?.id) return;

        try {
            const [appointmentResponse, notificationResponse, predictionResponse] = await Promise.allSettled([
                authFetch(`/appointments?patientId=${user.id}`),
                authFetch('/notifications'),
                authFetch('/my/visit-prediction'),
            ]);

            if (appointmentResponse.status === 'fulfilled' && appointmentResponse.value.ok) {
                const payload = await appointmentResponse.value.json();
                const items = Array.isArray(payload) ? payload : [];
                const nextAppointment = items
                    .filter((item) => ['pending', 'confirmed', 'in-clinic'].includes(item.status))
                    .sort((left, right) => new Date(left.date) - new Date(right.date))[0] || null;
                setUpcomingAppointment(nextAppointment);
                setAppointmentError('');
            } else {
                setAppointmentError('Could not load your appointment details right now.');
            }

            if (notificationResponse.status === 'fulfilled' && notificationResponse.value.ok) {
                const payload = await notificationResponse.value.json();
                setNotifications(Array.isArray(payload) ? payload : []);
            }

            if (predictionResponse.status === 'fulfilled' && predictionResponse.value.ok) {
                const payload = await predictionResponse.value.json();
                setVisitPrediction(payload?.prediction || null);
            }
        } catch {
            setAppointmentError('Could not load your appointment details right now.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchDashboard();
        const intervalId = window.setInterval(fetchDashboard, 30000);
        const handleFocus = () => fetchDashboard();
        window.addEventListener('focus', handleFocus);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchDashboard]);

    const unreadCount = notifications.filter((item) => !item.isRead).length;
    const oralCarePreview = useMemo(() => getStaticOralCarePreview(visitPrediction), [visitPrediction]);
    const assignedBranch = user?.assignedBranch || 'Assigned branch pending';
    const appointmentDentist = getDentistLabel(upcomingAppointment);

    const quickLinks = [
        {
            title: 'Visits',
            text: 'Review upcoming bookings and completed visits.',
            icon: <FaCalendarAlt />,
            action: () => navigate('/patient/appointments'),
        },
        {
            title: 'Medical Records',
            text: 'Open your odontogram, radiographs, and medical history.',
            icon: <FaClipboardList />,
            action: () => navigate('/patient/records'),
        },
        {
            title: 'AI Companion',
            text: 'Ask NgitiBot or send support questions to the clinic.',
            icon: <FaRobot />,
            action: () => navigate('/patient/ai-companion'),
        },
        {
            title: 'Oral Care Window',
            text: 'Check your preventive care window and watch signals.',
            icon: <FaTooth />,
            action: () => navigate('/patient/oral-care'),
        },
        {
            title: 'Profile',
            text: 'View your patient details and update your information.',
            icon: <FaUserCircle />,
            action: () => navigate('/patient/profile'),
        },
        {
            title: 'Notifications',
            text: 'See appointment alerts, reminders, and radiograph updates.',
            icon: <FaBell />,
            action: () => navigate('/patient/notifications'),
        },
    ];

    return (
        <PatientPageFrame
            title="Patient Dashboard"
            subtitle="Your Dentime home base on web, styled to match the clinic dashboard while keeping the patient shortcuts from mobile."
            actions={(
                <>
                    <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/appointments')}>
                        View Visits
                    </button>
                    <button type="button" className={styles.buttonPrimary} onClick={() => navigate('/patient/book')}>
                        Book Appointment
                    </button>
                </>
            )}
        >
            <PasswordChangeWarning />

            <div className={styles.heroGrid}>
                <section className={`${styles.heroCard} ${styles.heroCardDark}`}>
                    <span className={styles.heroTag}>Next Visit</span>
                    {loading ? (
                        <div className={styles.loaderBox}>
                            <span className={styles.loaderText}>Loading your dashboard...</span>
                        </div>
                    ) : appointmentError ? (
                        <PatientEmptyState
                            icon={<FaCalendarAlt />}
                            title="Appointment details unavailable"
                            message={appointmentError}
                            action={(
                                <button type="button" className={styles.buttonSecondary} onClick={fetchDashboard}>
                                    Try Again
                                </button>
                            )}
                        />
                    ) : upcomingAppointment ? (
                        <>
                            <h2 className={styles.heroTitle}>{upcomingAppointment.procedure || 'Upcoming Appointment'}</h2>
                            <p className={styles.heroText}>
                                {appointmentDentist} on {formatDateDisplay(upcomingAppointment.date, { weekday: 'short' })}
                                {upcomingAppointment.time ? ` at ${formatTime24(upcomingAppointment.time)}` : ''}.
                            </p>
                            <div className={styles.detailPills}>
                                <span className={styles.detailPill}>{assignedBranch}</span>
                                <PatientStatusBadge status={upcomingAppointment.status} />
                            </div>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/appointments')}>
                                    Review Timeline
                                </button>
                                <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/book')}>
                                    Book Another Date
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2 className={styles.heroTitle}>No upcoming appointment</h2>
                            <p className={styles.heroText}>
                                Plan your next check-up whenever you are ready. Your web booking flow follows the same assigned-branch rules as mobile.
                            </p>
                            <div className={styles.heroActions}>
                                <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/book')}>
                                    Book Appointment
                                </button>
                            </div>
                        </>
                    )}
                </section>

                <section className={styles.heroCard}>
                    <span className={styles.heroEyebrow}>Preventive Care Window</span>
                    <h2 className={styles.heroTitle} style={{ color: '#17364a', fontSize: '24px' }}>
                        {oralCarePreview.hero.windowLabel}
                    </h2>
                    <p className={styles.heroText} style={{ color: '#5f7a8d' }}>
                        {oralCarePreview.hero.whyThisShowing}
                    </p>
                    <div className={styles.detailPills}>
                        <span className={styles.detailPill}>{oralCarePreview.hero.statusLabel}</span>
                        <span className={styles.detailPill}>Recommended: {oralCarePreview.hero.recommendedDateLabel}</span>
                    </div>
                    <div className={styles.heroActions}>
                        <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/oral-care')}>
                            Open Oral Care
                        </button>
                        <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/ai-companion?tab=visit-window')}>
                            Ask AI Companion
                        </button>
                    </div>
                </section>
            </div>

            <div className={styles.metricGrid}>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>Unread Notifications</span>
                    <h3 className={styles.metricValue}>{unreadCount}</h3>
                    <p className={styles.metricSub}>Appointment updates, reminders, and support alerts.</p>
                </article>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>Assigned Branch</span>
                    <h3 className={styles.metricValue} style={{ fontSize: '24px' }}>{assignedBranch}</h3>
                    <p className={styles.metricSub}>Bookings and available slots are locked to this clinic branch.</p>
                </article>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>Care Reminder</span>
                    <h3 className={styles.metricValue} style={{ fontSize: '24px' }}>{oralCarePreview.hero.statusLabel}</h3>
                    <p className={styles.metricSub}>{oralCarePreview.hero.suggestedNextAction}</p>
                </article>
            </div>

            <section style={{ marginBottom: '24px' }}>
                <PatientSectionHeader
                    eyebrow="Care Tools"
                    title="Everything from the mobile patient app, now on web"
                    description="Use the same patient shortcuts from a larger dashboard surface."
                />
                <div className={styles.toolGrid}>
                    {quickLinks.map((item) => (
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
            </section>

            <section className={styles.splitGrid}>
                <div>
                    <PatientSectionHeader
                        eyebrow="Latest Alerts"
                        title="Recent Notifications"
                        action={(
                            <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/notifications')}>
                                Open All
                            </button>
                        )}
                    />
                    {notifications.slice(0, 4).length ? (
                        notifications.slice(0, 4).map((item) => (
                            <article key={item._id} className={styles.listCard}>
                                <div className={styles.listHeader}>
                                    <div>
                                        <h3 className={styles.listTitle}>{item.title || 'Notification'}</h3>
                                        <p className={styles.listMeta}>
                                            {formatDateDisplay(item.createdAt)} • {item.type || 'Update'}
                                        </p>
                                    </div>
                                    {!item.isRead ? <PatientStatusBadge status="confirmed" label="Unread" /> : null}
                                </div>
                                <p className={styles.toolText}>{item.message}</p>
                            </article>
                        ))
                    ) : (
                        <PatientEmptyState
                            icon={<FaBell />}
                            title="No notifications yet"
                            message="Appointment confirmations, radiograph updates, and predictive visit reminders will show here."
                        />
                    )}
                </div>

                <div>
                    <PatientSectionHeader
                        eyebrow="Quick Reach"
                        title="Need help or a refresher?"
                    />
                    <article className={styles.timelineCard}>
                        <div className={styles.timeline}>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <div>
                                    <h3 className={styles.timelineTitle}>NgitiBot on web</h3>
                                    <p className={styles.timelineText}>
                                        Ask about appointment details, branch slot availability, post-op guidance, and approved dental care tips.
                                    </p>
                                </div>
                            </div>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <div>
                                    <h3 className={styles.timelineTitle}>Patient activity logs</h3>
                                    <p className={styles.timelineText}>
                                        Review your recent account actions, EMR views, booking requests, and other in-app activity.
                                    </p>
                                </div>
                            </div>
                            <div className={styles.timelineItem}>
                                <span className={styles.timelineDot} />
                                <div>
                                    <h3 className={styles.timelineTitle}>Profile and settings</h3>
                                    <p className={styles.timelineText}>
                                        Update your personal information, notification preferences, privacy settings, and password in one place.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className={styles.heroActions}>
                            <button type="button" className={styles.buttonSecondary} onClick={() => navigate('/patient/chatbot')}>
                                Open NgitiBot
                            </button>
                            <button type="button" className={styles.buttonGhost} onClick={() => navigate('/patient/activity-logs')}>
                                View Activity Logs
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        </PatientPageFrame>
    );
}
