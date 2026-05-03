import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell,
    FaBoxes,
    FaBuilding,
    FaChartBar,
    FaExclamationTriangle,
    FaRegCalendarCheck,
    FaRobot,
    FaShieldAlt,
    FaUserFriends,
    FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime, formatWeekdayDate } from '../../utils/dateUtils';
import styles from '../../styles/owner/OwnerDashboard.module.css';

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const formatStatus = (status) => {
    if (!status) return 'Pending';
    if (status === 'in-clinic') return 'In Clinic';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const normalizeAppointment = (entry) => ({
    id: entry._id,
    patientName: entry.patient?.name
        ? `${entry.patient.name.first || ''} ${entry.patient.name.last || ''}`.trim()
        : (entry.guestName || 'Unknown Patient'),
    procedure: entry.procedure || 'Consultation',
    branch: entry.branch || 'Unassigned Branch',
    status: entry.status || 'pending',
    time: entry.time || '',
    rawDate: new Date(entry.date),
});

export default function OwnerDashboard() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user } = useAuth();

    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({
        todayAppointments: 0,
        pendingAppointments: 0,
        totalPatients: 0,
        totalBranches: 0,
        lowStock: 0,
    });
    const [appointments, setAppointments] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [branches, setBranches] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [users, setUsers] = useState([]);
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
                const [
                    statsRes,
                    surgeriesRes,
                    notificationsRes,
                    branchesRes,
                    inventoryRes,
                    activityRes,
                    usersRes,
                ] = await Promise.all([
                    authFetch('/dashboard/stats'),
                    authFetch('/appointments'),
                    authFetch('/notifications'),
                    authFetch('/branches'),
                    authFetch('/inventory'),
                    userId ? authFetch(`/audit-logs?userId=${userId}`) : Promise.resolve(null),
                    authFetch('/users'),
                ]);

                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats({
                        todayAppointments: data.todayAppointments || 0,
                        pendingAppointments: data.pendingAppointments || 0,
                        totalPatients: data.totalPatients || 0,
                        totalBranches: data.totalBranches || 0,
                        lowStock: data.lowStockItems || 0,
                    });
                }

                if (surgeriesRes.ok) {
                    const data = await surgeriesRes.json();
                    setAppointments(data.map(normalizeAppointment).sort((a, b) => a.rawDate - b.rawDate));
                }

                if (notificationsRes.ok) {
                    setNotifications(await notificationsRes.json());
                }

                if (branchesRes.ok) {
                    setBranches(await branchesRes.json());
                }

                if (inventoryRes.ok) {
                    setInventory(await inventoryRes.json());
                }

                if (activityRes?.ok) {
                    setActivityLogs(await activityRes.json());
                }

                if (usersRes.ok) {
                    setUsers(await usersRes.json());
                }
            } catch (error) {
                console.error('Owner dashboard fetch error:', error);
                addToast('Failed to load owner dashboard data.', 'error');
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

    const todayKey = startOfDay(new Date()).getTime();

    const todayAppointments = useMemo(
        () => appointments.filter((item) => startOfDay(item.rawDate).getTime() === todayKey),
        [appointments, todayKey]
    );

    const unreadNotifications = notifications.filter((item) => !item.isRead).length;

    const activeBranchCount = useMemo(
        () => branches.filter((branch) => (branch.status || '').toLowerCase() !== 'inactive').length,
        [branches]
    );

    const staffCount = useMemo(
        () => users.filter((entry) => entry.role && entry.role !== 'patient').length,
        [users]
    );

    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        return appointments
            .filter((item) => item.rawDate >= startOfDay(now) && ['pending', 'confirmed', 'in-clinic'].includes(item.status))
            .slice(0, 5);
    }, [appointments]);

    const recentNotifications = notifications.slice(0, 4);
    const recentActivity = activityLogs.slice(0, 5);

    const lowStockItems = useMemo(() => {
        return inventory.filter((item) => {
            const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
            const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
            return stock <= limit;
        }).slice(0, 4);
    }, [inventory]);

    const statCards = [
        {
            title: "Today's Appointments",
            value: stats.todayAppointments,
            icon: <FaRegCalendarCheck />,
            accent: styles.blueAccent,
            path: '/owner/appointments',
        },
        {
            title: 'Pending Confirmations',
            value: stats.pendingAppointments,
            icon: <FaBell />,
            accent: styles.orangeAccent,
            path: '/owner/appointments',
        },
        {
            title: 'Patient Records',
            value: stats.totalPatients,
            icon: <FaUserFriends />,
            accent: styles.greenAccent,
            path: '/owner/manage-users/patients',
        },
        {
            title: 'Active Branches',
            value: activeBranchCount || stats.totalBranches,
            icon: <FaBuilding />,
            accent: styles.purpleAccent,
            path: '/owner/branches',
        },
    ];

    const moduleCards = [
        {
            title: 'User Management',
            description: 'Manage secretary, dentist, and branch manager accounts from one place.',
            value: `${staffCount} staff accounts`,
            icon: <FaUsers className={styles.moduleIcon} />,
            actionLabel: 'Open Users',
            action: () => navigate('/owner/manage-users'),
        },
        {
            title: 'Inventory',
            description: 'Track supply levels and respond quickly to low-stock items across the clinic.',
            value: `${stats.lowStock} low-stock alerts`,
            icon: <FaBoxes className={styles.moduleIcon} />,
            actionLabel: 'Open Inventory',
            action: () => navigate('/owner/inventory'),
        },
        {
            title: 'Roles & Permissions',
            description: 'Review access patterns for staff accounts while keeping sensitive admin-only tools excluded.',
            value: 'Owner access active',
            icon: <FaShieldAlt className={styles.moduleIcon} />,
            actionLabel: 'Open Access',
            action: () => navigate('/owner/roles'),
        },
        {
            title: 'AI Assistant',
            description: 'Preview the owner-side AI workspace that will help surface records and workflow guidance.',
            value: 'Frontend preview ready',
            icon: <FaRobot className={styles.moduleIcon} />,
            actionLabel: 'Open Preview',
            action: () => navigate('/owner/ai-assistant'),
        },
    ];

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Owner Dashboard</h1>
                    <p className={styles.subtitle}>
                        {formatWeekdayDate(currentTime)}
                        <span className={styles.divider}>|</span>
                        <strong className={styles.timeText}>{formatTime(currentTime, true)}</strong>
                    </p>
                </div>

                <button className={styles.bellBtn} type="button" onClick={() => navigate('/owner/notifications')}>
                    <FaBell className={styles.bellIcon} />
                    {unreadNotifications > 0 && (
                        <span className={styles.bellBadge}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>
                    )}
                </button>
            </header>

            {stats.lowStock > 0 && (
                <button type="button" className={styles.alertBanner} onClick={() => navigate('/owner/inventory')}>
                    <FaExclamationTriangle className={styles.alertIcon} />
                    <span>
                        {stats.lowStock} item{stats.lowStock !== 1 ? 's are' : ' is'} already at or below the reorder level.
                    </span>
                </button>
            )}

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
                                <h2 className={styles.panelTitle}>Owner tools at a glance</h2>
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
                                <h2 className={styles.panelTitle}>Upcoming clinic flow</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/owner/appointments')}>
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
                                                {appointment.procedure} - {appointment.branch}
                                            </p>
                                        </div>
                                        <div className={styles.itemAside}>
                                            <span className={styles.itemDate}>{formatDateShort(appointment.rawDate)}</span>
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
                                <h2 className={styles.panelTitle}>Recent account activity</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/owner/activity-logs')}>
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
                                <p className={styles.panelEyebrow}>Today</p>
                                <h2 className={styles.panelTitle}>Quick summary</h2>
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
                                <FaBuilding className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Branches Tracked</span>
                                <strong className={styles.summaryValue}>{branches.length}</strong>
                            </div>
                            <div className={styles.summaryCard}>
                                <FaBoxes className={styles.summaryIcon} />
                                <span className={styles.summaryLabel}>Low Stock Items</span>
                                <strong className={styles.summaryValue}>{stats.lowStock}</strong>
                            </div>
                        </div>
                    </article>

                    <article className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <div>
                                <p className={styles.panelEyebrow}>Notifications</p>
                                <h2 className={styles.panelTitle}>Latest alerts</h2>
                            </div>
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/owner/notifications')}>
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
                            <button type="button" className={styles.linkBtn} onClick={() => navigate('/owner/inventory')}>
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
                                                Branch: {item.branch || 'Shared Inventory'}
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
                                <h2 className={styles.panelTitle}>Owner shortcuts</h2>
                            </div>
                        </div>

                        <div className={styles.shortcutStack}>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/owner/branches/analytics')}>
                                Branch analytics
                            </button>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/owner/manage-users/branch-managers')}>
                                Branch managers
                            </button>
                            <button type="button" className={styles.shortcutBtn} onClick={() => navigate('/owner/profile')}>
                                My profile
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        </main>
    );
}
