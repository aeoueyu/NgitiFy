import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/AdminDashboard.module.css';
import { 
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
    AreaChart, Area, XAxis, YAxis, CartesianGrid // TASK 4.1: Imported AreaChart components
} from 'recharts';
import { 
    FaBoxOpen, FaHistory, FaCheckCircle, FaUserClock, 
    FaArrowUp, FaArrowDown, FaChartPie, FaUserPlus, 
    FaCalendarPlus, FaTimes, FaExclamationTriangle,
    FaChartLine, FaBell
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { formatWeekdayDate, formatTime, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar'; 

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

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); 
    const [currentTime, setCurrentTime] = useState(new Date());
    
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false); 
    
    const [showAlertBanner, setShowAlertBanner] = useState(true);

    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [activePatients, setActivePatients] = useState(0);
    const [totalStaff, setTotalStaff] = useState(0);
    const [staffBreakdown, setStaffBreakdown] = useState("Loading...");
    const [lowStockAlerts, setLowStockAlerts] = useState(0);
    
    const [allAppointments, setAllAppointments] = useState([]);
    
    // TASK 4.1: Chart States
    const [treatmentData, setTreatmentData] = useState([{ name: 'Loading Data...', value: 1 }]);
    const [patientVolumeData, setPatientVolumeData] = useState([]); 

    const [inventoryAlerts, setInventoryAlerts] = useState([]);
    const [recentLogs, setRecentLogs] = useState([]);

    const [adminProfile, setAdminProfile] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, invRes, surgRes, logsRes] = await Promise.all([
                    authFetch('/dashboard/stats'),
                    authFetch('/inventory'),
                    authFetch('/surgeries'),
                    authFetch('/audit-logs')
                ]);

                const userId = user?.userId || user?.id || user?._id;
                if (userId) {
                    const profileRes = await authFetch(`/user/${userId}`);
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        setAdminProfile(profileData);
                    }
                }

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setActivePatients(statsData.totalPatients);
                    setTotalStaff(statsData.activeDentists);
                    setStaffBreakdown(`${statsData.activeDentists} Dentists`);
                    setLowStockAlerts(statsData.lowStockItems);
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
                        time: formatTime(s.date || s.createdAt),
                        status: s.status || 'Pending',
                        rawDate: new Date(s.date || s.createdAt)
                    }));
                    setAllAppointments(mappedAllAppts);

                    if (surgData.length > 0) {
                        // Treatment Breakdown Calculation
                        const procedureCounts = {};
                        surgData.forEach(s => {
                            const proc = s.procedure || 'Consultation';
                            procedureCounts[proc] = (procedureCounts[proc] || 0) + 1;
                        });
                        const topTreatments = Object.entries(procedureCounts)
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value).slice(0, 4);
                        if (topTreatments.length > 0) setTreatmentData(topTreatments);

                        // TASK 4.1: Patient Volume Trend Calculation (Last 6 Months)
                        const volumeDataMap = {};
                        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const now = new Date();
                        
                        for (let i = 5; i >= 0; i--) {
                            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            volumeDataMap[`${monthNames[d.getMonth()]}`] = 0;
                        }

                        surgData.forEach(s => {
                            const date = new Date(s.date || s.createdAt);
                            const month = monthNames[date.getMonth()];
                            if (volumeDataMap[month] !== undefined) {
                                volumeDataMap[month]++;
                            }
                        });

                        const volumeChartData = Object.keys(volumeDataMap).map(key => ({
                            name: key,
                            patients: volumeDataMap[key]
                        }));
                        setPatientVolumeData(volumeChartData);
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
                            timeDisplay: `${formatDateShort(logDate)}, ${formatTime(logDate)}`
                        };
                    });
                    formattedLogs.sort((a, b) => b.rawDate - a.rawDate);
                    setRecentLogs(formattedLogs.slice(0, 5));
                }

            } catch (error) { console.error("Error fetching dashboard data:", error); }
        };

        fetchDashboardData();
    }, []);

    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const res = await authFetch('/notifications');
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.filter(n => !n.isRead).length);
                }
            } catch (e) { /* silent */ }
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 60000);
        return () => clearInterval(interval);
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

    const handleLogoutClick = () => {
        setIsProfileOpen(false);
        setShowLogoutModal(true);
    };

    const handleProfileNavigation = () => {
        setIsProfileOpen(false);
        navigate('/admin/profile');
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

    const PIE_COLORS = ['#01538b', '#2dccf6', '#ea8b89', '#f3ca63'];

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Administrator Overview</h1>
                        <p className={styles['subtitle']}>
                            {formatWeekdayDate(currentTime)} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{formatTime(currentTime, true)}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        {/* 🔔 Notification Bell */}
                        <button
                            className={styles['bell-btn']}
                            onClick={() => navigate('/admin/notifications')}
                            aria-label="Notifications"
                        >
                            <FaBell className={styles['bell-icon']} />
                            {unreadCount > 0 && (
                                <span className={styles['bell-badge']}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>

                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, {adminProfile?.name?.first || user?.name?.first || 'Admin'}!</span>
                            <span className={styles['user-role']}>
                                {(() => {
                                    const role = adminProfile?.role || user?.role || '';
                                    const roleMap = {
                                        'admin': 'Clinic Admin',
                                        'dentist': 'Dentist',
                                        'secretary': 'Front Desk Personnel',
                                        'patient': 'Patient'
                                    };
                                    return roleMap[role] || 'Staff';
                                })()}
                            </span>
                        </div>

                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <UserAvatar 
                                user={adminProfile || user || { name: 'Admin' }} 
                                size={45} 
                            />
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={handleProfileNavigation}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/admin/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={handleLogoutClick}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {lowStockAlerts > 0 && showAlertBanner && (
                    <div className={styles['alert-banner']}>
                        <div className={styles['alert-content']}>
                            <FaExclamationTriangle style={{ fontSize: '16px' }} />
                            <span>Action Required: {lowStockAlerts} items have reached critically low stock levels.</span>
                        </div>
                        <button className={styles['alert-close-btn']} onClick={() => setShowAlertBanner(false)} aria-label="Close Alert">
                            <FaTimes />
                        </button>
                    </div>
                )}

                <div className={styles['stats-grid']}>
                    <div className={`${styles['stat-card']} ${styles['clickable']}`} onClick={() => navigate('/admin/manage-users/patients')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Active Patients</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}><img src={PatientIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{activePatients}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-positive']}`} title="Stable growth">
                                <FaArrowUp style={{ fontSize: '10px' }} /> Active
                            </span>
                        </div>
                        <p className={styles['stat-desc']}>Verified active records</p>
                    </div>
                    
                    <div className={`${styles['stat-card']} ${styles['clickable']}`} onClick={() => navigate('/admin/manage-users/dentists')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Total Staff</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}><img src={StaffIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']}>{totalStaff}</h2>
                            <span className={`${styles['trend-indicator']} ${styles['trend-neutral']}`} title="Maintained retention">
                                <FaCheckCircle style={{ fontSize: '10px' }} /> Stable
                            </span>
                        </div>
                        <p className={`${styles['stat-desc']} ${styles['neutral']}`}>{staffBreakdown}</p>
                    </div>
                    
                    <div className={`${styles['stat-card']} ${styles['clickable']}`} onClick={() => navigate('/admin/inventory')}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Critical Inventory Alerts</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-pink']}`}><img src={InventoryIcon} className={styles['stat-icon']} alt="icon" /></div>
                        </div>
                        <div className={styles['stat-value-wrapper']}>
                            <h2 className={styles['stat-value']} style={{ color: '#ea8b89' }}>{lowStockAlerts}</h2>
                            {lowStockAlerts > 0 ? (
                                <span className={`${styles['trend-indicator']} ${styles['trend-negative']}`} title="Needs Restock">
                                    <FaArrowDown style={{ fontSize: '10px' }} /> Low
                                </span>
                            ) : (
                                <span className={`${styles['trend-indicator']} ${styles['trend-positive']}`} title="All good">
                                    <FaCheckCircle style={{ fontSize: '10px' }} /> Safe
                                </span>
                            )}
                        </div>
                        <p className={`${styles['stat-desc']} ${lowStockAlerts > 0 ? styles['danger'] : styles['neutral']}`}>
                            {lowStockAlerts > 0 ? '⚠ Action required' : 'Inventory optimal'}
                        </p>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    <div className={styles['left-column']}>
                        
                        {/* TASK 4.1: New Patient Volume Area Chart */}
                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <FaChartLine className={styles['widget-icon']} />
                                <h2 className={styles['widget-title']}>Patient Volume Trend (6 Mo)</h2>
                            </div>
                            <div className={styles['chart-container']}>
                                {patientVolumeData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={patientVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#2dccf6" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#2dccf6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} 
                                                itemStyle={{ color: '#01538b', fontWeight: 'bold' }}
                                            />
                                            <Area type="monotone" dataKey="patients" name="Appointments" stroke="#01538b" strokeWidth={3} fillOpacity={1} fill="url(#colorPatients)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className={styles['empty-state']}><p>Gathering volume data...</p></div>
                                )}
                            </div>
                        </div>

                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <FaChartPie className={styles['widget-icon']} />
                                <h2 className={styles['widget-title']}>Treatment Breakdown</h2>
                            </div>
                            <div className={styles['chart-container']}>
                                {treatmentData.length > 0 && treatmentData[0].name !== 'Loading Data...' ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={treatmentData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {treatmentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className={styles['empty-state']}><p>No treatment data available yet.</p></div>
                                )}
                            </div>
                        </div>

                        <div 
                            className={`${styles['widget-card']} ${styles['clickable']}`} 
                            onClick={() => navigate('/admin/audit-trail')}
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
                                                <UserAvatar 
                                                    user={{ name: apt.name }} 
                                                    size={42} 
                                                    className={styles['patient-avatar']}
                                                    style={{ backgroundColor: '#e0f2fe', color: '#01538b' }}
                                                />
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
                </div>

                <div className={styles['quick-actions-bar']}>
                    <button 
                        className={`${styles['quick-action-btn']} ${styles['secondary']}`} 
                        onClick={() => navigate('/admin/manage-users/patients', { state: { openAddModal: true } })} 
                    >
                        <FaUserPlus /> Add Patient
                    </button>
                    <button 
                        className={styles['quick-action-btn']} 
                        onClick={() => navigate('/admin/appointments')}
                    >
                        <FaCalendarPlus /> Add Appointment
                    </button>
                </div>
            </main>

            {showLogoutModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle}>Confirm Logout</h3>
                        <p className={styles.modalMessage}>Are you sure you want to end your session and logout of the system?</p>
                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} onClick={() => setShowLogoutModal(false)}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={logout}>Yes, Logout</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}