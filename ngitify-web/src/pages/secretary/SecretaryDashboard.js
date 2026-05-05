import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryDashboard.module.css';
import {
    FaBell,
    FaCalendarPlus,
    FaCheck,
    FaClipboardList,
    FaClock,
    FaExclamationTriangle,
    FaListUl,
    FaRegCalendarCheck,
    FaTimes,
    FaUserInjured,
    FaUserMd,
    FaUserPlus,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort, formatTime, formatWeekdayDate } from '../../utils/dateUtils';
import ConfirmModal from '../../components/common/ConfirmModal';
import PasswordChangeWarning from '../../components/common/PasswordChangeWarning';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: 'Araw ng Kagitingan' },
    { month: 4, day: 1, name: 'Labor Day' },
    { month: 5, day: 12, name: 'Independence Day' },
    { month: 11, day: 25, name: 'Christmas Day' },
    { month: 11, day: 31, name: "New Year's Eve" },
];

const STATUS_DISPLAY = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    'in-clinic': 'In Clinic',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export default function SecretaryDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [allAppointments, setAllAppointments] = useState([]);
    const [newRegistrations, setNewRegistrations] = useState(0);
    const [queueEntries, setQueueEntries] = useState([]);
    const [patientCount, setPatientCount] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [openChatTickets, setOpenChatTickets] = useState(0);
    const [activityLogsToday, setActivityLogsToday] = useState(0);
    const [showAlertBanner, setShowAlertBanner] = useState(true);
    const [checkInTarget, setCheckInTarget] = useState(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const userId = user?.userId || user?.id || user?._id;
                const todayKey = new Date().toDateString();

                const [statsRes, surgeriesRes, queueRes, patientsRes, notificationsRes, ticketsRes, logsRes] = await Promise.all([
                    authFetch('/dashboard/stats'),
                    authFetch('/appointments'),
                    authFetch('/queue'),
                    authFetch('/patients'),
                    authFetch('/notifications'),
                    authFetch('/support-tickets'),
                    userId ? authFetch(`/audit-logs?userId=${userId}`) : Promise.resolve(null),
                ]);

                if (statsRes?.ok) {
                    const statsData = await statsRes.json();
                    setNewRegistrations(statsData.newRegistrations ?? 0);
                }

                if (surgeriesRes?.ok) {
                    const surgeryData = await surgeriesRes.json();
                    const mappedAppointments = surgeryData.map((appointment) => ({
                        id: appointment._id,
                        patientId: appointment.patient?._id || '',
                        patientName: appointment.patient?.name
                            ? `${appointment.patient.name.first || ''} ${appointment.patient.name.last || ''}`.trim()
                            : (appointment.guestName || 'Unknown Patient'),
                        dentistName: appointment.dentist?.name
                            ? `Dr. ${appointment.dentist.name.first || ''} ${appointment.dentist.name.last || ''}`.trim()
                            : 'Unassigned',
                        procedure: appointment.procedure || 'Consultation',
                        time: appointment.time || formatTime(new Date(appointment.date)),
                        duration: appointment.duration || '-',
                        status: STATUS_DISPLAY[appointment.status] || appointment.status,
                        rawStatus: appointment.status,
                        rawDate: new Date(appointment.date),
                    }));
                    setAllAppointments(mappedAppointments.sort((a, b) => a.rawDate - b.rawDate));
                }

                if (queueRes?.ok) {
                    setQueueEntries(await queueRes.json());
                }

                if (patientsRes?.ok) {
                    const patientData = await patientsRes.json();
                    const patientList = Array.isArray(patientData) ? patientData : patientData.patients || [];
                    setPatientCount(patientList.length);
                }

                if (notificationsRes?.ok) {
                    const notificationData = await notificationsRes.json();
                    setUnreadNotifications(notificationData.filter((item) => !item.isRead).length);
                }

                if (ticketsRes?.ok) {
                    const ticketData = await ticketsRes.json();
                    const tickets = ticketData.tickets || [];
                    setOpenChatTickets(tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in-progress').length);
                }

                if (logsRes?.ok) {
                    const logData = await logsRes.json();
                    setActivityLogsToday(
                        logData.filter((log) => new Date(log.timestamp || log.createdAt).toDateString() === todayKey).length
                    );
                }
            } catch (error) {
                console.error('Dashboard Fetch Error:', error);
                addToast('Could not connect to the server.', 'error');
            }
        };

        fetchDashboardData();
        const intervalId = window.setInterval(fetchDashboardData, 30000);
        const handleFocus = () => fetchDashboardData();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchDashboardData();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [addToast, user]);

    const displayedAppointments = useMemo(
        () => allAppointments.filter((appointment) => appointment.rawDate.toDateString() === selectedDate.toDateString()),
        [allAppointments, selectedDate]
    );

    const todaysAppointments = useMemo(
        () => allAppointments.filter((appointment) => appointment.rawDate.toDateString() === new Date().toDateString()),
        [allAppointments]
    );

    const pendingConfirmations = useMemo(
        () => todaysAppointments.filter((appointment) => appointment.rawStatus === 'pending').length,
        [todaysAppointments]
    );

    const patientsWaiting = useMemo(
        () => todaysAppointments.filter((appointment) => ['pending', 'confirmed', 'in-clinic'].includes(appointment.rawStatus)).length,
        [todaysAppointments]
    );

    const queueSummary = useMemo(() => ({
        waiting: queueEntries.filter((entry) => entry.status === 'waiting').length,
        serving: queueEntries.filter((entry) => entry.status === 'serving').length,
        done: queueEntries.filter((entry) => entry.status === 'done').length,
        skipped: queueEntries.filter((entry) => entry.status === 'skipped').length,
        total: queueEntries.length,
    }), [queueEntries]);

    const priorityAlertsCount = pendingConfirmations + unreadNotifications + openChatTickets;

    const getCalendarDays = () => {
        const year = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = firstDay - 1; i >= 0; i -= 1) {
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });
        }

        for (let i = 1; i <= daysInMonth; i += 1) {
            const currentDate = new Date(year, month, i);
            const holiday = PH_HOLIDAYS.find((item) => item.month === month && item.day === i);
            days.push({
                num: i,
                active: currentDate.toDateString() === selectedDate.toDateString(),
                isToday: currentDate.toDateString() === new Date().toDateString(),
                hasEvent: allAppointments.some((appointment) => appointment.rawDate.toDateString() === currentDate.toDateString()),
                isHoliday: !!holiday,
                holidayName: holiday?.name || '',
                date: currentDate,
                faded: false,
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        const extra = totalCells - days.length;
        for (let i = 1; i <= extra; i += 1) {
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending':
            case 'Confirmed':
                return styles['status-pending'];
            case 'In Clinic':
                return styles['status-in-clinic'];
            case 'Completed':
                return styles['status-done'];
            default:
                return styles['status-neutral'];
        }
    };

    const handleConfirmCheckIn = async () => {
        if (!checkInTarget) return;
        setIsCheckingIn(true);
        try {
            const res = await authFetch(`/appointments/${checkInTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'in-clinic' }),
            });

            if (res.ok) {
                setAllAppointments((prev) => prev.map((appointment) => (
                    appointment.id === checkInTarget.id
                        ? { ...appointment, status: 'In Clinic', rawStatus: 'in-clinic' }
                        : appointment
                )));
                addToast(`${checkInTarget.patientName} has been successfully checked into the clinic.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to check in patient.', 'error');
            }
        } catch {
            addToast('Could not connect to server.', 'error');
        } finally {
            setIsCheckingIn(false);
            setCheckInTarget(null);
        }
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles.header}>
                    <div className={styles['header-left']}>
                        <h1 className={styles.title}>Front Desk Dashboard</h1>
                        <p className={styles.subtitle}>
                            {formatWeekdayDate(currentTime)}
                            <span className={styles.divider}>|</span>
                            <strong className={styles['time-accent']}>{formatTime(currentTime, true)}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        <button
                            className={styles['bell-btn']}
                            onClick={() => navigate('/secretary/notifications')}
                            aria-label="Notifications"
                        >
                            <FaBell className={styles['bell-icon']} />
                            {unreadNotifications > 0 && (
                                <span className={styles['bell-badge']}>
                                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                </span>
                            )}
                        </button>
                    </div>
                </header>
                <PasswordChangeWarning />

                {priorityAlertsCount > 0 && showAlertBanner && (
                    <div className={styles['alert-banner']}>
                        <div className={styles['alert-content']}>
                            <FaExclamationTriangle style={{ fontSize: '16px' }} />
                            <span>
                                You have {priorityAlertsCount} pending front desk item{priorityAlertsCount !== 1 ? 's' : ''} across notifications, confirmations, and live chat.
                            </span>
                        </div>
                        <button className={styles['alert-close-btn']} onClick={() => setShowAlertBanner(false)} aria-label="Close Alert">
                            <FaTimes />
                        </button>
                    </div>
                )}

                <section className={styles['stats-grid']}>
                    <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/secretary/appointments')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Today's Appointments</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                                <FaRegCalendarCheck className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{todaysAppointments.length}</h2>
                            <span className={`${styles['trend-indicator']} ${pendingConfirmations > 0 ? styles['trend-negative'] : styles['trend-positive']}`}>
                                {pendingConfirmations > 0 ? `${pendingConfirmations} Pending` : 'Ready'}
                            </span>
                        </div>
                        <p className={styles['stat-desc']}>Scheduled visits in your branch today</p>
                    </button>

                    <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/secretary/patients')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Branch Patients</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                                <FaUserInjured className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{patientCount}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`}>
                                {newRegistrations} New
                            </span>
                        </div>
                        <p className={`${styles['stat-desc']} ${styles.neutral}`}>Registered under your assigned branch</p>
                    </button>

                    <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/secretary/queue')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Live Queue</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}>
                                <FaListUl className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{queueSummary.total}</h2>
                            <span className={`${styles['trend-indicator']} ${queueSummary.waiting > 0 ? styles['trend-negative'] : styles['trend-positive']}`}>
                                {queueSummary.waiting > 0 ? `${queueSummary.waiting} Waiting` : 'Clear'}
                            </span>
                        </div>
                        <p className={`${styles['stat-desc']} ${queueSummary.waiting > 0 ? styles.danger : styles.neutral}`}>
                            {queueSummary.serving} serving, {queueSummary.done} done today
                        </p>
                    </button>
                </section>

                <section className={styles['main-grid']}>
                    <div className={styles['left-column']}>
                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaClipboardList className={styles['widget-icon']} />
                                    {isTodaySelected ? "Today's Clinic Schedule" : `Clinic Schedule: ${formatDateShort(selectedDate)}`}
                                </h2>
                            </div>

                            <div className={styles['list-content']}>
                                {displayedAppointments.length > 0 ? (
                                    displayedAppointments.map((appointment) => (
                                        <div key={appointment.id} className={styles['appointment-item']}>
                                            <div className={styles['time-block']}>
                                                <p className={styles['time-text']}>{appointment.time}</p>
                                                <p className={styles['meta-line']}>
                                                    <FaClock style={{ fontSize: '10px' }} />
                                                    {appointment.duration}
                                                </p>
                                            </div>

                                            <div className={styles['patient-block']}>
                                                <p className={styles['patient-name']}>{appointment.patientName}</p>
                                                <p className={styles['dentist-name']}>
                                                    <FaUserMd />
                                                    {appointment.dentistName}
                                                </p>
                                                <p className={styles['treatment-type']}>{appointment.procedure}</p>
                                            </div>

                                            <div className={styles['action-block']}>
                                                <span className={`${styles['status-badge']} ${getStatusClass(appointment.status)}`}>
                                                    {appointment.status}
                                                </span>

                                                {(appointment.rawStatus === 'confirmed' || appointment.rawStatus === 'pending') && (
                                                    <button
                                                        className={styles['checkin-btn']}
                                                        onClick={() => setCheckInTarget(appointment)}
                                                        title="Check In Patient"
                                                    >
                                                        <FaCheck />
                                                        Check In
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles['empty-state']}>
                                        <p>No appointments scheduled for this date.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaBell className={styles['widget-icon']} />
                                    Front Desk Summary
                                </h2>
                            </div>

                            <div className={styles['quick-grid']}>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Patients Waiting</span>
                                    <strong className={styles['quick-value']}>{patientsWaiting}</strong>
                                    <p className={styles['quick-text']}>Patients still waiting to be served or checked in.</p>
                                </div>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Unread Notifications</span>
                                    <strong className={styles['quick-value']}>{unreadNotifications}</strong>
                                    <p className={styles['quick-text']}>Booking updates and branch-level alerts waiting for review.</p>
                                </div>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Open Chat Tickets</span>
                                    <strong className={styles['quick-value']}>{openChatTickets}</strong>
                                    <p className={styles['quick-text']}>Patient inquiries currently escalated to live support.</p>
                                </div>
                            </div>
                        </div>

                        <div className={`${styles['widget-card']} ${styles.clickable}`} onClick={() => navigate('/secretary/activity-logs')}>
                            <div className={styles['widget-header']}>
                                <FaClipboardList className={styles['widget-icon']} />
                                <h2 className={styles['widget-title']}>Activity Snapshot</h2>
                            </div>
                            <div className={styles['summary-slab']}>
                                <div className={styles['slab-item']}>
                                    <span className={styles['slab-label']}>Today's logs</span>
                                    <strong className={styles['slab-value']}>{activityLogsToday}</strong>
                                </div>
                                <div className={styles['slab-item']}>
                                    <span className={styles['slab-label']}>Pending confirmations</span>
                                    <strong className={styles['slab-value']}>{pendingConfirmations}</strong>
                                </div>
                                <div className={styles['slab-item']}>
                                    <span className={styles['slab-label']}>New registrations</span>
                                    <strong className={styles['slab-value']}>{newRegistrations}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles['right-column']}>
                        <div className={styles['calendar-card']}>
                            <div className={styles['calendar-header']}>
                                <h3 className={styles['month-text']}>{dynamicMonthYear}</h3>
                                <div className={styles['cal-nav']}>
                                    <button className={styles['cal-nav-btn']} onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1))}>
                                        &lt;
                                    </button>
                                    <button className={styles['cal-nav-btn']} onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1))}>
                                        &gt;
                                    </button>
                                </div>
                            </div>

                            <div className={styles['calendar-grid']}>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                    <div key={day} className={styles['day-name']}>{day}</div>
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
                                        className={[
                                            styles['date-num'],
                                            day.faded ? styles.faded : '',
                                            day.isToday && !day.faded ? styles.today : '',
                                            day.active ? styles.active : '',
                                            day.isHoliday && !day.faded ? styles.holiday : '',
                                        ].join(' ')}
                                    >
                                        {day.num}
                                        {day.hasEvent && <div className={`${styles['event-dot']} ${day.active ? styles.white : ''}`} />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    {isTodaySelected ? "Today's Appointments" : `Appointments for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                </h2>
                                <span className={styles['view-all']} onClick={() => navigate('/secretary/appointments')}>View All</span>
                            </div>
                            <div className={styles['list-content']}>
                                {displayedAppointments.length > 0 ? (
                                    displayedAppointments.slice(0, 6).map((appointment) => (
                                        <div key={`mini-${appointment.id}`} className={styles['appointment-item-compact']}>
                                            <div className={styles['patient-details']}>
                                                <p className={styles['patient-name']}>{appointment.patientName}</p>
                                                <p className={styles['treatment-type']}>{appointment.procedure}</p>
                                            </div>
                                            <div className={styles['appointment-time']}>
                                                <p className={styles['time-text']}>{appointment.time}</p>
                                                <span className={`${styles['status-badge']} ${getStatusClass(appointment.status)}`}>
                                                    {appointment.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles['empty-state']}>
                                        <p>No appointments scheduled for this date.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <div className={styles['quick-actions-bar']}>
                    <button
                        className={`${styles['quick-action-btn']} ${styles.secondary}`}
                        onClick={() => navigate('/secretary/patients/add')}
                    >
                        <FaUserPlus /> Add Patient
                    </button>
                    <button
                        className={styles['quick-action-btn']}
                        onClick={() => navigate('/secretary/appointments')}
                    >
                        <FaCalendarPlus /> Manage Appointments
                    </button>
                </div>
            </main>

            <ConfirmModal
                isOpen={!!checkInTarget}
                title="Check In Patient"
                message={`Are you sure you want to mark ${checkInTarget?.patientName} as arrived and currently in the clinic?`}
                confirmText={isCheckingIn ? 'Checking In...' : 'Yes, Check In'}
                isDestructive={false}
                onConfirm={handleConfirmCheckIn}
                onCancel={() => setCheckInTarget(null)}
            />
        </>
    );
}
