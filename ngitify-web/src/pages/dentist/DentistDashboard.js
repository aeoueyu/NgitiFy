import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistDashboard.module.css';
import {
    FaBell,
    FaBoxes,
    FaCalendarAlt,
    FaClipboardList,
    FaFileMedical,
    FaRegCalendarCheck,
    FaRobot,
    FaTooth,
    FaUserInjured,
} from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime, formatWeekdayDate } from '../../utils/dateUtils';
import PatientEMR from './PatientEMR';
import PasswordChangeWarning from '../../components/common/PasswordChangeWarning';

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
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const storedUser = JSON.parse(localStorage.getItem('ngitify_user') || '{}');
                const userId = storedUser?.userId || storedUser?.id || storedUser?._id;

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
    }, [addToast]);

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

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        return appointments
            .filter((item) => item.rawDate >= startOfDay(now) && ['pending', 'confirmed', 'in-clinic'].includes(item.status))
            .slice(0, 4);
    }, [appointments]);

    const recentNotifications = notifications.slice(0, 4);
    const recentActivity = activityLogs.slice(0, 5);

    const moduleCards = [
        {
            title: 'Manage Patients',
            description: 'Open your assigned patients and update their EMR records from one place.',
            value: `${patients.length} assigned patients`,
            action: () => navigate('/dentist/patients'),
            actionLabel: 'Open Patients',
            icon: <FaFileMedical className={styles.widgetIcon} />,
        },
        {
            title: 'Material Usage',
            description: 'Track consumables used during procedures and support stock monitoring.',
            value: `${materialLogsThisMonth} logs this month`,
            action: () => navigate('/dentist/material-usage'),
            actionLabel: 'View Logs',
            icon: <FaBoxes className={styles.widgetIcon} />,
        },
        {
            title: 'Notifications',
            description: 'Review schedule changes and patient-related alerts tied to your assignments.',
            value: `${unreadNotifications} unread alerts`,
            action: () => navigate('/dentist/notifications'),
            actionLabel: 'Open Alerts',
            icon: <FaBell className={styles.widgetIcon} />,
        },
        {
            title: 'AI Assistant',
            description: 'Preview the staff AI workspace for faster guidance inside the system.',
            value: 'Frontend preview ready',
            action: () => navigate('/dentist/ai-assistant'),
            actionLabel: 'Open Preview',
            icon: <FaRobot className={styles.widgetIcon} />,
        },
    ];

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

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Dentist Dashboard</h1>
                        <p className={styles.subtitle}>
                            {formatWeekdayDate(currentTime)} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span>
                            <strong style={{ color: '#01538b' }}>{formatTime(currentTime, true)}</strong>
                        </p>
                        <p className={styles.subtitle} style={{ marginTop: '6px' }}>
                            {dentistName} overview for appointments, EMR access, materials, and clinical follow-ups.
                        </p>
                    </div>
                </header>
                <PasswordChangeWarning />

                <div className={styles['stats-grid']}>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Today&apos;s Appointments</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}>
                                <FaRegCalendarCheck className={`${styles['stat-icon']} ${styles.raw}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{todayAppointments.length}</h2>
                        <p className={styles['stat-desc']}>Scheduled under your care today</p>
                    </div>

                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Assigned Patients</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                                <FaUserInjured className={`${styles['stat-icon']} ${styles.raw}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{patients.length}</h2>
                        <p className={styles['stat-desc']}>Patients whose EMRs you can access</p>
                    </div>

                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Unread Notifications</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                                <FaBell className={`${styles['stat-icon']} ${styles.raw}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{unreadNotifications}</h2>
                        <p className={styles['stat-desc']}>Schedule and patient alerts awaiting review</p>
                    </div>

                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Material Usage Logs</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}>
                                <FaBoxes className={`${styles['stat-icon']} ${styles.raw}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{materialLogsThisMonth}</h2>
                        <p className={styles['stat-desc']}>Entries recorded this month</p>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    <div className={styles['left-column']}>
                        <section className={styles['widget-card']}>
                            <div className={styles.filterHeader}>
                                <h2 className={styles['widget-title']}>
                                    <FaCalendarAlt className={styles.widgetIcon} />
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
                                                    onClick={() => setSelectedPatientId(appointment.patientId)}
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
                            <div className={styles.filterHeader}>
                                <h2 className={styles['widget-title']}>
                                    <FaClipboardList className={styles.widgetIcon} />
                                    Module Summary
                                </h2>
                            </div>

                            <div className={styles.moduleGrid}>
                                {moduleCards.map((card) => (
                                    <article key={card.title} className={styles.moduleCard}>
                                        <div className={styles.moduleHeader}>
                                            {card.icon}
                                            <div>
                                                <h3 className={styles.moduleTitle}>{card.title}</h3>
                                                <p className={styles.moduleValue}>{card.value}</p>
                                            </div>
                                        </div>
                                        <p className={styles.moduleDescription}>{card.description}</p>
                                        <button className={styles.quickLinkBtn} onClick={card.action}>
                                            {card.actionLabel}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className={styles['right-column']}>
                        <section className={styles['calendar-card']}>
                            <div className={styles['calendar-header']}>
                                <h3 className={styles['month-text']}>{monthLabel}</h3>
                                <div className={styles['cal-nav']}>
                                    <button className={styles['cal-nav-btn']} onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1))}>&lt;</button>
                                    <button className={styles['cal-nav-btn']} onClick={() => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1))}>&gt;</button>
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
                        </section>

                        <section className={styles['widget-card']}>
                            <div className={styles.filterHeader}>
                                <h2 className={styles['widget-title']}>
                                    <FaBell className={styles.widgetIcon} />
                                    Notification Snapshot
                                </h2>
                            </div>

                            <div className={styles.compactList}>
                                {recentNotifications.length === 0 ? (
                                    <div className={styles['empty-state']}>No notifications yet.</div>
                                ) : (
                                    recentNotifications.map((notification) => (
                                        <div key={notification._id} className={styles.notificationItem}>
                                            <div>
                                                <p className={styles.compactTitle}>{notification.title}</p>
                                                <p className={styles.compactText}>{notification.message}</p>
                                            </div>
                                            {!notification.isRead && <span className={styles.helperPill}>Unread</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className={styles['widget-card']}>
                            <div className={styles.filterHeader}>
                                <h2 className={styles['widget-title']}>
                                    <FaTooth className={styles.widgetIcon} />
                                    Recent Account Activity
                                </h2>
                            </div>

                            <div className={styles.compactList}>
                                {recentActivity.length === 0 ? (
                                    <div className={styles['empty-state']}>No activity logs available yet.</div>
                                ) : (
                                    recentActivity.map((log) => (
                                        <div key={log._id} className={styles.activityItem}>
                                            <p className={styles.compactTitle}>{log.action}</p>
                                            <p className={styles.compactText}>{log.details}</p>
                                            <span className={styles.compactMeta}>{formatDateShort(log.timestamp || log.createdAt)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <section className={styles['widget-card']}>
                            <div className={styles.filterHeader}>
                                <h2 className={styles['widget-title']}>
                                    <FaRegCalendarCheck className={styles.widgetIcon} />
                                    Upcoming Queue
                                </h2>
                            </div>

                            <div className={styles.compactList}>
                                {upcomingAppointments.length === 0 ? (
                                    <div className={styles['empty-state']}>No upcoming appointments found.</div>
                                ) : (
                                    upcomingAppointments.map((appointment) => (
                                        <div key={appointment.id} className={styles.notificationItem}>
                                            <div>
                                                <p className={styles.compactTitle}>{appointment.patientName}</p>
                                                <p className={styles.compactText}>{appointment.procedure}</p>
                                            </div>
                                            <span className={styles.helperPill}>{appointment.time || formatDateShort(appointment.rawDate)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            {selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => setSelectedPatientId(null)}
                />
            )}
        </>
    );
}
