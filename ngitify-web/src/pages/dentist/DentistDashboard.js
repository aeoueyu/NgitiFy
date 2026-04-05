import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistDashboard.module.css';
import { 
    FaClock, FaUserInjured, FaClipboardList, 
    FaCheckCircle, FaFileMedical, FaRegCalendarCheck
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

// Import the EMR Patient Profile component
import PatientProfile from '../owner/PatientProfile';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: "Araw ng Kagitingan" },
    { month: 4, day: 1, name: "Labor Day" },
    { month: 5, day: 12, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 31, name: "New Year's Eve" }
];

// --- MOCK CLINICAL DATA ---
const MOCK_SCHEDULE = [
    { id: 1, patientId: 'PT-2023-0842', time: '09:00 AM', duration: '60 Min', patientName: 'Eleanor Vance', procedure: 'Root Canal Therapy', status: 'In Clinic', rawDate: new Date() },
    { id: 2, patientId: 'PT-2024-1105', time: '10:30 AM', duration: '30 Min', patientName: 'Marcus Chen', procedure: 'Routine Prophylaxis', status: 'Confirmed', rawDate: new Date() },
    { id: 3, patientId: 'PT-2023-0199', time: '11:15 AM', duration: '45 Min', patientName: 'Sophia Reyes', procedure: 'Composite Filling', status: 'Confirmed', rawDate: new Date() },
    { id: 4, patientId: 'PT-2022-0441', time: '01:00 PM', duration: '60 Min', patientName: 'James Wilson', procedure: 'Tooth Extraction', status: 'Completed', rawDate: new Date() },
    { id: 5, patientId: 'PT-2021-0911', time: '09:00 AM', duration: '60 Min', patientName: 'David Lee', procedure: 'Braces Adjustment', status: 'Confirmed', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
];

export default function DentistDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); 
    
    // Live Clock State
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Profile Data State
    const [dentistProfile, setDentistProfile] = useState(null);

    // Header & Global Modal States
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false); 
    
    // EMR Modal States
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // Interactive Calendar States
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Live Clock Effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Extract JWT & Fetch Profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(base64));
                const userId = payload.userId || payload.id || payload._id;

                const response = await fetch(`http://localhost:5000/api/user/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const profileData = await response.json();
                    setDentistProfile(profileData);
                }
            } catch (error) {
                console.error("Error fetching dentist profile:", error);
            }
        };

        fetchProfile();
    }, []);

    // Filter Schedule based on selected calendar date
    const displayedAppointments = MOCK_SCHEDULE.filter(apt => 
        apt.rawDate.toDateString() === selectedDate.toDateString()
    );

    // Calculate Stats (Based on currently selected date)
    const totalPatients = displayedAppointments.length;
    const pendingTreatments = displayedAppointments.filter(apt => apt.status === 'Confirmed' || apt.status === 'In Clinic').length;
    const completedTreatments = displayedAppointments.filter(apt => apt.status === 'Completed').length;

    // --- CALENDAR LOGIC ---
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
            const hasEvent = MOCK_SCHEDULE.some(apt => apt.rawDate.toDateString() === currentDate.toDateString());
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

    // --- RENDER HELPERS ---
    const getStatusClass = (status) => {
        switch (status) {
            case 'Confirmed': return styles['status-pending'];
            case 'In Clinic': return styles['status-in-clinic'];
            case 'Completed': return styles['status-done'];
            default: return '';
        }
    };

    const handleLogoutClick = () => {
        setIsProfileOpen(false);
        setShowLogoutModal(true);
    };

    const handleProfileNavigation = () => {
        setIsProfileOpen(false);
        navigate('/owner/profile'); 
    };

    const handleViewEMR = (patientId) => {
        setSelectedPatientId(patientId);
        setIsEMRModalOpen(true);
    };

    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Clinical Dashboard</h1>
                        <p className={styles['subtitle']}>
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, Dr. {dentistProfile?.name?.first || user?.name?.first || 'Dentist'}!</span>
                            <span className={styles['user-role']}>
                                {dentistProfile?.role || user?.role === 'dentist' ? 'Dentist' : 'Staff'}
                            </span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            {dentistProfile?.profileImage || user?.profileImage ? (
                                <img src={dentistProfile?.profileImage || user?.profileImage} alt="Profile" className={styles['profile-pic']} />
                            ) : (
                                <div className={styles['profile-pic']} style={{
                                    backgroundColor: '#01538b', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '16px',
                                    borderRadius: '50%'
                                }}>
                                    {(() => {
                                        const first = dentistProfile?.name?.first || user?.name?.first || 'S';
                                        const last = dentistProfile?.name?.last || user?.name?.last || 'D';
                                        return (first.charAt(0) + last.charAt(0)).toUpperCase();
                                    })()}
                                </div>
                            )}
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={handleProfileNavigation}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/owner/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={handleLogoutClick}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* STATS GRID */}
                <div className={styles['stats-grid']}>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Patients Today</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}>
                                <FaUserInjured className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{totalPatients}</h2>
                        <p className={styles['stat-desc']}>Scheduled appointments</p>
                    </div>
                    
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Pending Treatments</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                                <FaClipboardList className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{pendingTreatments}</h2>
                        <p className={styles['stat-desc']}>Awaiting clinical action</p>
                    </div>
                    
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Completed</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                                <FaCheckCircle className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{completedTreatments}</h2>
                        <p className={styles['stat-desc']}>Successfully treated today</p>
                    </div>
                </div>

                {/* MAIN TWO-COLUMN GRID */}
                <div className={styles['main-grid']}>
                    
                    {/* LEFT COLUMN: SCHEDULE */}
                    <div className={styles['left-column']}>
                        <div className={styles['widget-card']}>
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaRegCalendarCheck className={styles['widget-icon']} /> 
                                    {isTodaySelected ? "Today's Clinical Schedule" : `Schedule for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                </h2>
                            </div>
                            
                            <div className={styles['list-content']}>
                                {displayedAppointments.length > 0 ? (
                                    displayedAppointments.map((apt) => (
                                        <div key={apt.id} className={styles['appointment-item']}>
                                            
                                            <div className={styles['time-block']}>
                                                <p className={styles['time-text']}>{apt.time}</p>
                                                <p className={styles['stat-desc']} style={{margin: 0, display: 'flex', alignItems: 'center', gap: '4px'}}>
                                                    <FaClock style={{ fontSize: '10px' }}/> {apt.duration}
                                                </p>
                                            </div>
                                            
                                            <div className={styles['patient-block']}>
                                                <p className={styles['patient-name']}>{apt.patientName}</p>
                                                <p className={styles['treatment-type']}>{apt.procedure}</p>
                                            </div>

                                            <div className={styles['action-block']}>
                                                <span className={`${styles['status-badge']} ${getStatusClass(apt.status)}`}>
                                                    {apt.status}
                                                </span>
                                                
                                                <button className={styles['emr-btn']} onClick={() => handleViewEMR(apt.patientId)}>
                                                    <FaFileMedical /> View EMR
                                                </button>
                                            </div>

                                        </div>
                                    ))
                                ) : (
                                    <div className={styles['empty-state']}>
                                        <p>Your schedule is clear for this date.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: CALENDAR */}
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

            {/* EMR MODAL INJECTION */}
            {isEMRModalOpen && selectedPatientId && (
                <PatientProfile
                    patientId={selectedPatientId}
                    onClose={() => setIsEMRModalOpen(false)}
                    onEdit={() => alert("Edit Profile action placeholder")}
                />
            )}

            {/* LOGOUT CONFIRMATION MODAL */}
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