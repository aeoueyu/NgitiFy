import React, { useState, useEffect } from 'react';
import styles from '../../styles/owner/OwnerDashboard.module.css';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

import ProfilePicPlaceholder from '../../assets/icons/MyProfile.svg';
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import PatientIcon from '../../assets/icons/Patient.svg';

export default function OwnerDashboard() {
    const [currentTime, setCurrentTime] = useState(new Date());

    // Dynamic State Variables
    const [activePatients, setActivePatients] = useState(0);
    const [totalStaff, setTotalStaff] = useState(0);
    const [staffBreakdown, setStaffBreakdown] = useState("Loading...");
    const [lowStockAlerts, setLowStockAlerts] = useState(0);
    const [appointments, setAppointments] = useState([]);
    
    // Dynamic Treatment Data for PieChart
    const [treatmentData, setTreatmentData] = useState([
        { name: 'Loading Data...', value: 1 }
    ]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                };

                // 1. Fetch Users (Primary Data Source for both Staff and Patients)
                const usersRes = await fetch('http://localhost:5000/api/users', { headers });
                if (usersRes.ok) {
                    const usersData = await usersRes.json();

                    // FILTERING LOGIC: Count only those who are ACTIVE and VERIFIED
                    const activeUsers = usersData.filter(u => u.status === 'active' && u.isVerified === true);

                    // Staff Logic: Filter by staff roles within the active/verified group
                    const activeStaff = activeUsers.filter(u => ['dentist', 'secretary', 'owner', 'co-owner'].includes(u.role));
                    const dentists = activeStaff.filter(u => u.role === 'dentist').length;
                    const secretaries = activeStaff.filter(u => u.role === 'secretary').length;
                    
                    setTotalStaff(activeStaff.length);
                    setStaffBreakdown(`${dentists} Dentists, ${secretaries} Secretaries`);

                    // Patient Logic: Filter by patient role within the active/verified group
                    const activePatientsFromUsers = activeUsers.filter(u => u.role === 'patient').length;
                    setActivePatients(activePatientsFromUsers);
                }

                // 2. Fetch Inventory for Low Stock (FIXED LOGIC DITO)
                const invRes = await fetch('http://localhost:5000/api/inventory', { headers });
                if (invRes.ok) {
                    const invData = await invRes.json();
                    const lowStockCount = invData.filter(item => {
                        // Kinuha natin ang logic ng AI na may fallbacks para sa Mongoose schema mo
                        const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
                        const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
                        return stock <= limit;
                    }).length;
                    
                    setLowStockAlerts(lowStockCount);
                }

                // 3. Fetch Surgeries (Appointments)
                const surgRes = await fetch('http://localhost:5000/api/surgeries', { headers });
                if (surgRes.ok) {
                    const surgData = await surgRes.json();
                    
                    // Filter for today's appointments
                    const todayStr = new Date().toDateString();
                    const todayAppts = surgData.filter(s => new Date(s.date || s.createdAt).toDateString() === todayStr);
                    
                    const mappedAppts = todayAppts.map(s => ({
                        name: s.patientName || 'Unknown Patient',
                        type: s.procedure || 'Consultation',
                        time: new Date(s.date || s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        status: s.status || 'Pending'
                    }));
                    setAppointments(mappedAppts);

                    // Aggregate treatment types for the Pie Chart based on all records
                    if (surgData.length > 0) {
                        const procedureCounts = {};
                        surgData.forEach(s => {
                            const proc = s.procedure || 'Consultation';
                            procedureCounts[proc] = (procedureCounts[proc] || 0) + 1;
                        });
                        
                        const topTreatments = Object.entries(procedureCounts)
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 4);
                            
                        if (topTreatments.length > 0) setTreatmentData(topTreatments);
                    }
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            }
        };

        fetchDashboardData();
    }, []);

    const todayDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    const todayTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const PIE_COLORS = ['#01538b', '#2dccf6', '#ea8b89', '#f3ca63'];

    const calendarDays = [
        { num: 26, faded: true }, { num: 27, faded: true }, { num: 28, faded: true }, { num: 29, faded: true }, { num: 30, faded: true }, { num: 1 }, { num: 2 },
        { num: 3 }, { num: 4 }, { num: 5, hasEvent: true }, { num: 6 }, { num: 7 }, { num: 8 }, { num: 9 },
        { num: 10 }, { num: 11 }, { num: 12 }, { num: 13, active: true, hasEvent: true }, { num: 14 }, { num: 15, hasEvent: true }, { num: 16 },
        { num: 17 }, { num: 18 }, { num: 19 }, { num: 20 }, { num: 21 }, { num: 22 }, { num: 23 },
        { num: 24 }, { num: 25 }, { num: 26 }, { num: 27 }, { num: 28, hasEvent: true }, { num: 29 }, { num: 30 }
    ];

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
                        <p className={styles['stat-title']}>Active Patients</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}><img src={PatientIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>{activePatients}</h2>
                    <p className={styles['stat-desc']}>Verified active records</p>
                </div>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Total Staff</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}><img src={StaffIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>{totalStaff}</h2>
                    <p className={`${styles['stat-desc']} ${styles['neutral']}`}>{staffBreakdown}</p>
                </div>
                <div className={styles['stat-card']}>
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Low Stock Alerts</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}><img src={InventoryIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']} style={{ color: '#ea8b89' }}>{lowStockAlerts}</h2>
                    <p className={`${styles['stat-desc']} ${lowStockAlerts > 0 ? styles['danger'] : styles['neutral']}`}>
                        {lowStockAlerts > 0 ? '⚠ Action required' : 'Inventory optimal'}
                    </p>
                </div>
            </div>

            {/* CHARTS SECTION */}
            <div className={styles['charts-section']}>
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
                        {appointments.length > 0 ? (
                            appointments.map((apt, idx) => (
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
                            ))
                        ) : (
                            <p style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No appointments scheduled for today.</p>
                        )}
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