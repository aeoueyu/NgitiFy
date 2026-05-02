import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaBoxes,
    FaCalendarCheck,
    FaChartBar,
    FaCodeBranch,
    FaListUl,
    FaRobot,
    FaUserFriends,
    FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime, formatWeekdayDate } from '../../utils/dateUtils';
import styles from '../../styles/branch-manager/BranchManagerDashboard.module.css';

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const normalizeAppointment = (entry) => ({
    id: entry._id,
    patientName: entry.patient?.name
        ? `${entry.patient.name.first || ''} ${entry.patient.name.last || ''}`.trim()
        : (entry.guestName || 'Unknown Patient'),
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
    const [isLoading, setIsLoading] = useState(true);

    const assignedBranch = user?.assignedBranch || '';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                const [
                    surgeriesRes,
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
                    authFetch('/audit-logs'),
                    authFetch('/queue'),
                    authFetch('/users?role=dentist'),
                    authFetch('/users?role=secretary'),
                ]);

                if (surgeriesRes.ok) {
                    const data = await surgeriesRes.json();
                    setAppointments(data.map(normalizeAppointment).sort((a, b) => a.rawDate - b.rawDate));
                }

                if (patientsRes.ok) {
                    const data = await patientsRes.json();
                    const patientList = Array.isArray(data) ? data : (data.patients || []);
                    setPatients(patientList);
                }

                if (notificationsRes.ok) {
                    setNotifications(await notificationsRes.json());
                }

                if (inventoryRes.ok) {
                    setInventory(await inventoryRes.json());
                }

                if (activityRes.ok) {
                    setActivityLogs(await activityRes.json());
                }

                if (queueRes.ok) {
                    setQueueEntries(await queueRes.json());
                }

                const staff = [];
                if (dentistsRes.ok) {
                    const dentists = await dentistsRes.json();
                    staff.push(...dentists.filter((entry) => entry.role === 'dentist'));
                }
                if (secretariesRes.ok) {
                    const secretaries = await secretariesRes.json();
                    staff.push(...secretaries.filter((entry) => entry.role === 'secretary'));
                }
                setStaffUsers(staff);
            } catch (error) {
                console.error('Branch manager dashboard fetch error:', error);
                addToast('Failed to load branch manager dashboard data.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [addToast, assignedBranch]);

    const todayKey = startOfDay(new Date()).getTime();

    const todayAppointments = useMemo(
        () => appointments.filter((item) => startOfDay(item.rawDate).getTime() === todayKey),
        [appointments, todayKey]
    );

    const pendingAppointments = appointments.filter((item) => item.status === 'pending').length;
    const waitingQueue = queueEntries.filter((entry) => entry.status === 'waiting' || entry.status === 'serving');
    const unreadNotifications = notifications.filter((item) => !item.isRead).length;
    const recentNotifications = notifications.slice(0, 4);
    const recentActivity = activityLogs.slice(0, 5);

    const lowStockItems = useMemo(() => {
        return inventory.filter((item) => {
            const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
            const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
            return stock <= limit;
        }).slice(0, 4);
    }, [inventory]);

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        return appointments
            .filter((item) => item.rawDate >= startOfDay(now) && ['pending', 'confirmed', 'in-clinic'].includes(item.status))
            .slice(0, 5);
    }, [appointments]);

    const statCards = [
        {
            title: "Today's Appointments",
            value: todayAppointments.length,
            icon: <FaCalendarCheck />,
            accent: styles.blueAccent,
            path: '/branch-manager/appointments',
        },
        {
            title: 'Pending Confirmations',
            value: pendingAppointments,
            icon: <FaBell />,
            accent: styles.orangeAccent,
            path: '/branch-manager/appointments',
        },
        {
            title: 'Branch Patients',
            value: patients.length,
            icon: <FaUserFriends />,
            accent: styles.greenAccent,
            path: '/branch-manager/manage-users',
        },
        {
            title: 'Active Queue',
            value: waitingQueue.length,
            icon: <FaListUl />,
            accent: styles.purpleAccent,
            path: '/branch-manager/queue',
        },
    ];

    const moduleCards = [
        {
            title: 'User Management',
            description: 'Manage patients, dentists, and secretaries assigned to your branch.',
            value: `${staffUsers.length} branch staff accounts`,
            icon: <FaUsers className={styles.moduleIcon} />,
            actionLabel: 'Open Users',
            action: () => navigate('/branch-manager/manage-users'),
        },
        {
            title: 'Branch Profile',
            description: 'Review your assigned branch details without crossing into other branches.',
            value: assignedBranch || 'Assigned branch',
            icon: <FaCodeBranch className={styles.moduleIcon} />,
            actionLabel: 'Open Branch',
            action: () => navigate('/branch-manager/branches'),
        },
        {
            title: 'Inventory',
            description: 'Track stock levels and stay ahead of low inventory items in your branch.',
            value: `${lowStockItems.length} low-stock items`,
            icon: <FaBoxes className={styles.moduleIcon} />,
            actionLabel: 'Open Inventory',
            action: () => navigate('/branch-manager/inventory'),
        },
        {
            title: 'AI Assistant',
            description: 'Preview the future branch manager AI helper for faster workflow guidance.',
            value: 'Frontend preview ready',
            icon: <FaRobot className={styles.moduleIcon} />,
            actionLabel: 'Open Preview',
            action: () => navigate('/branch-manager/ai-assistant'),
        },
    ];

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Branch Manager Dashboard</h1>
                    <p className={styles.subtitle}>
                        {formatWeekdayDate(currentTime)}
                        <span className={styles.divider}>|</span>
                        <strong className={styles.timeText}>{formatTime(currentTime, true)}</strong>
                        {assignedBranch && <span className={styles.branchText}>| {assignedBranch}</span>}
                    </p>
                </div>

                <button className={styles.bellBtn} type="button" onClick={() => navigate('/branch-manager/notifications')}>
                    <FaBell className={styles.bellIcon} />
                    {unreadNotifications > 0 && (
                        <span className={styles.bellBadge}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    )}
                </button>
            </header>

            <section className={styles.statsGrid}>
                {statCards.map((card) => (
                    <button
                        key={card.title}
                        type="button"
                        className={`${styles.statCard} ${card.accent}`}
                        onClick={() => navigate(card.path)}
                    >
                        <div className={styles.statIcon}>{card.icon}</div>
                        <div>
                            <p className={styles.statLabel}>{card.title}</p>
                            <p className={styles.statValue}>{card.value}</p>
                        </div>
                    </button>
                ))}
            </section>

            <section className={styles.mainGrid}>
                <div className={styles.leftColumn}>
                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Module Summary</p>
                                <h2 className={styles.panelTitle}>Branch tools at a glance</h2>
                            </div>
                        </div>

                        <div className={styles.moduleGrid}>
                            {moduleCards.map((card) => (
                                <div key={card.title} className={styles.moduleCard}>
                                    <div className={styles.moduleHeader}>
                                        {card.icon}
                                        <span className={styles.moduleValue}>{card.value}</span>
                                    </div>
                                    <h3 className={styles.moduleTitle}>{card.title}</h3>
                                    <p className={styles.moduleDescription}>{card.description}</p>
                                    <button type="button" className={styles.quickLinkBtn} onClick={card.action}>
                                        {card.actionLabel}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Appointments</p>
                                <h2 className={styles.panelTitle}>Upcoming branch schedule</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/branch-manager/appointments')}>
                                View all
                            </button>
                        </div>

                        {isLoading ? (
                            <p className={styles.emptyState}>Loading schedule...</p>
                        ) : upcomingAppointments.length === 0 ? (
                            <p className={styles.emptyState}>No upcoming appointments found.</p>
                        ) : (
                            <div className={styles.listStack}>
                                {upcomingAppointments.map((appointment) => (
                                    <div key={appointment.id} className={styles.listItem}>
                                        <div>
                                            <p className={styles.itemTitle}>{appointment.patientName}</p>
                                            <p className={styles.itemMeta}>
                                                {appointment.procedure} - {appointment.branch || assignedBranch}
                                            </p>
                                        </div>
                                        <div className={styles.itemAside}>
                                            <span className={styles.itemDate}>
                                                {formatDateShort(appointment.rawDate)} {appointment.time ? `| ${appointment.time}` : ''}
                                            </span>
                                            <span className={styles.statusBadge}>{formatStatus(appointment.status)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Activity Logs</p>
                                <h2 className={styles.panelTitle}>Recent branch-visible activity</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/branch-manager/activity-logs')}>
                                Open logs
                            </button>
                        </div>

                        {recentActivity.length === 0 ? (
                            <p className={styles.emptyState}>No activity logs available yet.</p>
                        ) : (
                            <div className={styles.listStack}>
                                {recentActivity.map((entry) => (
                                    <div key={entry._id || `${entry.action}-${entry.timestamp}`} className={styles.listItem}>
                                        <div>
                                            <p className={styles.itemTitle}>{entry.action || 'System Event'}</p>
                                            <p className={styles.itemMeta}>{entry.details || 'No additional details provided.'}</p>
                                        </div>
                                        <span className={styles.itemDate}>{formatDateShort(entry.timestamp || entry.createdAt)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>
                </div>

                <div className={styles.rightColumn}>
                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Branch Snapshot</p>
                                <h2 className={styles.panelTitle}>Today in your branch</h2>
                            </div>
                        </div>

                        <div className={styles.summaryGrid}>
                            <div className={styles.summaryCard}>
                                <FaChartBar className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Appointments Today</span>
                                <strong className={styles.summaryValue}>{todayAppointments.length}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <FaBell className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Unread Notifications</span>
                                <strong className={styles.summaryValue}>{unreadNotifications}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <FaListUl className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Waiting Queue</span>
                                <strong className={styles.summaryValue}>{waitingQueue.length}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <FaUsers className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Branch Staff</span>
                                <strong className={styles.summaryValue}>{staffUsers.length}</strong>
                            </div>
                        </div>
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Notifications</p>
                                <h2 className={styles.panelTitle}>Latest alerts</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/branch-manager/notifications')}>
                                Open alerts
                            </button>
                        </div>

                        {recentNotifications.length === 0 ? (
                            <p className={styles.emptyState}>No notifications yet.</p>
                        ) : (
                            <div className={styles.listStack}>
                                {recentNotifications.map((notification) => (
                                    <div key={notification._id} className={styles.listItem}>
                                        <div>
                                            <p className={styles.itemTitle}>{notification.title || 'Notification'}</p>
                                            <p className={styles.itemMeta}>{notification.message || 'No message provided.'}</p>
                                        </div>
                                        {!notification.isRead && <span className={styles.helperPill}>Unread</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Inventory Watch</p>
                                <h2 className={styles.panelTitle}>Stock attention items</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/branch-manager/inventory')}>
                                Open inventory
                            </button>
                        </div>

                        {lowStockItems.length === 0 ? (
                            <p className={styles.emptyState}>No low-stock items right now.</p>
                        ) : (
                            <div className={styles.listStack}>
                                {lowStockItems.map((item) => (
                                    <div key={item._id || item.name} className={styles.listItem}>
                                        <div>
                                            <p className={styles.itemTitle}>{item.name || 'Unnamed Item'}</p>
                                            <p className={styles.itemMeta}>
                                                Branch: {item.branch || assignedBranch || 'Assigned Branch'}
                                            </p>
                                        </div>
                                        <span className={styles.helperPill}>
                                            {item.quantity !== undefined ? item.quantity : (item.currentStock || 0)} left
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Quick Access</p>
                                <h2 className={styles.panelTitle}>Branch shortcuts</h2>
                            </div>
                        </div>

                        <div className={styles.shortcutStack}>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/branch-manager/queue')}>
                                Queue management
                            </button>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/branch-manager/chat-support')}>
                                Chat support
                            </button>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/branch-manager/analytics')}>
                                Branch analytics
                            </button>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/branch-manager/branches')}>
                                Branch details
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        </main>
    );
}
