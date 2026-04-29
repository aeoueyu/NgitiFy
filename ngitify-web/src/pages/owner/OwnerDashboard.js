// ngitify-web/src/pages/owner/OwnerDashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell, FaCalendarCheck, FaUserFriends, FaBuilding,
    FaChartLine, FaBoxes, FaExclamationTriangle
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { formatWeekdayDate, formatTime } from '../../utils/dateUtils';
import styles from '../../styles/owner/OwnerDashboard.module.css';
import UserAvatar from '../../components/common/UserAvatar';

export default function OwnerDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({
        todayAppointments: 0,
        totalPatients: 0,
        pendingAppointments: 0,
        totalBranches: 0,
        lowStock: 0,
    });
    const [recentAppointments, setRecentAppointments] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const userId = user?.userId || user?.id;

                const [statsRes, surgRes, branchRes, notifRes] = await Promise.all([
                    authFetch('/dashboard/stats'),
                    authFetch('/surgeries'),
                    authFetch('/branches'),
                    authFetch('/notifications'),
                ]);

                if (userId) {
                    const pRes = await authFetch(`/user/${userId}`);
                    if (pRes.ok) setProfile(await pRes.json());
                }

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(prev => ({
                        ...prev,
                        todayAppointments:   statsData.todayAppointments   || 0,
                        pendingAppointments: statsData.pendingAppointments  || 0,
                        totalPatients:       statsData.totalPatients        || 0,
                        lowStock:            statsData.lowStockItems        || 0,
                    }));
                }

                if (surgRes.ok) {
                    const surgeries = await surgRes.json();
                    setRecentAppointments(surgeries.slice(0, 5).map(s => ({
                        id:        s._id,
                        patient:   `${s.patient?.name?.first || ''} ${s.patient?.name?.last || ''}`.trim() || 'Unknown',
                        procedure: s.procedure || 'Consultation',
                        date:      new Date(s.date).toLocaleDateString('en-PH'),
                        status:    s.status,
                        branch:    s.branch || '—',
                    })));
                }

                if (branchRes.ok) {
                    const branches = await branchRes.json();
                    setStats(prev => ({ ...prev, totalBranches: branches.length }));
                }

                if (notifRes.ok) {
                    const notifs = await notifRes.json();
                    setUnreadCount(notifs.filter(n => !n.isRead).length);
                }
            } catch (err) {
                console.error('Owner dashboard fetch error:', err);
            }
        };
        fetchData();
    }, [user]);

    const STATUS_COLORS = {
        pending:     '#f59e0b',
        confirmed:   '#3b82f6',
        completed:   '#22c55e',
        cancelled:   '#ef4444',
        'in-clinic': '#8b5cf6',
    };

    const kpiCards = [
        { icon: <FaCalendarCheck />, label: "Today's Appointments", value: stats.todayAppointments,   color: '#01538b', path: '/owner/appointments' },
        { icon: <FaChartLine />,     label: 'Pending Approvals',    value: stats.pendingAppointments, color: '#f59e0b', path: '/owner/appointments' },
        { icon: <FaUserFriends />,   label: 'Total Patients',       value: stats.totalPatients,       color: '#22c55e', path: '/owner/manage-users/patients' },
        { icon: <FaBuilding />,      label: 'Active Branches',      value: stats.totalBranches,       color: '#8b5cf6', path: '/owner/branches' },
        {
            icon:  <FaBoxes />,
            label: 'Low Stock Alerts',
            value: stats.lowStock,
            color: stats.lowStock > 0 ? '#ef4444' : '#94a3b8',
            path:  '/owner/inventory',
        },
    ];

    return (
        <main className={styles.mainContent}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <h1 className={styles.title}>Business Overview</h1>
                    <p className={styles.subtitle}>
                        {formatWeekdayDate(currentTime)}
                        <span className={styles.divider}>|</span>
                        <strong className={styles.timeText}>{formatTime(currentTime, true)}</strong>
                    </p>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.bellBtn} onClick={() => navigate('/owner/notifications')}>
                        <FaBell className={styles.bellIcon} />
                        {unreadCount > 0 && (
                            <span className={styles.bellBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                        )}
                    </button>
                </div>
            </header>

            {/* Low Stock Alert Banner */}
            {stats.lowStock > 0 && (
                <div className={styles.alertBanner} onClick={() => navigate('/owner/inventory')}>
                    <FaExclamationTriangle className={styles.alertIcon} />
                    <span>
                        Action Required: {stats.lowStock} inventory item{stats.lowStock !== 1 ? 's have' : ' has'} reached critically low stock levels.
                    </span>
                </div>
            )}

            {/* KPI Cards */}
            <div className={styles.kpiGrid}>
                {kpiCards.map((card, i) => (
                    <div
                        key={i}
                        className={styles.kpiCard}
                        style={{ borderTopColor: card.color }}
                        onClick={() => navigate(card.path)}
                    >
                        <div className={styles.kpiIcon} style={{ color: card.color }}>
                            {card.icon}
                        </div>
                        <div>
                            <p className={styles.kpiLabel}>{card.label}</p>
                            <p className={styles.kpiValue}>{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Appointments */}
            <div className={styles.tableCard}>
                <div className={styles.tableCardHeader}>
                    <h2 className={styles.tableCardTitle}>Recent Appointments</h2>
                    <button className={styles.viewAllBtn} onClick={() => navigate('/owner/appointments')}>
                        View All →
                    </button>
                </div>
                {recentAppointments.length === 0 ? (
                    <p className={styles.emptyText}>No appointments found.</p>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.tableHeadRow}>
                                {['Patient', 'Procedure', 'Branch', 'Date', 'Status'].map(h => (
                                    <th key={h} className={styles.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentAppointments.map(a => (
                                <tr key={a.id} className={styles.tableRow}>
                                    <td className={`${styles.td} ${styles.tdBold}`}>{a.patient}</td>
                                    <td className={styles.td}>{a.procedure}</td>
                                    <td className={styles.td}>{a.branch}</td>
                                    <td className={styles.td}>{a.date}</td>
                                    <td className={styles.td}>
                                        <span
                                            className={styles.statusBadge}
                                            style={{
                                                background: `${STATUS_COLORS[a.status] || '#94a3b8'}20`,
                                                color: STATUS_COLORS[a.status] || '#94a3b8',
                                            }}
                                        >
                                            {a.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </main>
    );
}