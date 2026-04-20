import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaCalendarCheck, FaUserFriends, FaClipboardList, FaChartBar } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { formatWeekdayDate, formatTime } from '../../utils/dateUtils';
import styles from '../../styles/admin/AdminDashboard.module.css';
import UserAvatar from '../../components/common/UserAvatar';

export default function BranchManagerDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({ todayAppointments: 0, totalPatients: 0, pendingAppointments: 0, queueLength: 0 });
    const [recentAppointments, setRecentAppointments] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [profile, setProfile] = useState(null);

    const branch = user?.assignedBranch || '';

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [surgRes, queueRes, notifRes] = await Promise.all([
                    authFetch('/surgeries'),
                    authFetch(`/queue?branch=${encodeURIComponent(branch)}`),
                    authFetch('/notifications'),
                ]);

                const userId = user?.userId || user?.id;
                if (userId) {
                    const pRes = await authFetch(`/user/${userId}`);
                    if (pRes.ok) setProfile(await pRes.json());
                }

                if (surgRes.ok) {
                    const surgeries = await surgRes.json();
                    const today = new Date().toDateString();
                    const todayAppts = surgeries.filter(s => new Date(s.date).toDateString() === today);
                    const pending = surgeries.filter(s => s.status === 'pending');
                    setStats(prev => ({ ...prev, todayAppointments: todayAppts.length, pendingAppointments: pending.length }));
                    setRecentAppointments(surgeries.slice(0, 5).map(s => ({
                        id: s._id,
                        patient: `${s.patient?.name?.first || ''} ${s.patient?.name?.last || ''}`.trim() || 'Unknown',
                        procedure: s.procedure || 'Consultation',
                        date: new Date(s.date).toLocaleDateString('en-PH'),
                        status: s.status,
                    })));
                }

                if (queueRes.ok) {
                    const queue = await queueRes.json();
                    const active = queue.filter(q => q.status === 'waiting' || q.status === 'serving');
                    setStats(prev => ({ ...prev, queueLength: active.length }));
                }

                if (notifRes.ok) {
                    const notifs = await notifRes.json();
                    setUnreadCount(notifs.filter(n => !n.isRead).length);
                }
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            }
        };
        fetchData();
    }, [branch, user]);

    const statusColor = { pending: '#f59e0b', confirmed: '#3b82f6', completed: '#22c55e', cancelled: '#ef4444', 'in-clinic': '#8b5cf6' };

    return (
        <main className={styles['main-content']}>
            <header className={styles['header']}>
                <div className={styles['header-left']}>
                    <h1 className={styles['title']}>Branch Overview</h1>
                    <p className={styles['subtitle']}>
                        {formatWeekdayDate(currentTime)}
                        <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span>
                        <strong style={{ color: '#01538b' }}>{formatTime(currentTime, true)}</strong>
                        {branch && <span style={{ marginLeft: '8px', color: '#64748b' }}>— {branch}</span>}
                    </p>
                </div>
                <div className={styles['header-right']}>
                    <button className={styles['bell-btn']} onClick={() => navigate('/branch-manager/notifications')}>
                        <FaBell className={styles['bell-icon']} />
                        {unreadCount > 0 && <span className={styles['bell-badge']}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
                    </button>
                    <div className={styles['user-info']}>
                        <span className={styles['user-name']}>Hello, {profile?.name?.first || user?.firstName || 'Manager'}!</span>
                        <span className={styles['user-role']}>Branch Manager</span>
                    </div>
                    <div className={styles['profile-wrapper']}>
                        <UserAvatar user={profile || user || { name: 'Manager' }} size={45} />
                    </div>
                </div>
            </header>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {[
                    { icon: <FaCalendarCheck />, label: "Today's Appointments", value: stats.todayAppointments, color: '#01538b', path: '/branch-manager/appointments' },
                    { icon: <FaClipboardList />, label: 'Pending Approvals', value: stats.pendingAppointments, color: '#f59e0b', path: '/branch-manager/appointments' },
                    { icon: <FaUserFriends />, label: 'Active Queue', value: stats.queueLength, color: '#22c55e', path: '/branch-manager/queue' },
                    { icon: <FaChartBar />, label: 'Branch', value: branch || 'N/A', color: '#8b5cf6', path: '/branch-manager/analytics' },
                ].map((card, i) => (
                    <div key={i}
                        onClick={() => navigate(card.path)}
                        style={{ background: '#fff', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer', borderTop: `4px solid ${card.color}`, transition: 'transform 0.15s', display: 'flex', alignItems: 'center', gap: '16px' }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <div style={{ fontSize: '28px', color: card.color }}>{card.icon}</div>
                        <div>
                            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: '500' }}>{card.label}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Appointments */}
            <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Recent Appointments</h2>
                    <button onClick={() => navigate('/branch-manager/appointments')} style={{ background: 'none', border: 'none', color: '#01538b', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>View All →</button>
                </div>
                {recentAppointments.length === 0 ? (
                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No appointments found for this branch.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                                {['Patient', 'Procedure', 'Date', 'Status'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentAppointments.map(a => (
                                <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0f172a' }}>{a.patient}</td>
                                    <td style={{ padding: '10px 12px', color: '#475569' }}>{a.procedure}</td>
                                    <td style={{ padding: '10px 12px', color: '#475569' }}>{a.date}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                        <span style={{ background: `${statusColor[a.status] || '#94a3b8'}20`, color: statusColor[a.status] || '#94a3b8', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
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