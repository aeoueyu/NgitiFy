import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // NEW: Imported useNavigate
import styles from '../../styles/owner/OwnerDashboard.module.css';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FaBoxOpen, FaHistory, FaCheckCircle, FaUserClock } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

import ProfilePicPlaceholder from '../../assets/icons/MyProfile.svg';
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import PatientIcon from '../../assets/icons/Patient.svg';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: "Araw ng Kagitingan" },
    { month: 4, day: 1, name: "Labor Day" },
    { month: 5, day: 12, name: "Independence Day" },
    { month: 7, day: 21, name: "Ninoy Aquino Day" },
    { month: 7, day: 26, name: "National Heroes Day" },
    { month: 10, day: 1, name: "All Saints' Day" },
    { month: 10, day: 2, name: "All Souls' Day" },
    { month: 10, day: 30, name: "Bonifacio Day" },
    { month: 11, day: 8, name: "Immaculate Conception" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 30, name: "Rizal Day" },
    { month: 11, day: 31, name: "New Year's Eve" }
];

export default function OwnerDashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate(); // NEW: Initialize navigation
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Interactive Calendar States
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Dashboard States
    const [activePatients, setActivePatients] = useState(0);
    const [totalStaff, setTotalStaff] = useState(0);
    const [staffBreakdown, setStaffBreakdown] = useState("Loading...");
    const [lowStockAlerts, setLowStockAlerts] = useState(0);
    
    // Lists and Charts
    const [allAppointments, setAllAppointments] = useState([]);
    const [treatmentData, setTreatmentData] = useState([{ name: 'Loading Data...', value: 1 }]);
    const [inventoryAlerts, setInventoryAlerts] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

                const [usersRes, invRes, surgRes, logsRes] = await Promise.all([
                    fetch('http://localhost:5000/api/users', { headers }),
                    fetch('http://localhost:5000/api/inventory', { headers }),
                    fetch('http://localhost:5000/api/surgeries', { headers }),
                    fetch('http://localhost:5000/api/audit-logs', { headers })
                ]);

                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    const activeUsers = usersData.filter(u => u.status === 'active' && u.isVerified === true);

                    const activeStaff = activeUsers.filter(u => ['dentist', 'secretary', 'owner', 'co-owner'].includes(u.role));
                    const dentists = activeStaff.filter(u => u.role === 'dentist').length;
                    const secretaries = activeStaff.filter(u => u.role === 'secretary').length;
                    
                    setTotalStaff(activeStaff.length);
                    setStaffBreakdown(`${dentists} Dentists, ${secretaries} Secretaries`);
                    setActivePatients(activeUsers.filter(u => u.role === 'patient').length);
                }

                if (invRes.ok) {
                    const invData = await invRes.json();
                    const alerts = invData.filter(item => {
                        const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
                        const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
                        return stock <= limit;
                    }).map(item => ({
                        id: item._id,
                        name: item.itemName || item.name || 'Unknown Item',
                        current: Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0)),
                        threshold: Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0)),
                        unit: item.unit || 'pcs'
                    }));
                    
                    setLowStockAlerts(alerts.length);
                    alerts.sort((a, b) => a.current - b.current);
                    setInventoryAlerts(alerts.slice(0, 6));
                }

                if (surgRes.ok) {
                    const surgData = await surgRes.json();
                    
                    const mappedAllAppts = surgData.map(s => ({
                        name: s.patientName || 'Unknown Patient',
                        type: s.procedure || 'Consultation',
                        time: new Date(s.date || s.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        status: s.status || 'Pending',
                        rawDate: new Date(s.date || s.createdAt)
                    }));
                    setAllAppointments(mappedAllAppts);

                    if (surgData.length > 0) {
                        const procedureCounts = {};
                        surgData.forEach(s => {
                            const proc = s.procedure || 'Consultation';
                            procedureCounts[proc] = (procedureCounts[proc] || 0) + 1;
                        });
                        const topTreatments = Object.entries(procedureCounts)
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value).slice(0, 4);
                        if (topTreatments.length > 0) setTreatmentData(topTreatments);
                    }
                }

                if (logsRes && logsRes.ok) {
                    const logs = await logsRes.json();
                    const formattedLogs = logs.map(log => {
                        let userName = 'System Generated';
                        let userRole = 'system';
                        if (log.user) {
                            if (typeof log.user === 'object') {
                                userName = `${log.user.name?.first || log.user.firstName || ''} ${log.user.name?.last || log.user.lastName || ''}`.trim() || log.user.email || 'Unknown User';
                                userRole = log.user.role || 'system';
                            } else if (typeof log.user === 'string') { userName = log.user; }
                        }
                        const logDate = new Date(log.createdAt || log.timestamp);
                        return {
                            id: log._id || Math.random().toString(),
                            action: log.action || 'Unknown action performed',
                            userName, role: userRole.toLowerCase(), rawDate: logDate,
                            timeDisplay: logDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        };
                    });
                    formattedLogs.sort((a, b) => b.rawDate - a.rawDate);
                    setRecentLogs(formattedLogs.slice(0, 5));
                }

            } catch (error) { console.error("Error fetching dashboard data:", error); }
        };

        fetchDashboardData();
    }, []);

    const displayedAppointments = allAppointments.filter(apt => 
        apt.rawDate.toDateString() === selectedDate.toDateString()
    );

    const getCalendarDays = () => {
        const year = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const days = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            const isSelected = currentDate.toDateString() === selectedDate.toDateString();
            const isToday = currentDate.toDateString() === new Date().toDateString(); 
            const hasEvent = allAppointments.some(apt => apt.rawDate.toDateString() === currentDate.toDateString());
            const holidayObj = PH_HOLIDAYS.find(h => h.month === month && h.day === i);

            days.push({
                num: i,
                active: isSelected,
                isToday: isToday, 
                hasEvent: hasEvent,
                isHoliday: !!holidayObj,
                holidayName: holidayObj ? holidayObj.name : null,
                date: currentDate,
                faded: false
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        const extra = totalCells - days.length;
        for (let i = 1; i <= extra; i++) {
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const handlePrevMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));
    
    const handleDateClick = (day) => {
        setSelectedDate(day.date);
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

    const PIE_COLORS = ['#01538b', '#2dccf6', '#ea8b89', '#f3ca63'];

    return (
        <main className={styles['main-content']}>
            <header className={styles['header']}>
                <div className={styles['header-left']}>
                    <h1 className={styles['title']}>Owner Overview</h1>
                    <p className={styles['subtitle']}>
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
                    </p>
                </div>
                <div className={styles['header-right']}>
                    <div className={styles['user-info']}>
                        <span className={styles['user-name']}>Hello, Admin!</span>
                        <span className={styles['user-role']}>Clinic Owner</span>
                    </div>
                    <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                        <img src={ProfilePicPlaceholder} alt="Profile" className={styles['profile-pic']} />
                        {isProfileOpen && (
                            <div className={styles['profile-dropdown']}>
                                <div className={styles['profile-dropdown-item']}>My Profile</div>
                                <div className={styles['profile-dropdown-item']}>Settings</div>
                                <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={logout}>Logout</div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ROW 1: STATS GRID */}
            <div className={styles['stats-grid']}>
                <div 
                    className={`${styles['stat-card']} ${styles['clickable']}`} 
                    onClick={() => navigate('/owner/manage-users/patients')} // UPDATED PATH
                >
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Active Patients</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}><img src={PatientIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>{activePatients}</h2>
                    <p className={styles['stat-desc']}>Verified active records</p>
                </div>
                
                <div 
                    className={`${styles['stat-card']} ${styles['clickable']}`} 
                    onClick={() => navigate('/owner/manage-users/dentists')} // UPDATED PATH
                >
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Total Staff</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}><img src={StaffIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']}>{totalStaff}</h2>
                    <p className={`${styles['stat-desc']} ${styles['neutral']}`}>{staffBreakdown}</p>
                </div>
                
                <div 
                    className={`${styles['stat-card']} ${styles['clickable']}`}
                    onClick={() => navigate('/owner/inventory')}
                >
                    <div className={styles['stat-header']}>
                        <p className={styles['stat-title']}>Critical Inventory Alerts</p>
                        <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}><img src={InventoryIcon} className={styles['stat-icon']} alt="icon" /></div>
                    </div>
                    <h2 className={styles['stat-value']} style={{ color: '#ea8b89' }}>{lowStockAlerts}</h2>
                    <p className={`${styles['stat-desc']} ${lowStockAlerts > 0 ? styles['danger'] : styles['neutral']}`}>
                        {lowStockAlerts > 0 ? '⚠ Action required' : 'Inventory optimal'}
                    </p>
                </div>
            </div>

            <div className={styles['main-grid']}>
                <div className={styles['left-column']}>
                    <div 
                        className={`${styles['widget-card']} ${styles['clickable']}`} 
                        onClick={() => navigate('/owner/audit-logs')}
                    >
                        <div className={styles['widget-header']}>
                            <FaHistory className={styles['widget-icon']} />
                            <h2 className={styles['widget-title']}>Recent System Activity</h2>
                        </div>
                        {recentLogs.length > 0 ? (
                            <ul className={styles['timeline']}>
                                {recentLogs.map(log => (
                                    <li key={log.id} className={styles['timeline-item']}>
                                        <div className={styles['timeline-dot']}><FaUserClock /></div>
                                        <div className={styles['timeline-content']}>
                                            <p className={styles['log-action']}>{log.action}</p>
                                            <div className={styles['log-meta']}>
                                                <span className={styles['role-tag']}>{log.role}</span>
                                                <span>• {log.userName}</span>
                                                <span>• {log.timeDisplay}</span>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className={styles['empty-state']}><p>No recent system activity found.</p></div>
                        )}
                    </div>

                    <div className={styles['widget-card']}>
                        <div className={styles['widget-header']}>
                            <h2 className={styles['widget-title']}>
                                {isTodaySelected ? "Today's Appointments" : `Appointments for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            </h2>
                            <span className={styles['view-all']}>View All</span>
                        </div>
                        <div className={styles['list-content']}>
                            {displayedAppointments.length > 0 ? (
                                displayedAppointments.map((apt, idx) => (
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
                                <div className={styles['empty-state']}>
                                    <p>No appointments scheduled for this date.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles['right-column']}>
                    <div className={styles['calendar-card']}>
                        <div className={styles['calendar-header']}>
                            <h3 className={styles['month-text']}>{dynamicMonthYear}</h3>
                            <div className={styles['cal-nav']}>
                                <button className={styles['cal-nav-btn']} onClick={handlePrevMonth}>&lt;</button>
                                <button className={styles['cal-nav-btn']} onClick={handleNextMonth}>&gt;</button>
                            </div>
                        </div>
                        
                        <div className={styles['calendar-grid']}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className={styles['day-name']}>{day}</div>
                            ))}
                            
                            {calendarDays.map((day, idx) => (
                                <div 
                                    key={idx} 
                                    title={day.holidayName || ''}
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        ${styles['date-num']} 
                                        ${day.faded ? styles['faded'] : ''} 
                                        ${day.isToday && !day.faded ? styles['today'] : ''}
                                        ${day.active ? styles['active'] : ''}
                                        ${day.isHoliday && !day.faded ? styles['holiday'] : ''}
                                    `}
                                >
                                    {day.num}
                                    {day.hasEvent && <div className={`${styles['event-dot']} ${day.active ? styles['white'] : ''}`}></div>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}