// ngitify-web/src/pages/secretary/SecretaryDashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryDashboard.module.css';
import { 
    FaClock, FaUserInjured, FaClipboardList, 
    FaUserPlus, FaRegCalendarCheck, FaCheck, FaUserMd
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

// CRITICAL RULE IMPORTS
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatWeekdayDate, formatTime, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: "Araw ng Kagitingan" },
    { month: 4, day: 1, name: "Labor Day" },
    { month: 5, day: 12, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 31, name: "New Year's Eve" }
];

const STATUS_DISPLAY = {
    'pending':   'Pending',
    'confirmed': 'Confirmed',
    'in-clinic': 'In Clinic',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
};

export default function SecretaryDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); 
    const { addToast } = useToast();
    
    const [currentTime, setCurrentTime] = useState(new Date());
    
    // Data States
    const [secretaryProfile, setSecretaryProfile] = useState(null);
    const [allAppointments, setAllAppointments] = useState([]);
    const [newRegistrations, setNewRegistrations] = useState(0);
    
    // UI States
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false); 
    const [checkInTarget, setCheckInTarget] = useState(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    // Calendar States
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const userId = user?.id || user?._id;
                if (userId) {
                    const profileRes = await authFetch(`/user/${userId}`);
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        setSecretaryProfile(profileData);
                    }
                }

                const statsRes = await authFetch('/dashboard/stats');
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setNewRegistrations(statsData.newRegistrations ?? 0);
                }

                const surgRes = await authFetch('/surgeries');
                if (surgRes.ok) {
                    const surgData = await surgRes.json();
                    const mapped = surgData.map(s => ({
                        id: s._id,
                        patientId: s.patient?._id || '',
                        patientName: s.patient?.name
                            ? `${s.patient.name.first || ''} ${s.patient.name.last || ''}`.trim()
                            : 'Unknown Patient',
                        dentistName: s.dentist?.name
                            ? `Dr. ${s.dentist.name.first || ''} ${s.dentist.name.last || ''}`.trim()
                            : 'Unassigned',
                        procedure: s.procedure || 'Consultation',
                        time: s.time || formatTime(new Date(s.date)),
                        duration: s.duration || '—',
                        status: STATUS_DISPLAY[s.status] || s.status,
                        rawStatus: s.status,
                        rawDate: new Date(s.date),
                    }));
                    setAllAppointments(mapped.sort((a, b) => a.rawDate - b.rawDate));
                }

            } catch (error) {
                console.error("Dashboard Fetch Error:", error);
                addToast("Could not connect to the server.", "error");
            }
        };

        fetchDashboardData();
    }, [user, addToast]);

    // Filter appointments for the selected date
    const displayedAppointments = allAppointments.filter(apt => 
        apt.rawDate.toDateString() === selectedDate.toDateString()
    );

    // Calculate Stats based on today's real data
    const todaysAppts = allAppointments.filter(apt => apt.rawDate.toDateString() === new Date().toDateString());
    const totalAppointments = todaysAppts.length;
    const patientsWaiting = todaysAppts.filter(apt => 
        apt.rawStatus === 'confirmed' || apt.rawStatus === 'pending' || apt.rawStatus === 'in-clinic'
    ).length;

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

    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending':
            case 'Confirmed': return styles['status-pending'];
            case 'In Clinic': return styles['status-in-clinic'];
            case 'Done':
            case 'Completed': return styles['status-done'];
            default: return styles['status-pending'];
        }
    };

    const secName = secretaryProfile?.name?.first 
        ? `${secretaryProfile.name.first} ${secretaryProfile.name.last}` 
        : user?.name?.first 
            ? `${user.name.first} ${user.name.last}` 
            : 'Secretary';
            
    const profilePic = secretaryProfile?.profileImage || user?.profileImage;

    // --- CHECK IN LOGIC ---
    const handleConfirmCheckIn = async () => {
        if (!checkInTarget) return;
        setIsCheckingIn(true);
        try {
            const res = await authFetch(`/surgeries/${checkInTarget.id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'in-clinic' }),
            });

            if (res.ok) {
                setAllAppointments(prev => prev.map(apt => 
                    apt.id === checkInTarget.id 
                        ? { ...apt, status: 'In Clinic', rawStatus: 'in-clinic' } 
                        : apt
                ));
                addToast(`${checkInTarget.patientName} has been successfully checked into the clinic.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to check in patient.', 'error');
            }
        } catch (error) {
            addToast('Could not connect to server.', 'error');
        } finally {
            setIsCheckingIn(false);
            setCheckInTarget(null);
        }
    };

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Front Desk Dashboard</h1>
                        <p className={styles['subtitle']}>
                            {formatWeekdayDate(currentTime)} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{formatTime(currentTime, true)}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, {secName.split(' ')[0]}!</span>
                            <span className={styles['user-role']}>Front Desk</span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <UserAvatar 
                                user={{ name: secName, profileImage: profilePic }} 
                                size={45} 
                            />
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={() => { setIsProfileOpen(false); navigate('/secretary/profile'); }}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/secretary/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={() => { setIsProfileOpen(false); setShowLogoutModal(true); }}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* STATS GRID */}
                <div className={styles['stats-grid']}>
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Today's Appointments</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-blue']}`}>
                                <FaRegCalendarCheck className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{totalAppointments}</h2>
                        <p className={styles['stat-desc']}>Across all dentists</p>
                    </div>
                    
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>Patients Waiting</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-cyan']}`}>
                                <FaUserInjured className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{patientsWaiting}</h2>
                        <p className={styles['stat-desc']}>Scheduled to be seen</p>
                    </div>
                    
                    <div className={styles['stat-card']}>
                        <div className={styles['stat-header']}>
                            <p className={styles['stat-title']}>New Registrations</p>
                            <div className={`${styles['stat-icon-wrapper']} ${styles['bg-green']}`}>
                                <FaUserPlus className={`${styles['stat-icon']} ${styles['raw']}`} />
                            </div>
                        </div>
                        <h2 className={styles['stat-value']}>{newRegistrations}</h2>
                        <p className={styles['stat-desc']}>Patients added today</p>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    {/* LEFT COLUMN: CLINIC SCHEDULE */}
                    <div className={styles['left-column']}>
                        <div className={styles['widget-card']}>
                            
                            <div className={styles['widget-header']}>
                                <h2 className={styles['widget-title']}>
                                    <FaClipboardList className={styles['widget-icon']} /> 
                                    {isTodaySelected ? "Today's Clinic Schedule" : `Clinic Schedule: ${formatDateShort(selectedDate)}`}
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
                                                <p className={styles['dentist-name']}>
                                                    <FaUserMd /> {apt.dentistName}
                                                </p>
                                                <p className={styles['treatment-type']}>{apt.procedure}</p>
                                            </div>

                                            <div className={styles['action-block']}>
                                                <span className={`${styles['status-badge']} ${getStatusClass(apt.status)}`}>
                                                    {apt.status}
                                                </span>
                                                
                                                {(apt.rawStatus === 'confirmed' || apt.rawStatus === 'pending') && (
                                                    <button 
                                                        className={styles['checkin-btn']} 
                                                        onClick={() => setCheckInTarget(apt)}
                                                        title="Check In Patient"
                                                    >
                                                        <FaCheck /> Check In
                                                    </button>
                                                )}
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

            {/* CHECK-IN CONFIRMATION MODAL */}
            <ConfirmModal 
                isOpen={!!checkInTarget}
                title="Check In Patient"
                message={`Are you sure you want to mark ${checkInTarget?.patientName} as arrived and currently in the clinic?`}
                confirmText={isCheckingIn ? "Checking In..." : "Yes, Check In"}
                isDestructive={false}
                onConfirm={handleConfirmCheckIn}
                onCancel={() => setCheckInTarget(null)}
            />

            {/* LOGOUT CONFIRMATION MODAL */}
            <ConfirmModal 
                isOpen={showLogoutModal}
                title="Confirm Logout"
                message="Are you sure you want to end your session and logout of the system?"
                confirmText="Yes, Logout"
                isDestructive={true}
                onConfirm={logout}
                onCancel={() => setShowLogoutModal(false)}
            />
        </>
    );
}