import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaBookMedical,
    FaCalendarAlt,
    FaCalendarCheck,
    FaChevronLeft,
    FaChevronRight,
    FaClipboardList,
    FaHistory,
    FaRobot,
    FaTooth,
    FaUserCircle,
    FaUserClock,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { getStaticOralCarePreview } from '../../utils/oralCarePreview';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import { formatDateDisplay, formatTime24 } from '../../utils/patientPortal';
import { PatientEmptyState, PatientStatusBadge } from '../../components/patient/PatientFrame';
import { AdminDashboardPage } from '../../components/dashboard/AdminDashboardComponents';
import adminStyles from '../../styles/admin/AdminDashboard.module.css';
import patientStyles from '../../styles/patient/PatientPortal.module.css';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: 'Araw ng Kagitingan' },
    { month: 4, day: 1, name: 'Labor Day' },
    { month: 5, day: 12, name: 'Independence Day' },
    { month: 11, day: 25, name: 'Christmas Day' },
    { month: 11, day: 31, name: "New Year's Eve" },
];

const ACTIVE_SCHEDULE_STATUSES = ['pending', 'confirmed', 'in-clinic'];

const getDentistLabel = (appointment) => {
    if (appointment?.dentist?.name) {
        return `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim();
    }
    if (appointment?.dentistName) return appointment.dentistName;
    return 'Dentist to be assigned';
};

const getAppointmentDate = (appointment) => {
    const raw = appointment?.date || appointment?.createdAt;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
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

const formatActionLabel = (action = '') => String(action)
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function PatientDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [visitPrediction, setVisitPrediction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [appointmentError, setAppointmentError] = useState('');

    useEffect(() => {
        const timerId = window.setInterval(() => setCurrentTime(new Date()), 1000);
        return () => window.clearInterval(timerId);
    }, []);

    const fetchDashboard = useCallback(async () => {
        const patientId = user?.id || user?._id || user?.userId;
        if (!patientId) return;

        try {
            const [appointmentResponse, notificationResponse, predictionResponse, activityResponse] = await Promise.allSettled([
                authFetch(`/appointments?patientId=${patientId}`),
                authFetch('/notifications'),
                authFetch('/my/visit-prediction'),
                authFetch('/activity-logs/patient'),
            ]);

            if (appointmentResponse.status === 'fulfilled' && appointmentResponse.value.ok) {
                const payload = await appointmentResponse.value.json();
                const items = Array.isArray(payload) ? payload : [];
                const sortedAppointments = items
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
                setAppointmentError('Could not load your schedules right now.');
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

            if (activityResponse.status === 'fulfilled' && activityResponse.value.ok) {
                const payload = await activityResponse.value.json();
                setActivityLogs(Array.isArray(payload) ? payload : []);
            } else {
                setActivityLogs([]);
            }
        } catch {
            setAppointments([]);
            setNotifications([]);
            setActivityLogs([]);
            setAppointmentError('Could not load your schedules right now.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?._id, user?.userId]);

    useEffect(() => {
        fetchDashboard();
        const intervalId = window.setInterval(fetchDashboard, 30000);
        const handleFocus = () => fetchDashboard();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboard();
            }
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
    const patientName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Patient';
    const unreadCount = notifications.filter((item) => !item.isRead).length;
    const oralCarePreview = useMemo(() => getStaticOralCarePreview(visitPrediction), [visitPrediction]);

    const activeSchedules = useMemo(() => appointments
        .filter((item) => ACTIVE_SCHEDULE_STATUSES.includes(String(item.status || '').toLowerCase())), [appointments]);

    const upcomingAppointment = activeSchedules[0] || null;
    const activityPreview = activityLogs.slice(0, 5);
    const todayActiveCount = activeSchedules.filter((item) => (
        startOfDay(item._sortDate).getTime() === startOfDay(new Date()).getTime()
    )).length;

    const selectedDateSchedules = useMemo(() => {
        const selectedKey = startOfDay(selectedDate).getTime();
        return activeSchedules.filter((item) => startOfDay(item._sortDate).getTime() === selectedKey);
    }, [activeSchedules, selectedDate]);

    const getCalendarDays = () => {
        const year = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let index = firstDay - 1; index >= 0; index -= 1) {
            days.push({
                num: daysInPrevMonth - index,
                faded: true,
                date: new Date(year, month - 1, daysInPrevMonth - index),
            });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const currentDate = new Date(year, month, day);
            const isSelected = currentDate.toDateString() === selectedDate.toDateString();
            const isToday = currentDate.toDateString() === new Date().toDateString();
            const hasEvent = activeSchedules.some((item) => item._sortDate.toDateString() === currentDate.toDateString());
            const holiday = PH_HOLIDAYS.find((entry) => entry.month === month && entry.day === day);

            days.push({
                num: day,
                active: isSelected,
                isToday,
                hasEvent,
                isHoliday: Boolean(holiday),
                holidayName: holiday ? holiday.name : '',
                faded: false,
                date: currentDate,
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        const extraCells = totalCells - days.length;

        for (let day = 1; day <= extraCells; day += 1) {
            days.push({
                num: day,
                faded: true,
                date: new Date(year, month + 1, day),
            });
        }

        return days;
    };

    const calendarDays = getCalendarDays();
    const visibleHolidays = PH_HOLIDAYS.filter((holiday) => holiday.month === currentMonthView.getMonth());
    const selectedDateLabel = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const shortcutCards = [
        {
            title: 'Book Appointment',
            description: 'Request your next visit using your assigned branch slot availability.',
            value: upcomingAppointment ? 'Next visit ready' : 'No pending booking',
            actionLabel: 'Book Now',
            icon: <FaCalendarAlt className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/book'),
        },
        {
            title: 'My Appointments',
            description: 'Review pending, confirmed, and in-clinic schedules in one place.',
            value: `${activeSchedules.length} active schedule${activeSchedules.length === 1 ? '' : 's'}`,
            actionLabel: 'Open Visits',
            icon: <FaCalendarCheck className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/appointments'),
        },
        {
            title: 'Medical Records',
            description: 'Open your odontogram, treatment history, and uploaded clinic records.',
            value: 'Records ready',
            actionLabel: 'View Records',
            icon: <FaClipboardList className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/records'),
        },
        {
            title: 'Profile',
            description: 'Check your account information, branch details, and saved patient profile.',
            value: assignedBranch,
            actionLabel: 'Open Profile',
            icon: <FaUserCircle className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/profile'),
        },
    ];

    const supportCards = [
        {
            title: 'AI Companion',
            description: 'Review visit timing, education, and approved dental guidance.',
            value: 'Care guide ready',
            actionLabel: 'Open AI',
            icon: <FaRobot className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/ai-companion'),
        },
        {
            title: 'Oral Care',
            description: 'Review your preventive care window and track signs you should not ignore.',
            value: oralCarePreview.hero.statusLabel,
            actionLabel: 'Open Care',
            icon: <FaTooth className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/oral-care'),
        },
        {
            title: 'Activity Logs',
            description: 'See your recent logins, booking actions, and other patient account activity.',
            value: `${activityLogs.length} total log${activityLogs.length === 1 ? '' : 's'}`,
            actionLabel: 'Open Logs',
            icon: <FaHistory className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/activity-logs'),
        },
        {
            title: 'Medical Summary',
            description: 'Jump straight to your medical profile and latest treatment information.',
            value: patientName,
            actionLabel: 'Open Summary',
            icon: <FaBookMedical className={adminStyles['widget-icon']} />,
            action: () => navigate('/patient/records'),
        },
    ];

    return (
        <AdminDashboardPage
            title="Patient Dashboard"
            currentTime={currentTime}
            subtitle={assignedBranch}
            notificationPath="/patient/notifications"
            unreadCount={unreadCount}
            navigate={navigate}
        >

            <div className={adminStyles['stats-grid']}>
                <div className={adminStyles['stat-card']}>
                    <div className={adminStyles['stat-header']}>
                        <p className={adminStyles['stat-title']}>Upcoming Schedule</p>
                        <div className={`${adminStyles['stat-icon-wrapper']} ${adminStyles['bg-cyan']}`}>
                            <FaCalendarCheck className={adminStyles['widget-icon']} />
                        </div>
                    </div>
                    <div className={adminStyles['stat-value-wrapper']}>
                        <h2 className={adminStyles['stat-value']}>{activeSchedules.length}</h2>
                        <span className={`${adminStyles['trend-indicator']} ${upcomingAppointment ? adminStyles['trend-positive'] : adminStyles['trend-neutral']}`}>
                            {upcomingAppointment ? 'Active' : 'Open'}
                        </span>
                    </div>
                    <p className={`${adminStyles['stat-desc']} ${adminStyles.neutral}`}>
                        {upcomingAppointment ? 'Your next visit is already scheduled.' : 'You can request your next visit any time.'}
                    </p>
                </div>

                <div className={adminStyles['stat-card']}>
                    <div className={adminStyles['stat-header']}>
                        <p className={adminStyles['stat-title']}>Assigned Branch</p>
                        <div className={`${adminStyles['stat-icon-wrapper']} ${adminStyles['bg-green']}`}>
                            <FaUserCircle className={adminStyles['widget-icon']} />
                        </div>
                    </div>
                    <div className={adminStyles['stat-value-wrapper']}>
                        <h2 className={adminStyles['stat-value']}>{assignedBranch}</h2>
                    </div>
                    <p className={`${adminStyles['stat-desc']} ${adminStyles.neutral}`}>
                        {todayActiveCount} active schedule{todayActiveCount === 1 ? '' : 's'} today.
                    </p>
                </div>

                <div className={adminStyles['stat-card']}>
                    <div className={adminStyles['stat-header']}>
                        <p className={adminStyles['stat-title']}>Unread Notifications</p>
                        <div className={`${adminStyles['stat-icon-wrapper']} ${adminStyles['bg-pink']}`}>
                            <FaBell className={adminStyles['widget-icon']} />
                        </div>
                    </div>
                    <div className={adminStyles['stat-value-wrapper']}>
                        <h2 className={adminStyles['stat-value']}>{unreadCount}</h2>
                        <span className={`${adminStyles['trend-indicator']} ${unreadCount ? adminStyles['trend-negative'] : adminStyles['trend-positive']}`}>
                            {unreadCount ? 'Unread' : 'Clear'}
                        </span>
                    </div>
                    <p className={`${adminStyles['stat-desc']} ${adminStyles.neutral}`}>Tap the bell to review reminders and clinic updates.</p>
                </div>
            </div>

            <div className={adminStyles['main-grid']}>
                <div className={adminStyles['left-column']}>
                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <FaCalendarAlt className={adminStyles['widget-icon']} />
                            <h2 className={adminStyles['widget-title']}>Next Appointment</h2>
                        </div>
                        {loading ? (
                            <div className={patientStyles.loaderBox}>
                                <span className={patientStyles.loaderText}>Loading your dashboard...</span>
                            </div>
                        ) : appointmentError ? (
                            <PatientEmptyState
                                icon={<FaCalendarAlt />}
                                title="Schedule details unavailable"
                                message={appointmentError}
                                action={(
                                    <button type="button" className={patientStyles.buttonSecondary} onClick={fetchDashboard}>
                                        Try Again
                                    </button>
                                )}
                            />
                        ) : upcomingAppointment ? (
                            <div className={patientStyles.dashboardAppointmentPanel}>
                                <div className={patientStyles.dashboardAppointmentMain}>
                                    <p className={patientStyles.dashboardAppointmentEyebrow}>Scheduled Visit</p>
                                    <h2 className={patientStyles.dashboardAppointmentTitle}>
                                        {upcomingAppointment.procedure || 'Upcoming Appointment'}
                                    </h2>
                                    <p className={patientStyles.dashboardAppointmentText}>
                                        {getDentistLabel(upcomingAppointment)} on {formatDateDisplay(upcomingAppointment.date, { weekday: 'short' })}
                                        {upcomingAppointment.time ? ` at ${formatTime24(upcomingAppointment.time)}` : ''}.
                                    </p>
                                    <div className={patientStyles.detailPills}>
                                        <span className={patientStyles.detailPill}>{assignedBranch}</span>
                                        <PatientStatusBadge status={upcomingAppointment.status} />
                                    </div>
                                </div>
                                <div className={patientStyles.dashboardAppointmentAside}>
                                    <span className={patientStyles.dashboardAsideLabel}>Visit Date</span>
                                    <strong className={patientStyles.dashboardAsideValue}>{formatDateDisplay(upcomingAppointment.date, { month: 'long' })}</strong>
                                    <span className={patientStyles.dashboardAsideLabel}>Visit Time</span>
                                    <strong className={patientStyles.dashboardAsideValue}>
                                        {upcomingAppointment.time ? formatTime24(upcomingAppointment.time) : 'To be confirmed'}
                                    </strong>
                                </div>
                            </div>
                        ) : (
                            <PatientEmptyState
                                icon={<FaCalendarAlt />}
                                title="No upcoming appointment"
                                message="Your next schedule will appear here as soon as your booking becomes active."
                                action={(
                                    <button type="button" className={patientStyles.buttonPrimary} onClick={() => navigate('/patient/book')}>
                                        Book Appointment
                                    </button>
                                )}
                            />
                        )}
                    </section>

                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <FaUserCircle className={adminStyles['widget-icon']} />
                            <h2 className={adminStyles['widget-title']}>Patient Shortcuts</h2>
                        </div>
                        <div className={adminStyles.moduleGrid}>
                            {shortcutCards.map((item) => (
                                <article key={item.title} className={adminStyles.moduleCard}>
                                    <div className={adminStyles.moduleHeader}>
                                        {item.icon}
                                        <div>
                                            <h3 className={adminStyles.moduleTitle}>{item.title}</h3>
                                            <p className={adminStyles.moduleValue}>{item.value}</p>
                                        </div>
                                    </div>
                                    <p className={adminStyles.moduleDescription}>{item.description}</p>
                                    <button type="button" className={adminStyles.quickLinkBtn} onClick={item.action}>
                                        {item.actionLabel}
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <FaRobot className={adminStyles['widget-icon']} />
                            <h2 className={adminStyles['widget-title']}>More Patient Shortcuts</h2>
                        </div>
                        <div className={adminStyles.moduleGrid}>
                            {supportCards.map((item) => (
                                <article key={item.title} className={adminStyles.moduleCard}>
                                    <div className={adminStyles.moduleHeader}>
                                        {item.icon}
                                        <div>
                                            <h3 className={adminStyles.moduleTitle}>{item.title}</h3>
                                            <p className={adminStyles.moduleValue}>{item.value}</p>
                                        </div>
                                    </div>
                                    <p className={adminStyles.moduleDescription}>{item.description}</p>
                                    <button type="button" className={adminStyles.quickLinkBtn} onClick={item.action}>
                                        {item.actionLabel}
                                    </button>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <FaHistory className={adminStyles['widget-icon']} />
                            <h2 className={adminStyles['widget-title']}>Activity Logs</h2>
                            <span className={adminStyles['view-all']} onClick={() => navigate('/patient/activity-logs')}>View All</span>
                        </div>
                        {activityPreview.length ? (
                            <div className={adminStyles.compactList}>
                                {activityPreview.map((item, index) => (
                                    <article key={item._id || `${item.action}-${index}`} className={adminStyles.activityItem}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                            <div className={adminStyles['timeline-dot']}><FaUserClock /></div>
                                            <div>
                                                <p className={adminStyles.compactTitle}>{formatActionLabel(item.action)}</p>
                                                <p className={adminStyles.compactText}>{item.details || 'No additional details recorded.'}</p>
                                            </div>
                                        </div>
                                        <span className={adminStyles.compactMeta}>
                                            {item.timestamp ? `${formatDateShort(item.timestamp)}, ${formatTime(item.timestamp)}` : 'Just now'}
                                        </span>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className={adminStyles['empty-state']}>No activity logs available yet.</div>
                        )}
                    </section>
                </div>

                <div className={adminStyles['right-column']}>
                    <section className={adminStyles['calendar-card']}>
                        <div className={adminStyles['calendar-header']}>
                            <h3 className={adminStyles['month-text']}>
                                {currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <div className={adminStyles['cal-nav']}>
                                <button
                                    type="button"
                                    className={adminStyles['cal-nav-btn']}
                                    onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1))}
                                    aria-label="Previous month"
                                >
                                    <FaChevronLeft />
                                </button>
                                <button
                                    type="button"
                                    className={adminStyles['cal-nav-btn']}
                                    onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1))}
                                    aria-label="Next month"
                                >
                                    <FaChevronRight />
                                </button>
                            </div>
                        </div>

                        <div className={adminStyles['calendar-grid']}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                <div key={day} className={adminStyles['day-name']}>{day}</div>
                            ))}

                            {calendarDays.map((day, index) => (
                                <div
                                    key={`${day.date.toISOString()}-${index}`}
                                    title={day.holidayName || ''}
                                    onClick={() => {
                                        setSelectedDate(day.date);
                                        if (day.faded) {
                                            setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
                                        }
                                    }}
                                    className={`
                                        ${adminStyles['date-num']}
                                        ${day.faded ? adminStyles.faded : ''}
                                        ${day.isToday && !day.faded ? adminStyles.today : ''}
                                        ${day.active ? adminStyles.active : ''}
                                        ${day.isHoliday && !day.faded ? adminStyles.holiday : ''}
                                    `}
                                >
                                    {day.num}
                                    {day.hasEvent ? (
                                        <div className={`${adminStyles['event-dot']} ${day.active ? adminStyles.white : ''}`}></div>
                                    ) : null}
                                </div>
                            ))}
                        </div>

                        <div className={adminStyles['holiday-panel']}>
                            <p className={adminStyles['holiday-heading']}>Holidays This Month</p>
                            {visibleHolidays.length ? (
                                <div className={adminStyles['holiday-list']}>
                                    {visibleHolidays.map((holiday) => (
                                        <div key={`${holiday.month}-${holiday.day}`} className={adminStyles['holiday-item']}>
                                            <span className={adminStyles['holiday-date']}>{holiday.day}</span>
                                            <span className={adminStyles['holiday-name']}>{holiday.name}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={adminStyles['holiday-empty']}>No fixed holidays in this month.</p>
                            )}
                        </div>
                    </section>

                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <h2 className={adminStyles['widget-title']}>Pending Schedules for {selectedDateLabel}</h2>
                            <span className={adminStyles['view-all']} onClick={() => navigate('/patient/appointments')}>View All</span>
                        </div>
                        <div className={adminStyles['list-content']}>
                            {selectedDateSchedules.length ? (
                                selectedDateSchedules.map((item) => (
                                    <div key={item._id} className={adminStyles['appointment-item-compact']}>
                                        <div className={adminStyles['time-block']}>
                                            <p className={adminStyles['time-text']}>
                                                {item.time ? formatTime24(item.time) : 'Time pending'}
                                            </p>
                                            <span className={`${adminStyles['status-badge']} ${
                                                String(item.status).toLowerCase() === 'pending'
                                                    ? adminStyles['status-pending']
                                                    : String(item.status).toLowerCase() === 'in-clinic'
                                                        ? adminStyles['status-in-clinic']
                                                        : adminStyles['status-neutral']
                                            }`}
                                            >
                                                {String(item.status || 'pending').toLowerCase() === 'in-clinic'
                                                    ? 'In Clinic'
                                                    : formatActionLabel(item.status || 'pending')}
                                            </span>
                                        </div>
                                        <div className={adminStyles['patient-block']}>
                                            <p className={adminStyles['patient-name']}>{item.procedure || 'Upcoming Visit'}</p>
                                            <p className={adminStyles['treatment-type']}>{assignedBranch}</p>
                                            <p className={adminStyles['dentist-name']}>{getDentistLabel(item)}</p>
                                        </div>
                                    </div>
                                ))
                            ) : loading ? (
                                <div className={adminStyles['empty-state']}>Loading schedules...</div>
                            ) : (
                                <div className={adminStyles['empty-state']}>
                                    No pending schedules on {selectedDateLabel}.
                                </div>
                            )}
                        </div>
                    </section>

                    <section className={adminStyles['widget-card']}>
                        <div className={adminStyles['widget-header']}>
                            <FaTooth className={adminStyles['widget-icon']} />
                            <h2 className={adminStyles['widget-title']}>Care Window</h2>
                        </div>
                        <div className={adminStyles['summary-slab']}>
                            <article className={adminStyles['slab-item']}>
                                <span className={adminStyles['slab-label']}>Current Window</span>
                                <strong className={adminStyles['slab-value']}>{oralCarePreview.hero.windowLabel}</strong>
                            </article>
                            <article className={adminStyles['slab-item']}>
                                <span className={adminStyles['slab-label']}>Recommended</span>
                                <strong className={adminStyles['slab-value']}>{oralCarePreview.hero.recommendedDateLabel}</strong>
                            </article>
                            <article className={adminStyles['slab-item']}>
                                <span className={adminStyles['slab-label']}>Status</span>
                                <strong className={adminStyles['slab-value']}>{oralCarePreview.hero.statusLabel}</strong>
                            </article>
                        </div>
                        <p className={adminStyles.compactText} style={{ marginTop: '14px' }}>
                            {oralCarePreview.hero.suggestedNextAction}
                        </p>
                    </section>
                </div>
            </div>
        </AdminDashboardPage>
    );
}
