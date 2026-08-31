import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/AdminDashboard.module.css';
import {
    FaBoxes,
    FaCalendarPlus,
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaFileMedical,
    FaHistory,
    FaRegCalendarCheck,
    FaTooth,
    FaUserInjured,
} from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import { useAuth } from '../../hooks/useAuth';
import { AdminDashboardPage } from '../../components/dashboard/AdminDashboardComponents';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: 'Araw ng Kagitingan' },
    { month: 4, day: 1, name: 'Labor Day' },
    { month: 5, day: 12, name: 'Independence Day' },
    { month: 11, day: 25, name: 'Christmas Day' },
    { month: 11, day: 31, name: "New Year's Eve" },
];

const normalizeAppointment = (entry) => ({
    id: entry._id,
    patientId: entry.patient?._id || entry.patient,
    patientName: entry.patient?.name
        ? `${entry.patient.name.first || ''} ${entry.patient.name.last || ''}`.trim()
        : (entry.guestName || 'Unknown Patient'),
    procedure: entry.procedure || 'Unspecified Procedure',
    time: entry.time || '',
    rawDate: new Date(entry.date),
    status: entry.status || 'pending',
});

const startOfDay = (dateValue) => {
    const date = new Date(dateValue);
    date.setHours(0, 0, 0, 0);
    return date;
};

const formatStatus = (status) => {
    if (!status) return 'Pending';
    if (status === 'in-clinic') return 'In Clinic';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function DentistDashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [profile, setProfile] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [materialLogs, setMaterialLogs] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const userId = user?.userId || user?.id || user?._id;

                const requests = [
                    userId ? authFetch(`/user/${userId}`) : Promise.resolve(null),
                    authFetch('/appointments'),
                    authFetch('/patients?limit=200'),
                    authFetch('/notifications'),
                    authFetch('/material-usage'),
                    userId ? authFetch(`/audit-logs?userId=${userId}`) : Promise.resolve(null),
                ];

                const [profileRes, surgeriesRes, patientsRes, notificationsRes, materialsRes, auditRes] = await Promise.all(requests);

                if (profileRes?.ok) {
                    setProfile(await profileRes.json());
                }

                if (surgeriesRes?.ok) {
                    const data = await surgeriesRes.json();
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

                if (materialsRes?.ok) {
                    setMaterialLogs(await materialsRes.json());
                }

                if (auditRes?.ok) {
                    setActivityLogs(await auditRes.json());
                }
            } catch (error) {
                console.error('Dentist dashboard fetch error:', error);
                addToast('Failed to load dentist dashboard data.', 'error');
            } finally {
                setIsLoading(false);
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

    const todayAppointments = useMemo(() => {
        const todayKey = startOfDay(new Date()).getTime();
        return appointments.filter((item) => startOfDay(item.rawDate).getTime() === todayKey);
    }, [appointments]);

    const selectedDateAppointments = useMemo(() => {
        const selectedKey = startOfDay(selectedDate).getTime();
        return appointments
            .filter((item) => startOfDay(item.rawDate).getTime() === selectedKey)
            .sort((a, b) => a.rawDate - b.rawDate);
    }, [appointments, selectedDate]);

    const unreadNotifications = notifications.filter((item) => !item.isRead).length;

    const materialLogsThisMonth = useMemo(() => {
        const now = new Date();
        return materialLogs.filter((log) => {
            const logDate = new Date(log.usedAt || log.createdAt);
            return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
        }).length;
    }, [materialLogs]);

    const dentistName = profile?.name?.first
        ? `Dr. ${profile.name.first} ${profile.name.last || ''}`.trim()
        : 'Dentist';

    const recentActivity = activityLogs.slice(0, 5);

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
            const dateKey = startOfDay(currentDate).getTime();
            const isSelected = dateKey === startOfDay(selectedDate).getTime();
            const isToday = dateKey === startOfDay(new Date()).getTime();
            const hasEvent = appointments.some((entry) => startOfDay(entry.rawDate).getTime() === dateKey);
            const holidayObj = PH_HOLIDAYS.find((holiday) => holiday.month === month && holiday.day === i);

            days.push({
                num: i,
                active: isSelected,
                isToday,
                hasEvent,
                isHoliday: Boolean(holidayObj),
                holidayName: holidayObj?.name || null,
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

    const calendarDays = getCalendarDays();
    const monthLabel = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();
    const visibleHolidays = PH_HOLIDAYS.filter((holiday) => holiday.month === currentMonthView.getMonth());
    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    const handleDateClick = (day) => {
        setSelectedDate(day.date);
        if (day.faded) {
            setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
        }
    };

    return (
        <>
            <AdminDashboardPage
                title="Dentist Dashboard"
                currentTime={currentTime}
                subtitle={`${dentistName} overview for appointments, EMR access, materials, and clinical follow-ups.`}
                notificationPath="/dentist/notifications"
                unreadCount={unreadNotifications}
                navigate={navigate}
            >

                <div className={styles['stats-grid']}>
                    <div className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/dentist/appointments')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Today&apos;s Appointments</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                                <FaRegCalendarCheck className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{todayAppointments.length}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-positive']}`}>
                                <FaCheckCircle style={{ fontSize: '10px' }} /> Active
                            </span>
                        </div>
                        <p className={styles['stat-desc']}>Scheduled under your care today</p>
                    </div>

                    <div className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/dentist/patients')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Assigned Patients</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                                <FaUserInjured className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{patients.length}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`}>EMR</span>
                        </div>
                        <p className={`${styles['stat-desc']} ${styles.neutral}`}>Patients whose EMRs you can access</p>
                    </div>

                    <div className={`${styles['stat-card']} ${styles.clickable}`} onClick={() => navigate('/dentist/material-usage')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Material Usage Logs</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}>
                                <FaBoxes className={styles['stat-icon']} />
                            </div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{materialLogsThisMonth}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`}>This Mo</span>
                        </div>
                        <p className={`${styles['stat-desc']} ${styles.neutral}`}>{unreadNotifications} unread notifications</p>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    <div className={styles['left-column']}>
                        <section className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaCalendarAlt className={styles['widget-icon']} />
                                    Schedule for {formatDateShort(selectedDate)}
                                </h2>
                            </div>

                            <div className={styles['list-content']}>
                                {isLoading ? (
                                    <div className={styles['empty-state']}>Loading appointments...</div>
                                ) : selectedDateAppointments.length === 0 ? (
                                    <div className={styles['empty-state']}>No appointments scheduled for this date.</div>
                                ) : (
                                    selectedDateAppointments.map((appointment) => (
                                        <div key={appointment.id} className={styles['appointment-item']}>
                                            <div className={styles['time-block']}>
                                                <p className={styles['time-text']}>{appointment.time || formatTime(appointment.rawDate)}</p>
                                                <p className={styles['stat-desc']}>{formatStatus(appointment.status)}</p>
                                            </div>
                                            <div className={styles['patient-block']}>
                                                <p className={styles['patient-name']}>{appointment.patientName}</p>
                                                <p className={styles['treatment-type']}>{appointment.procedure}</p>
                                            </div>
                                            <div className={styles['action-block']}>
                                                <button
                                                    className={styles['emr-btn']}
                                                    onClick={() => navigate(`/dentist/patients/${appointment.patientId}/emr`)}
                                                    disabled={!appointment.patientId}
                                                >
                                                    <FaFileMedical /> View EMR
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaClipboardList className={styles['widget-icon']} />
                                    Clinical Work Summary
                                </h2>
                            </div>

                            <div className={styles['quick-grid']}>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Assigned Patients</span>
                                    <strong className={styles['quick-value']}>{patients.length}</strong>
                                    <p className={styles['quick-text']}>Patient records available for clinical review.</p>
                                </div>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Material Logs</span>
                                    <strong className={styles['quick-value']}>{materialLogsThisMonth}</strong>
                                    <p className={styles['quick-text']}>Consumable usage entries recorded this month.</p>
                                </div>
                                <div className={styles['quick-card']}>
                                    <span className={styles['quick-label']}>Unread Alerts</span>
                                    <strong className={styles['quick-value']}>{unreadNotifications}</strong>
                                    <p className={styles['quick-text']}>Notifications waiting for review.</p>
                                </div>
                            </div>
                        </section>

                        <section className={`${styles['widget-card']} ${styles.clickable}`} onClick={() => navigate('/dentist/activity-logs')}>
                            <div className={styles['widget-header']}>
                                <FaHistory className={styles['widget-icon']} />
                                <h2 className={styles['widget-title']}>Recent Account Activity</h2>
                            </div>

                            {recentActivity.length === 0 ? (
                                <div className={styles['empty-state']}>No activity logs available yet.</div>
                            ) : (
                                <ul className={styles.timeline}>
                                    {recentActivity.map((log) => (
                                        <li key={log._id} className={styles['timeline-item']}>
                                            <div className={styles['timeline-dot']}><FaTooth /></div>
                                            <div className={styles['timeline-content']}>
                                                <p className={styles['log-action']}>{log.action}</p>
                                                <div className={styles['log-meta']}>
                                                    <span className={styles['role-tag']}>dentist</span>
                                                    <span>{formatDateShort(log.timestamp || log.createdAt)}</span>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>

                    <div className={styles['right-column']}>
                        <section className={styles['calendar-card']}>
                            <div className={styles['calendar-header']}>
                                <h3 className={styles['month-text']}>{monthLabel}</h3>
                                <div className={styles['cal-nav']}>
                                    <button className={styles['cal-nav-btn']} onClick={handlePrevMonth}>&lt;</button>
                                    <button className={styles['cal-nav-btn']} onClick={handleNextMonth}>&gt;</button>
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
                                        onClick={() => handleDateClick(day)}
                                        className={`
                                            ${styles['date-num']}
                                            ${day.faded ? styles.faded : ''}
                                            ${day.isToday && !day.faded ? styles.today : ''}
                                            ${day.active ? styles.active : ''}
                                            ${day.isHoliday && !day.faded ? styles.holiday : ''}
                                        `}
                                    >
                                        {day.num}
                                        {day.hasEvent && <div className={`${styles['event-dot']} ${day.active ? styles.white : ''}`}></div>}
                                    </div>
                                ))}
                            </div>

                            <div className={styles['holiday-panel']}>
                                <p className={styles['holiday-heading']}>Holidays This Month</p>
                                {visibleHolidays.length > 0 ? (
                                    <div className={styles['holiday-list']}>
                                        {visibleHolidays.map((holiday) => (
                                            <div key={`${holiday.month}-${holiday.day}`} className={styles['holiday-item']}>
                                                <span className={styles['holiday-date']}>{holiday.day}</span>
                                                <span className={styles['holiday-name']}>{holiday.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={styles['holiday-empty']}>No fixed holidays in this month.</p>
                                )}
                            </div>
                        </section>

                        <section className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    {isTodaySelected ? "Today's Appointments" : `Appointments for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                </h2>
                                <span className={styles['view-all']} onClick={() => navigate('/dentist/appointments')}>View All</span>
                            </div>

                            <div className={styles['list-content']}>
                                {selectedDateAppointments.length > 0 ? (
                                    selectedDateAppointments.slice(0, 6).map((appointment) => (
                                        <div key={`mini-${appointment.id}`} className={styles['appointment-item']}>
                                            <div className={styles['patient-info']}>
                                                <div className={styles['patient-avatar']}>
                                                    {appointment.patientName.charAt(0).toUpperCase()}
                                                </div>
                                                <div className={styles['patient-details']}>
                                                    <p className={styles['patient-name']}>{appointment.patientName}</p>
                                                    <p className={styles['treatment-type']}>{appointment.procedure}</p>
                                                </div>
                                            </div>
                                            <div className={styles['appointment-time']}>
                                                <p className={styles['time-text']}>{appointment.time || formatTime(appointment.rawDate)}</p>
                                                <span className={`${styles['status-badge']} ${formatStatus(appointment.status) === 'Completed' ? styles['status-done'] : styles['status-pending']}`}>
                                                    {formatStatus(appointment.status)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : isLoading ? (
                                    <div className={styles['empty-state']}>Loading appointments...</div>
                                ) : (
                                    <div className={styles['empty-state']}>
                                        <p>No appointments scheduled for this date.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                <div className={styles['quick-actions-bar']} data-ngitibot-avoid>
                    <button
                        className={`${styles['quick-action-btn']} ${styles.secondary}`}
                        onClick={() => navigate('/dentist/patients')}
                    >
                        <FaFileMedical /> Manage Patients
                    </button>
                    <button
                        className={styles['quick-action-btn']}
                        onClick={() => navigate('/dentist/appointments')}
                    >
                        <FaCalendarPlus /> Manage Appointments
                    </button>
                </div>
            </AdminDashboardPage>
        </>
    );
}
