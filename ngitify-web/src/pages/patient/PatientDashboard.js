import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaCalendarAlt,
    FaChevronRight,
    FaInfoCircle,
    FaRobot,
    FaTimes,
    FaTooth,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';
import {
    formatDateDisplay,
    formatTime24,
    parseDateKey,
    toDateKey,
} from '../../utils/patientPortal';
import { PatientEmptyState, PatientStatusBadge } from '../../components/patient/PatientFrame';
import PatientMonthCalendar from '../../components/patient/PatientMonthCalendar';
import { AdminDashboardPage } from '../../components/dashboard/AdminDashboardComponents';
import patientStyles from '../../styles/patient/PatientPortal.module.css';

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'Dentist to be assigned';
};

const getBranchLabel = (appointment, fallback) => (
    appointment?.branch?.name
    || appointment?.branchName
    || appointment?.branch
    || fallback
    || 'Branch to be assigned'
);

const getAppointmentDate = (appointment) => {
    const raw = appointment?.date || appointment?.createdAt;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
};

const toDateWithTime = (appointment) => {
    const baseDate = getAppointmentDate(appointment);
    if (!baseDate) return null;

    const mergedDate = new Date(baseDate);
    const [hoursText = '0', minutesText = '0'] = String(appointment?.time || '').split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        mergedDate.setHours(hours, minutes, 0, 0);
    } else {
        mergedDate.setHours(12, 0, 0, 0);
    }

    return mergedDate;
};

const getWeekDates = (date) => {
    const start = new Date(date);
    start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());

    return Array.from({ length: 7 }, (_, index) => {
        const item = new Date(start);
        item.setDate(start.getDate() + index);
        return item;
    });
};

const getLabelMap = (groups = []) => {
    const map = new Map();
    groups.forEach((group) => {
        (group.items || []).forEach((item) => {
            map.set(item.id, item.label || item.id);
        });
    });
    return map;
};

export default function PatientDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [visitPrediction, setVisitPrediction] = useState(null);
    const [oralHealth, setOralHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [appointmentError, setAppointmentError] = useState('');
    const [visitReasonOpen, setVisitReasonOpen] = useState(false);

    useEffect(() => {
        const timerId = window.setInterval(() => setCurrentTime(new Date()), 1000);
        return () => window.clearInterval(timerId);
    }, []);

    const fetchDashboard = useCallback(async () => {
        const patientId = user?.id || user?._id || user?.userId;
        if (!patientId) return;

        try {
            setLoading(true);
            const [
                appointmentResponse,
                notificationResponse,
                predictionResponse,
                oralHealthResponse,
            ] = await Promise.allSettled([
                authFetch(`/appointments?patientId=${patientId}`),
                authFetch('/notifications'),
                authFetch('/my/visit-prediction'),
                authFetch('/my/oral-health'),
            ]);

            if (appointmentResponse.status === 'fulfilled' && appointmentResponse.value.ok) {
                const payload = await appointmentResponse.value.json();
                const sortedAppointments = (Array.isArray(payload) ? payload : [])
                    .map((item) => ({
                        ...item,
                        _sortDate: toDateWithTime(item),
                    }))
                    .filter((item) => item._sortDate)
                    .sort((left, right) => left._sortDate - right._sortDate);

                setAppointments(sortedAppointments);
                setAppointmentError('');
            } else {
                setAppointments([]);
                setAppointmentError('Could not load your appointments right now.');
            }

            if (notificationResponse.status === 'fulfilled' && notificationResponse.value.ok) {
                const payload = await notificationResponse.value.json();
                setNotifications(Array.isArray(payload) ? payload : []);
            } else {
                setNotifications([]);
            }

            if (predictionResponse.status === 'fulfilled' && predictionResponse.value.ok) {
                const payload = await predictionResponse.value.json();
                setVisitPrediction(payload?.prediction || null);
            } else {
                setVisitPrediction(null);
            }

            if (oralHealthResponse.status === 'fulfilled' && oralHealthResponse.value.ok) {
                const payload = await oralHealthResponse.value.json();
                setOralHealth(payload || null);
            } else {
                setOralHealth(null);
            }
        } catch {
            setAppointments([]);
            setNotifications([]);
            setVisitPrediction(null);
            setOralHealth(null);
            setAppointmentError('Could not load your appointments right now.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?._id, user?.userId]);

    useEffect(() => {
        fetchDashboard();
        const intervalId = window.setInterval(fetchDashboard, 30000);
        const handleFocus = () => fetchDashboard();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchDashboard();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchDashboard]);

    const assignedBranch = user?.assignedBranch || 'Assigned branch pending';
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    const oralCarePreview = useMemo(() => getStaticOralCarePreview(visitPrediction, oralHealth), [visitPrediction, oralHealth]);
    const selectedDateKey = toDateKey(selectedDate);
    const todayKey = toDateKey(new Date());
    const todayLabel = formatDateDisplay(new Date(), { weekday: 'long', month: 'long' });
    const selectedDateLabel = formatDateDisplay(selectedDate, { weekday: 'long', month: 'long' });

    const appointmentsByDate = useMemo(() => {
        const grouped = new Map();
        appointments.forEach((appointment) => {
            const key = toDateKey(appointment._sortDate);
            grouped.set(key, [...(grouped.get(key) || []), appointment]);
        });
        return grouped;
    }, [appointments]);

    const calendarMarks = useMemo(() => {
        const marks = {};
        appointmentsByDate.forEach((items, key) => {
            marks[key] = {
                accent: items.some((item) => ['pending', 'confirmed', 'in-clinic'].includes(String(item.status || '').toLowerCase())),
                dotColor: '#01538b',
                metaLabel: `${items.length} visit${items.length === 1 ? '' : 's'}`,
            };
        });
        marks[todayKey] = {
            ...(marks[todayKey] || {}),
            highlight: true,
            metaLabel: marks[todayKey]?.metaLabel || 'Today',
        };
        return marks;
    }, [appointmentsByDate, todayKey]);

    const selectedDateAppointments = appointmentsByDate.get(selectedDateKey) || [];
    const selectedWeekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

    const todayLog = useMemo(() => (
        (oralHealth?.logs || []).find((log) => log.logDateKey === todayKey) || null
    ), [oralHealth?.logs, todayKey]);

    const todaySummary = useMemo(() => {
        if (!todayLog) return 'No Oral Health Management entry has been saved for today.';

        const labelMap = getLabelMap(oralHealth?.logGroups || oralCarePreview.logGroups);
        const symptoms = (todayLog.symptoms || []).map((id) => labelMap.get(id) || id);
        const dailyCare = (todayLog.dailyCare || []).map((id) => labelMap.get(id) || id);
        const riskFactors = (todayLog.riskFactors || []).map((id) => labelMap.get(id) || id);
        const parts = [];

        if (dailyCare.length) parts.push(`Care: ${dailyCare.join(', ')}`);
        if (symptoms.length) parts.push(`Notes to watch: ${symptoms.join(', ')}`);
        if (riskFactors.length) parts.push(`Other: ${riskFactors.join(', ')}`);
        if (todayLog.notes) parts.push(`Note: ${todayLog.notes}`);

        return parts.length ? parts.join('. ') : 'Today has a saved entry, with no specific symptoms or notes selected.';
    }, [oralCarePreview.logGroups, oralHealth?.logGroups, todayLog]);

    const dentistSuggestedVisit = visitPrediction?.isFollowUpRecommendation
        ? (visitPrediction.recommendedDateLabel || formatDateDisplay(visitPrediction.recommendedDate))
        : 'No dentist suggested follow-up recorded';

    const systemRecommendation = visitPrediction
        ? `${visitPrediction.windowLabel || oralCarePreview.hero.windowLabel} (${visitPrediction.label || oralCarePreview.hero.statusLabel})`
        : oralCarePreview.hero.windowLabel;
    const recommendationSources = visitPrediction?.sourceLabels || oralCarePreview.hero.sourceLabels || [];
    const recommendationExplanationItems = visitPrediction?.explanationItems || oralCarePreview.hero.explanationItems || [
        visitPrediction?.recommendationReason || oralCarePreview.hero.whyThisShowing,
    ];

    const handleMonthChange = (delta) => {
        setCurrentMonthView((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    };

    const handleSelectDate = (key, cell) => {
        const nextDate = parseDateKey(key) || cell?.date;
        if (!nextDate) return;
        setSelectedDate(nextDate);
        setCurrentMonthView(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    };

    return (
        <AdminDashboardPage
            title="Patient Dashboard"
            currentTime={currentTime}
            subtitle={assignedBranch}
            notificationPath="/patient/notifications"
            unreadCount={unreadCount}
            navigate={navigate}
        >
            <div className={patientStyles.dashboardFocusGrid}>
                <section className={patientStyles.dashboardWidget} aria-labelledby="patient-calendar-title">
                    <div className={patientStyles.sectionHeader}>
                        <div>
                            <span className={patientStyles.sectionEyebrow}>Calendar</span>
                            <h2 id="patient-calendar-title" className={patientStyles.sectionTitle}>Choose a day</h2>
                            <p className={patientStyles.sectionDescription}>Select a date to review the schedule underneath.</p>
                        </div>
                        <button
                            type="button"
                            className={patientStyles.buttonSecondary}
                            onClick={() => handleSelectDate(todayKey, { date: new Date() })}
                        >
                            Today
                        </button>
                    </div>

                    <div className={patientStyles.dashboardWeekStrip} aria-label="Selected week">
                        {selectedWeekDates.map((date) => {
                            const key = toDateKey(date);
                            const isSelected = key === selectedDateKey;
                            const count = appointmentsByDate.get(key)?.length || 0;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`${patientStyles.dashboardWeekDay} ${isSelected ? patientStyles.dashboardWeekDayActive : ''}`}
                                    onClick={() => handleSelectDate(key, { date })}
                                    aria-pressed={isSelected}
                                    aria-label={`${formatDateDisplay(date, { weekday: 'long', month: 'long' })}${count ? `, ${count} appointment${count === 1 ? '' : 's'}` : ', no appointments'}`}
                                >
                                    <span>{date.toLocaleDateString('en-PH', { weekday: 'short' })}</span>
                                    <strong>{date.getDate()}</strong>
                                    <small>{count ? `${count} visit${count === 1 ? '' : 's'}` : 'Clear'}</small>
                                </button>
                            );
                        })}
                    </div>

                    <PatientMonthCalendar
                        currentMonth={currentMonthView}
                        selectedDate={selectedDateKey}
                        marks={calendarMarks}
                        onChangeMonth={handleMonthChange}
                        onSelectDate={handleSelectDate}
                    />
                </section>

                <div className={patientStyles.dashboardSideStack}>
                    <section className={patientStyles.dashboardWidget} aria-labelledby="oral-management-summary-title">
                        <div className={patientStyles.sectionHeader}>
                            <div>
                                <span className={patientStyles.sectionEyebrow}>Today</span>
                                <h2 id="oral-management-summary-title" className={patientStyles.sectionTitle}>Today&apos;s Oral Health Management</h2>
                                <p className={patientStyles.sectionDescription}>{todayLabel}</p>
                            </div>
                            <FaTooth className={patientStyles.dashboardPanelIcon} aria-hidden="true" focusable="false" />
                        </div>

                        <div className={patientStyles.dashboardSummaryPanel}>
                            <p className={patientStyles.dashboardSummaryLead}>
                                {todayLog ? 'Logged today' : 'Not logged yet'}
                            </p>
                            <p className={patientStyles.dashboardSummaryText}>{todaySummary}</p>
                            <div className={patientStyles.dashboardActionRow}>
                                <button
                                    type="button"
                                    className={patientStyles.buttonPrimary}
                                    onClick={() => navigate('/patient/oral-care?source=dashboard')}
                                >
                                    {todayLog ? 'Edit Entry' : 'Log Entry'}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className={patientStyles.dashboardWidget} aria-labelledby="visit-window-title">
                        <div className={patientStyles.sectionHeader}>
                            <div>
                                <span className={patientStyles.sectionEyebrow}>Recommended Visit Window</span>
                                <h2 id="visit-window-title" className={patientStyles.sectionTitle}>Next care timing</h2>
                            </div>
                            <FaInfoCircle className={patientStyles.dashboardPanelIcon} aria-hidden="true" focusable="false" />
                        </div>

                        <div className={patientStyles.dashboardMiniList}>
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>Dentist Suggested Next Visit</span>
                                <strong className={patientStyles.dashboardMiniValue}>{dentistSuggestedVisit}</strong>
                            </div>
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>Current System Recommendation</span>
                                <strong className={patientStyles.dashboardMiniValue}>{systemRecommendation}</strong>
                            </div>
                            {recommendationSources.length ? (
                                <div className={patientStyles.dashboardMiniRow}>
                                    <span className={patientStyles.dashboardMiniLabel}>Based on</span>
                                    <span className={patientStyles.detailPills}>
                                        {recommendationSources.map((source) => (
                                            <span key={source} className={patientStyles.detailPill}>{source}</span>
                                        ))}
                                    </span>
                                </div>
                            ) : null}
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>Source / Reason</span>
                                <span className={patientStyles.dashboardMiniValue}>
                                    {visitPrediction?.recommendationReason || oralCarePreview.hero.whyThisShowing}
                                </span>
                            </div>
                        </div>

                        <div className={patientStyles.dashboardActionRow}>
                            <button
                                type="button"
                                className={patientStyles.buttonSecondary}
                                onClick={() => setVisitReasonOpen(true)}
                            >
                                Why am I seeing this?
                            </button>
                            <button
                                type="button"
                                className={patientStyles.buttonGhost}
                                onClick={() => navigate('/patient/appointments?mode=book')}
                            >
                                Book Appointment
                            </button>
                        </div>
                    </section>
                </div>

                <section className={`${patientStyles.dashboardWidget} ${patientStyles.dashboardSchedulePanel}`} aria-labelledby="selected-day-schedule-title">
                    <div className={patientStyles.sectionHeader}>
                        <div>
                            <span className={patientStyles.sectionEyebrow}>Selected-Day Schedule</span>
                            <h2 id="selected-day-schedule-title" className={patientStyles.sectionTitle}>{selectedDateLabel}</h2>
                            <p className={patientStyles.sectionDescription}>
                                Appointments refresh when you choose another date.
                            </p>
                        </div>
                        <button
                            type="button"
                            className={patientStyles.buttonSecondary}
                            onClick={() => navigate('/patient/appointments')}
                        >
                            My Appointments <FaChevronRight aria-hidden="true" focusable="false" />
                        </button>
                    </div>

                    {loading ? (
                        <div className={patientStyles.loaderBox}>
                            <span className={patientStyles.loaderText}>Loading your schedule...</span>
                        </div>
                    ) : appointmentError ? (
                        <PatientEmptyState
                            icon={<FaCalendarAlt />}
                            title="Schedule unavailable"
                            message={appointmentError}
                            action={(
                                <button type="button" className={patientStyles.buttonSecondary} onClick={fetchDashboard}>
                                    Try Again
                                </button>
                            )}
                        />
                    ) : selectedDateAppointments.length ? (
                        <div className={patientStyles.dashboardScheduleList}>
                            {selectedDateAppointments.map((appointment) => (
                                <article key={appointment._id} className={patientStyles.dashboardScheduleItem}>
                                    <div className={patientStyles.dashboardScheduleTime}>
                                        <strong>{appointment.time ? formatTime24(appointment.time) : 'Time pending'}</strong>
                                        <PatientStatusBadge status={appointment.status} />
                                    </div>
                                    <div className={patientStyles.dashboardScheduleBody}>
                                        <h3>{appointment.procedure || 'Upcoming Appointment'}</h3>
                                        <p>{getDentistLabel(appointment)}</p>
                                        <p>{getBranchLabel(appointment, assignedBranch)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className={patientStyles.buttonGhost}
                                        onClick={() => navigate('/patient/appointments')}
                                        aria-label={`View details for ${appointment.procedure || 'appointment'} on ${selectedDateLabel}`}
                                    >
                                        Details
                                    </button>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <PatientEmptyState
                            icon={<FaCalendarAlt />}
                            title="No appointment on this day"
                            message="Choose another date or request a new appointment when you are ready."
                            action={(
                                <button type="button" className={patientStyles.buttonPrimary} onClick={() => navigate('/patient/appointments?mode=book')}>
                                    Book Appointment
                                </button>
                            )}
                        />
                    )}
                </section>
            </div>

            <button
                type="button"
                className={patientStyles.dashboardAiButton}
                onClick={() => navigate('/patient/ai-companion')}
                aria-label="Open patient AI experience"
            >
                <FaRobot aria-hidden="true" focusable="false" />
                <span>AI</span>
            </button>

            {visitReasonOpen ? (
                <div className={patientStyles.modalOverlay} role="presentation" onMouseDown={() => setVisitReasonOpen(false)}>
                    <div
                        className={patientStyles.modalCard}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="visit-reason-title"
                        aria-describedby="visit-reason-description"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className={patientStyles.modalHeader}>
                            <div>
                                <h3 id="visit-reason-title" className={patientStyles.modalTitle}>Why am I seeing this?</h3>
                                <p id="visit-reason-description" className={patientStyles.modalSubtitle}>
                                    Recommended Visit Window uses backend recommendation rules so web and mobile show the same source and explanation.
                                </p>
                            </div>
                            <button
                                type="button"
                                className={patientStyles.modalClose}
                                onClick={() => setVisitReasonOpen(false)}
                                aria-label="Close visit window explanation"
                            >
                                <FaTimes aria-hidden="true" focusable="false" />
                            </button>
                        </div>
                        <div className={patientStyles.dashboardMiniList}>
                            {recommendationSources.length ? (
                                <div className={patientStyles.dashboardMiniRow}>
                                    <span className={patientStyles.dashboardMiniLabel}>Based on</span>
                                    <span className={patientStyles.detailPills}>
                                        {recommendationSources.map((source) => (
                                            <span key={source} className={patientStyles.detailPill}>{source}</span>
                                        ))}
                                    </span>
                                </div>
                            ) : null}
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>Dentist Source</span>
                                <span className={patientStyles.dashboardMiniValue}>{dentistSuggestedVisit}</span>
                            </div>
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>System Source</span>
                                <span className={patientStyles.dashboardMiniValue}>{visitPrediction?.intervalLabel || 'Preventive timing preview'}</span>
                            </div>
                            <div className={patientStyles.dashboardMiniRow}>
                                <span className={patientStyles.dashboardMiniLabel}>Explanation</span>
                                <span className={patientStyles.dashboardMiniValue}>
                                    {recommendationExplanationItems.join(' ')}
                                </span>
                            </div>
                            {visitPrediction?.lastProcedure ? (
                                <div className={patientStyles.dashboardMiniRow}>
                                    <span className={patientStyles.dashboardMiniLabel}>Latest Recorded Procedure</span>
                                    <span className={patientStyles.dashboardMiniValue}>{visitPrediction.lastProcedure}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : null}
        </AdminDashboardPage>
    );
}
