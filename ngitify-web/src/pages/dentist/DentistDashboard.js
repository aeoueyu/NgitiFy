import React, { useState, useEffect } from 'react';
import styles from '../../styles/dentist/DentistDashboard.module.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// --- IMPORTS (ALL SVG NOW) ---
import DentimeLogo from '../../assets/images/logo-dentime.svg';
import ProfilePicPlaceholder from '../../assets/icons/MyProfile.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import PatientIcon from '../../assets/icons/MyPatients.svg';
import ScheduleIcon from '../../assets/icons/MySchedule.svg';
import OdontogramIcon from '../../assets/icons/Odontogram.svg';
import EPrescriptionIcon from '../../assets/icons/EPrescription.svg';
import AIPredictIcon from '../../assets/icons/AIPredict.svg';

export default function DentistDashboard() {
    
    // --- LIVE DATE & TIME ---
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer); 
    }, []);

    const todayDate = currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    const todayTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // --- DUMMY DATA ---
    const patientsThisWeek = [
        { name: 'Mon', patients: 8 }, { name: 'Tue', patients: 12 }, { name: 'Wed', patients: 10 },
        { name: 'Thu', patients: 15 }, { name: 'Fri', patients: 14 }, { name: 'Sat', patients: 20 },
    ];

    const treatmentData = [
        { name: 'Consultation', value: 35 }, { name: 'Restoration', value: 25 },
        { name: 'Extraction', value: 15 }, { name: 'Orthodontics', value: 25 },
    ];
    const PIE_COLORS = ['#01538b', '#2dccf6', '#ea8b89', '#f3ca63'];

    const calendarDays = [
        { num: 26, faded: true }, { num: 27, faded: true }, { num: 28, faded: true }, { num: 29, faded: true }, { num: 30, faded: true }, { num: 1 }, { num: 2 },
        { num: 3 }, { num: 4 }, { num: 5, hasEvent: true }, { num: 6 }, { num: 7 }, { num: 8 }, { num: 9 },
        { num: 10 }, { num: 11 }, { num: 12 }, { num: 13, active: true, hasEvent: true }, { num: 14 }, { num: 15, hasEvent: true }, { num: 16 },
        { num: 17 }, { num: 18 }, { num: 19 }, { num: 20 }, { num: 21 }, { num: 22 }, { num: 23 },
        { num: 24 }, { num: 25 }, { num: 26 }, { num: 27 }, { num: 28, hasEvent: true }, { num: 29 }, { num: 30 }
    ];

    return (
        <div className={styles['dashboard-container']}>
            
            {/* SIDEBAR FOR DENTIST */}
            <aside className={styles['sidebar']}>
                <div className={styles['logo-container']}>
                    <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
                </div>
                <div className={styles['nav-menu']}>
                    <div className={`${styles['nav-item']} ${styles['active']}`}>
                        <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> Dashboard
                    </div>
                    <div className={styles['nav-item']}>
                        <img src={PatientIcon} alt="Patients" className={styles['nav-icon']} /> My Patients
                    </div>
                    <div className={styles['nav-item']}>
                        <img src={ScheduleIcon} alt="Schedule" className={styles['nav-icon']} /> Appointments
                    </div>
                    <div className={styles['nav-item']}>
                        <img src={OdontogramIcon} alt="Odontogram" className={styles['nav-icon']} /> Odontogram
                    </div>
                    <div className={styles['nav-item']}>
                        <img src={EPrescriptionIcon} alt="E-Prescription" className={styles['nav-icon']} /> E-Prescription
                    </div>
                    <div className={styles['nav-item']}>
                        <img src={AIPredictIcon} alt="AI Predict" className={styles['nav-icon']} /> AI Predict
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className={styles['main-content']}>
                
                {/* HEADER */}
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Welcome back, Dr. Smith!</h1>
                        <p className={styles['subtitle']}>
                            {todayDate} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{todayTime}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Dr. John Smith</span>
                            <span className={styles['user-role']}>Head Dentist</span>
                        </div>
                        <img src={ProfilePicPlaceholder} alt="Profile" className={styles['profile-pic']} />
                    </div>
                </header>

                {/* STATS GRID FOR DENTIST */}
                <div className={styles['stats-grid']}>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Today's Patients</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}><img src={PatientIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <h2 className={styles['stat-value']}>12</h2>
                        <p className={styles['stat-desc']}>4 remaining for today</p>
                    </div>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Completed Tx</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}><img src={OdontogramIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <h2 className={styles['stat-value']}>8</h2>
                        <p className={`${styles['stat-desc']} ${styles['neutral']}`}>Treatments done today</p>
                    </div>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Pending E-Rx</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}><img src={EPrescriptionIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <h2 className={styles['stat-value']} style={{ color: '#ea8b89' }}>3</h2>
                        <p className={`${styles['stat-desc']} ${styles['danger']}`}>Needs signing</p>
                    </div>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Upcoming Surgeries</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}><img src={ScheduleIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <h2 className={styles['stat-value']}>2</h2>
                        <p className={styles['stat-desc']}>Scheduled for tomorrow</p>
                    </div>
                </div>

                {/* CHARTS SECTION */}
                <div className={styles['charts-section']}>
                    {/* BAR CHART: PATIENTS THIS WEEK */}
                    <div className={styles['chart-card']}>
                        <div className={styles['chart-header']}><h3 className={styles['chart-title']}>Patients This Week</h3></div>
                        <div className={styles['chart-container']}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={patientsThisWeek} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                                    <Tooltip cursor={{fill: 'rgba(1, 83, 139, 0.05)'}} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="patients" fill="#01538b" radius={[6, 6, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    {/* PIE CHART */}
                    <div className={styles['chart-card']}>
                        <div className={styles['chart-header']}><h3 className={styles['chart-title']}>My Treatments</h3></div>
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

                {/* BOTTOM SECTION (LIST + CALENDAR) */}
                <div className={styles['bottom-section']}>
                    {/* MY APPOINTMENTS */}
                    <div className={styles['list-card']}>
                        <div className={styles['list-header']}>
                            <h3 className={styles['list-title']}>My Schedule for Today</h3>
                            <span className={styles['view-all']}>View All</span>
                        </div>
                        <div className={styles['list-content']}>
                            {[
                                { name: "Maria Clara", type: "Orthodontic Adj.", time: "09:00 AM", status: "Done" },
                                { name: "Juan Dela Cruz", type: "Wisdom Tooth Ext.", time: "11:30 AM", status: "Done" },
                                { name: "Jose Rizal", type: "Prophylaxis", time: "02:00 PM", status: "Next" },
                                { name: "Andres B.", type: "Initial Consultation", time: "04:00 PM", status: "Pending" }
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

                    {/* CALENDAR */}
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
        </div>
    );
}