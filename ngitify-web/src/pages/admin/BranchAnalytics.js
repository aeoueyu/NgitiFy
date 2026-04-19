import React, { useState, useEffect, useCallback } from 'react';
import { FaChartBar, FaFilter } from 'react-icons/fa';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/BranchAnalytics.module.css';

const COLORS = ['#01538b', '#2dccf6', '#27ae60', '#e67e22', '#8e44ad', '#e74c3c'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function BranchAnalytics() {
    const [data, setData]         = useState(null);
    const [loading, setLoading]   = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('All');
    const [from, setFrom]         = useState('');
    const [to, setTo]             = useState('');

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (from) params.append('from', from);
            if (to)   params.append('to', to);

            const res = await authFetch(`/analytics/branches?${params.toString()}`);
            if (res.ok) setData(await res.json());
        } catch (err) {
            console.error('Error fetching analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [from, to]);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch('/branches');
            if (res.ok) setBranches(await res.json());
        } catch (err) { /* silent */ }
    }, []);

    useEffect(() => {
        fetchBranches();
        fetchAnalytics();
    }, [fetchBranches, fetchAnalytics]);

    // ── Build chart datasets ──────────────────────────────────

    // 1. Bar chart: appointments per branch
    const barData = (data?.branchCounts || [])
        .filter(b => selectedBranch === 'All' || b._id === selectedBranch)
        .map(b => ({ name: b._id || 'Unknown', appointments: b.total }));

    // 2. Line chart: monthly trend
    const buildMonthlyTrend = () => {
        const raw = data?.monthly || [];
        const filtered = selectedBranch === 'All' ? raw : raw.filter(r => r._id.branch === selectedBranch);

        // Build ordered month slots for the last 6 months
        const now = new Date();
        const slots = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            slots.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: MONTH_NAMES[d.getMonth()], count: 0 });
        }

        filtered.forEach(r => {
            const key = `${r._id.year}-${r._id.month}`;
            const slot = slots.find(s => s.key === key);
            if (slot) slot.count += r.count;
        });

        return slots.map(s => ({ name: s.label, patients: s.count }));
    };

    // 3. Pie chart: procedure distribution
    const pieData = (data?.procedures || [])
        .map(p => ({ name: p._id || 'Other', value: p.value }));

    const monthlyTrend = buildMonthlyTrend();
    const totalAppointments = barData.reduce((sum, b) => sum + b.appointments, 0);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <FaChartBar className={styles.headerIcon} />
                    <div>
                        <h1 className={styles.pageTitle}>Branch Analytics</h1>
                        <p className={styles.pageSubtitle}>
                            {totalAppointments} total appointments across {barData.length} branch{barData.length !== 1 ? 'es' : ''}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filterBar}>
                <FaFilter className={styles.filterIcon} />

                <select
                    className={styles.filterSelect}
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                >
                    <option value="All">All Branches</option>
                    {branches.map(b => (
                        <option key={b._id} value={b.name}>{b.name}</option>
                    ))}
                </select>

                <div className={styles.dateRange}>
                    <label className={styles.dateLabel}>From</label>
                    <input type="date" className={styles.dateInput} value={from} onChange={e => setFrom(e.target.value)} />
                    <label className={styles.dateLabel}>To</label>
                    <input type="date" className={styles.dateInput} value={to} onChange={e => setTo(e.target.value)} />
                    {(from || to) && (
                        <button className={styles.clearBtn} onClick={() => { setFrom(''); setTo(''); }}>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingState}>Loading analytics...</div>
            ) : (
                <div className={styles.chartsGrid}>
                    {/* Bar Chart: Appointments per Branch */}
                    <div className={styles.chartCard}>
                        <h2 className={styles.chartTitle}>Appointments per Branch</h2>
                        {barData.length === 0 ? (
                            <p className={styles.emptyChart}>No data available.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} />
                                    <Bar dataKey="appointments" fill="#01538b" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Line Chart: Monthly Trend */}
                    <div className={styles.chartCard}>
                        <h2 className={styles.chartTitle}>Monthly Trend (Last 6 Months)</h2>
                        {monthlyTrend.every(m => m.patients === 0) ? (
                            <p className={styles.emptyChart}>No trend data available.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} />
                                    <Line type="monotone" dataKey="patients" name="Appointments" stroke="#2dccf6" strokeWidth={3} dot={{ fill: '#01538b', r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Pie Chart: Procedure Distribution */}
                    <div className={`${styles.chartCard} ${styles.pieCard}`}>
                        <h2 className={styles.chartTitle}>Procedure Distribution</h2>
                        {pieData.length === 0 ? (
                            <p className={styles.emptyChart}>No data available.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={90}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}