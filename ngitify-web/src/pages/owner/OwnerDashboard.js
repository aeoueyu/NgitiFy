import React, { useState, useEffect } from 'react';
import styles from '../../styles/owner/OwnerDashboard.module.css';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

import ProfilePicPlaceholder from '../../assets/icons/MyProfile.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import PatientIcon from '../../assets/icons/Patient.svg';

export default function OwnerDashboard() {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const todayDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    const todayTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const revenueData = [
        { name: 'Jan', revenue: 45000 }, { name: 'Feb', revenue: 52000 }, { name: 'Mar', revenue: 48000 },
        { name: 'Apr', revenue: 70000 }, { name: 'May', revenue: 61000 }, { name: 'Jun', revenue: 85000 },
        { name: 'Jul', revenue: 124500 },
    ];

    const treatmentData = [
        { name: 'Consultation', value: 400 }, { name: 'Cleaning', value: 300 },
        { name: 'Extraction', value: 200 }, { name: 'Braces', value: 150 },
    ];
    const PIE_COLORS = ['#01538b', '#2dccf6', '#ea8b89', '#f3ca63'];

    const calendarDays = [
        { num: 26, faded: true }, { num: 27, faded: true }, { num: 28, faded: true }, { num: 29, faded: true }, { num: 30, faded: true }, { num: 1 }, { num: 2 },
        { num: 3 }, { num: 4 }, { num: 5, hasEvent: true }, { num: 6 }, { num: 7 }, { num: 8 }, { num: 9 },
        { num: 10 }, { num: 11 }, { num: 12 }, { num: 13, active: true, hasEvent: true }, { num: 14 }, { num: 15, hasEvent: true }, { num: 16 },
        { num: 17 }, { num: 18 }, { num: 19 }, { num: 20 }, { num: 21 }, { num: 22 }, { num: 23 },
        { num: 24 }, { num: 25 }, { num: 26 }, { num: 27 }, { num: 28, hasEvent: true }, { num: 29 }, { num: 30 }
    ];

    // DIRETSO NA AGAD SA <main> TAG DAHIL NASA DASHBOARDLAYOUT NA ANG WRAPPER
    return (
        <main className={styles['main-content']}>
            <header className={styles['header']}>
                <div className={styles['header-left']}>
                    <h1 className={styles['title']}>Owner Overview</h1>
                    <p className={styles['subtitle']}>
                        {todayDate} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{todayTime}</strong>
                    </p>
                </div>
                <div className={styles['header-right']}>
                    <div className={styles['user-info']}>
                        <span className={styles['user-name']}>Hello, Admin!</span>
                        <span className={styles['user-role']}>Clinic Owner</span>
                    </div>
                    <img src={ProfilePicPlaceholder} alt="Profile" className={styles['profile-pic']} />
                </div>
            </header>

            {/* STATS GRID */}
            <div className={styles['stats-grid']}>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Total Revenue</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}><img src={DashboardIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>₱124,500</h2>
                    <p className={styles['stat-desc']}>↑ 15% vs last month</p>
                </div>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Active Patients</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}><img src={PatientIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>342</h2>
                    <p className={styles['stat-desc']}>↑ 12 new this week</p>
                </div>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Total Staff</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}><img src={StaffIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>8</h2>
                    <p className={`${styles['stat-desc']} ${styles['neutral']}`}>3 Dentists, 5 Secretaries</p>
                </div>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Low Stock Alerts</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}><img src={InventoryIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']} style={{ color: '#ea8b89' }}>5</h2>
                    <p className={`${styles['stat-desc']} ${styles['danger']}`}>⚠ Action required</p>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className={styles['charts-section']}>
                <div className={styles['chart-card']}>
                    <div className={styles['chart-header']}><h3 className={styles['chart-title']}>Revenue Analytics (2024)</h3></div>
                    <div className={styles['chart-container']}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#01538b" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#01538b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dx={-10} tickFormatter={(val) => `₱${val/1000}k`} />
                                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} formatter={(value) => [`₱${value.toLocaleString()}`, 'Revenue']} />
                                <Area type="monotone" dataKey="revenue" stroke="#01538b" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className={styles['chart-card']}>
                    <div className={styles['chart-header']}><h3 className={styles['chart-title']}>Top Treatments</h3></div>
                    <div className={styles['chart-container']}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={treatmentData} cx="50%" cy="45%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                                    {treatmentData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#555', paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* BOTTOM SECTION */}
            <div className={styles['bottom-section']}>
                <div className={styles['list-card']}>
                    <div className={styles['list-header']}>
                        <h3 className={styles['list-title']}>Today's Appointments</h3>
                        <span className={styles['view-all']}>View All</span>
                    </div>
                    <div className={styles['list-content']}>
                        {[
                            { name: "Maria Clara", type: "Dental Braces Adj.", time: "09:00 AM", status: "Done" },
                            { name: "Juan Dela Cruz", type: "Tooth Extraction", time: "11:30 AM", status: "Done" },
                            { name: "Jose Rizal", type: "Teeth Cleaning", time: "02:00 PM", status: "Pending" },
                            { name: "Andres B.", type: "Consultation", time: "04:00 PM", status: "Pending" }
                        ].map((apt, idx) => (
                            <div key={idx} className={styles['appointment-item']}>
                                <div className={styles['patient-info']}>
                                    <div className={styles['patient-avatar']}>{apt.name.charAt(0)}</div>
                                    <div className={styles['patient-details']}>
                                        <p className={styles['patient-name']}>{apt.name}</p>
                                        <p className={styles['treatment-type']}>{apt.type}</p>
                                    </div>
                                </div>
                                <div className={styles['appointment-time']}>
                                    <p className={styles['time-text']}>{apt.time}</p>
                                    <span className={`${styles['status-badge']} ${apt.status === 'Done' ? styles['status-done'] : styles['status-pending']}`}>
                                        {apt.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles['calendar-card']}>
                    <div className={styles['calendar-header']}>
                        <h3 className={styles['month-text']}>October 2024</h3>
                        <div className={styles['cal-nav']}>
                            <button className={styles['cal-nav-btn']}>&lt;</button>
                            <button className={styles['cal-nav-btn']}>&gt;</button>
                        </div>
                    </div>
                    
                    <div className={styles['calendar-grid']}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className={styles['day-name']}>{day}</div>
                        ))}
                        
                        {calendarDays.map((day, idx) => (
                            <div key={idx} className={`${styles['date-num']} ${day.faded ? styles['faded'] : ''} ${day.active ? styles['active'] : ''}`}>
                                {day.num}
                                {day.hasEvent && <div className={`${styles['event-dot']} ${day.active ? styles['white'] : ''}`}></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}