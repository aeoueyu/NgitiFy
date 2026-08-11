import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaCalendarPlus,
    FaClipboardList,
    FaClock,
    FaExclamationTriangle,
    FaListUl,
    FaUserFriends,
    FaUserPlus,
    FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import { normalizeBranchLabel } from '../../utils/addressHelpers';
import styles from '../../styles/admin/AdminDashboard.module.css';
import { AdminDashboardPage } from '../../components/dashboard/AdminDashboardComponents';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: 'Araw ng Kagitingan' },
    { month: 4, day: 1, name: 'Labor Day' },
    { month: 5, day: 12, name: 'Independence Day' },
    { month: 11, day: 25, name: 'Christmas Day' },
    { month: 11, day: 31, name: "New Year's Eve" },
];

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const getAppointmentPatientName = (entry) => {
    const registeredPatientName = entry.patient?.name
        ? `${entry.patient.name.first || ''} ${entry.patient.name.last || ''}`.trim()
        : '';

    return registeredPatientName
        || entry.guestName
        || entry.patient?.email
        || entry.guestEmail
        || 'Unknown Patient';
};

const normalizeAppointment = (entry) => ({
    id: entry._id,
    patientName: getAppointmentPatientName(entry),
    dentistName: entry.dentist?.name
        ? `Dr. ${entry.dentist.name.first || ''} ${entry.dentist.name.last || ''}`.trim()
        : 'Unassigned',
    procedure: entry.procedure || 'Consultation',
    branch: entry.branch || '',
    status: entry.status || 'pending',
    time: entry.time || '',
    rawDate: new Date(entry.date),
});

const formatStatus = (status) => {
    if (!status) return 'Pending';
    if (status === 'in-clinic') return 'In Clinic';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function BranchManagerDashboard() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [queueEntries, setQueueEntries] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showAlertBanner, setShowAlertBanner] = useState(true);

    const assignedBranch = normalizeBranchLabel(user?.assignedBranch || '');

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const toUsers = (payload) => (
            Array.isArray(payload?.users) ? payload.users : (Array.isArray(payload) ? payload : [])
        );

        const fetchDashboardData = async () => {
            try {
                const userId = user?.userId || user?.id || user?._id;
                const [
                    appointmentsRes,
                    patientsRes,
                    notificationsRes,
                    inventoryRes,
                    activityRes,
                    queueRes,
                    dentistsRes,
                    secretariesRes,
                ] = await Promise.all([
                    authFetch('/appointments'),
                    authFetch('/patients'),
                    authFetch('/notifications'),
                    authFetch('/inventory'),
                    userId ? authFetch(`/audit-logs?userId=${userId}`) : Promise.resolve(null),
                    authFetch('/queue'),
                    authFetch('/users?role=dentist'),
                    authFetch('/users?role=secretary'),
                ]);

                if (appointmentsRes?.ok) {
                    const data = await appointmentsRes.json();
                    setAppointments(data.map(normalizeAppointment).sort((a, b) => a.rawDate - b.rawDate));
                }

                if (patientsRes?.ok) {
                    const data = await patientsRes.json();
                    const patientList = Array.isArray(data) ? data : (data.patients || []);
                    setPatients(patientList);
                }

                if (notificationsRes?.ok) {
                    setNotifications(await notificationsRes.json());
                }

                if (inventoryRes?.ok) {
                    setInventory(await inventoryRes.json());
                }

                if (activityRes?.ok) {
                    setActivityLogs(await activityRes.json());
                }

                if (queueRes?.ok) {
                    setQueueEntries(await queueRes.json());
                }

                const [dentistsPayload, secretariesPayload] = await Promise.all([
                    dentistsRes?.ok ? dentistsRes.json() : Promise.resolve([]),
                    secretariesRes?.ok ? secretariesRes.json() : Promise.resolve([]),
                ]);

                setStaffUsers([
                    ...toUsers(dentistsPayload).filter((entry) => entry.role === 'dentist'),
                    ...toUsers(secretariesPayload).filter((entry) => entry.role === 'secretary'),
                ]);
            } catch (error) {
                console.error('Branch manager dashboard fetch error:', error);
                addToast('Failed to load branch manager dashboard data.', 'error');
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
        () => appointments.filter((appointment) => startOfDay(appointment.rawDate).getTime() === startOfDay(selectedDate).getTime()),
        [appointments, selectedDate]
    );

    const todaysAppointments = useMemo(
        () => appointments.filter((appointment) => startOfDay(appointment.rawDate).getTime() === startOfDay(new Date()).getTime()),
        [appointments]
    );

    const pendingAppointments = useMemo(
        () => appointments.filter((appointment) => appointment.status === 'pending').length,
        [appointments]
    );

    const unreadNotifications = useMemo(
        () => notifications.filter((item) => !item.isRead).length,
        [notifications]
    );

    const waitingQueue = useMemo(
        () => queueEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'serving').length,
        [queueEntries]
    );

    const lowStockItems = useMemo(
        () => inventory.filter((item) => {
            const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
            const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
            return stock <= limit;
        }),
        [inventory]
    );

    const activityLogsToday = useMemo(() => {
        const todayKey = new Date().toDateString();
        return activityLogs.filter((log) => new Date(log.timestamp || log.createdAt).toDateString() === todayKey).length;
    }, [activityLogs]);

    const priorityAlertsCount = pendingAppointments + unreadNotifications + lowStockItems.length;
    const branchLabel = assignedBranch || 'Assigned Branch';
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

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
                hasEvent: appointments.some((appointment) => appointment.rawDate.toDateString() === currentDate.toDateString()),
                isHoliday: !!holiday,
                holidayName: holiday?.name || '',
                date: currentDate,
                faded: false,
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        for (let i = 1; i <= totalCells - days.length; i += 1) {
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

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
        <AdminDashboardPage
            title="Branch Manager Dashboard"
            currentTime={currentTime}
            subtitle={`${branchLabel} overview for appointments, branch staff, patients, and queue operations.`}
            notificationPath="/branch-manager/notifications"
            unreadCount={unreadNotifications}
            navigate={navigate}
        >

            {priorityAlertsCount > 0 && showAlertBanner && (
                <div className={styles['alert-banner']}>
                    <div className={styles['alert-content']}>
                        <FaExclamationTriangle style={{ fontSize: '16px' }} />
                        <span>
                            {priorityAlertsCount} branch item{priorityAlertsCount !== 1 ? 's need' : ' needs'} attention across pending appointments,
                            unread notifications, and low-stock supplies.
                        </span>
                    </div>
                    <button className={styles['alert-close-btn']} onClick={() => setShowAlertBanner(false)} aria-label="Close Alert">
                        x
                    </button>
                </div>
            )}

            <section className={styles['stats-grid']}>
                <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/branch-manager/schedule')}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Today's Appointments</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                            <FaClipboardList className={styles['stat-icon']} />
                        </div>
                    </div>
                    <div className={styles['stat-value-wrapper']}>
                        <h2 className={styles['stat-value']}>{todaysAppointments.length}</h2>
                        <span className={`${styles['trend-indicator']} ${pendingAppointments > 0 ? styles['trend-negative'] : styles['trend-positive']}`}>
                            {pendingAppointments > 0 ? `${pendingAppointments} Pending` : 'Ready'}
                        </span>
                    </div>
                    <p className={styles['stat-desc']}>Visits scheduled under {branchLabel}</p>
                </button>

                <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/branch-manager/patients')}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Branch Patients</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                            <FaUserFriends className={styles['stat-icon']} />
                        </div>
                    </div>
                    <div className={styles['stat-value-wrapper']}>
                        <h2 className={styles['stat-value']}>{patients.length}</h2>
                        <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`}>
                            Active
                        </span>
                    </div>
                    <p className={`${styles['stat-desc']} ${styles.neutral}`}>Registered under your assigned branch</p>
                </button>

                <button type="button" className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/branch-manager/manage-staffs')}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Branch Staff</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}>
                            <FaUsers className={styles['stat-icon']} />
                        </div>
                    </div>
                    <div className={styles['stat-value-wrapper']}>
                        <h2 className={styles['stat-value']}>{staffUsers.length}</h2>
                        <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`}>
                            Team
                        </span>
                    </div>
                    <p className={`${styles['stat-desc']} ${styles.neutral}`}>{waitingQueue} currently active in queue</p>
                </button>
            </section>

            <section className={styles['main-grid']}>
                <div className={styles['left-column']}>
                    <div className={styles['widget-card']}>
                        <div className={styles['widget-header']}>
                            <h2 className={styles['widget-title']}>
                                <FaClipboardList className={styles['widget-icon']} />
                                {isTodaySelected ? "Today's Branch Schedule" : `Branch Schedule: ${formatDateShort(selectedDate)}`}
                            </h2>
                        </div>

                        <div className={styles['list-content']}>
                            {displayedAppointments.length > 0 ? (
                                displayedAppointments.map((appointment) => (
                                    <div key={appointment.id} className={styles['appointment-item']}>
                                        <div className={styles['time-block']}>
                                            <p className={styles['time-text']}>{appointment.time || formatTime(appointment.rawDate)}</p>
                                            <p className={styles['meta-line']}>
                                                <FaClock style={{ fontSize: '10px' }} />
                                                {branchLabel}
                                            </p>
                                        </div>

                                        <div className={styles['patient-block']}>
                                            <p className={styles['patient-name']}>{appointment.patientName}</p>
                                            <p className={styles['dentist-name']}>{appointment.dentistName}</p>
                                            <p className={styles['treatment-type']}>{appointment.procedure}</p>
                                        </div>

                                        <div className={styles['action-block']}>
                                            <span className={`${styles['status-badge']} ${getStatusClass(formatStatus(appointment.status))}`}>
                                                {formatStatus(appointment.status)}
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

                    <div className={styles['widget-card']}>
                        <div className={styles['widget-header']}>
                            <h2 className={styles['widget-title']}>
                                <FaBell className={styles['widget-icon']} />
                                Branch Summary
                            </h2>
                        </div>

                        <div className={styles['quick-grid']}>
                            <div className={styles['quick-card']}>
                                <span className={styles['quick-label']}>Unread Notifications</span>
                                <strong className={styles['quick-value']}>{unreadNotifications}</strong>
                                <p className={styles['quick-text']}>Alerts and updates still waiting for branch review.</p>
                            </div>
                            <div className={styles['quick-card']}>
                                <span className={styles['quick-label']}>Live Queue</span>
                                <strong className={styles['quick-value']}>{waitingQueue}</strong>
                                <p className={styles['quick-text']}>Patients currently waiting or being served in your branch.</p>
                            </div>
                            <div className={styles['quick-card']}>
                                <span className={styles['quick-label']}>Low Stock Items</span>
                                <strong className={styles['quick-value']}>{lowStockItems.length}</strong>
                                <p className={styles['quick-text']}>Items at or below the reorder threshold for branch operations.</p>
                            </div>
                        </div>
                    </div>

                    <div className={`${styles['widget-card']} ${styles.clickable}`} onClick={() => navigate('/branch-manager/activity-logs')}>
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
                                <span className={styles['slab-label']}>Pending appointments</span>
                                <strong className={styles['slab-value']}>{pendingAppointments}</strong>
                            </div>
                            <div className={styles['slab-item']}>
                                <span className={styles['slab-label']}>Branch staff</span>
                                <strong className={styles['slab-value']}>{staffUsers.length}</strong>
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
                                <FaListUl className={styles['widget-icon']} />
                                Latest Branch Alerts
                            </h2>
                            <span className={styles['view-all']} onClick={() => navigate('/branch-manager/notifications')}>View All</span>
                        </div>
                        <div className={styles['list-content']}>
                            {notifications.length > 0 ? (
                                notifications.slice(0, 6).map((notification) => (
                                    <div key={notification._id} className={styles['appointment-item-compact']}>
                                        <div className={styles['patient-details']}>
                                            <p className={styles['patient-name']}>{notification.title || 'Notification'}</p>
                                            <p className={styles['treatment-type']}>{notification.message || 'No message provided.'}</p>
                                        </div>
                                        <div className={styles['appointment-time']}>
                                            <p className={styles['time-text']}>{formatDateShort(notification.createdAt || notification.updatedAt || new Date())}</p>
                                            {!notification.isRead && (
                                                <span className={`${styles['status-badge']} ${styles['status-in-clinic']}`}>
                                                    Unread
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles['empty-state']}>
                                    <p>No branch notifications yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className={styles['quick-actions-bar']}>
                <button
                    className={`${styles['quick-action-btn']} ${styles.secondary}`}
                    onClick={() => navigate('/branch-manager/patients', { state: { openAddModal: true } })}
                >
                    <FaUserPlus /> Add Patient
                </button>
                <button
                    className={styles['quick-action-btn']}
                    onClick={() => navigate('/branch-manager/schedule')}
                >
                    <FaCalendarPlus /> Manage Schedule
                </button>
            </div>
        </AdminDashboardPage>
    );
}
