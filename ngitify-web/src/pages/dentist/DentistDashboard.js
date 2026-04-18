// ngitify-web/src/pages/dentist/DentistDashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistDashboard.module.css';
import { 
    FaClock, FaUserInjured, FaClipboardList, 
    FaCheckCircle, FaFileMedical, FaRegCalendarCheck
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatWeekdayDate, formatTime, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

import PatientEMR from './PatientEMR';

const PH_HOLIDAYS = [
    { month: 0,  day: 1,  name: "New Year's Day" },
    { month: 3,  day: 9,  name: "Araw ng Kagitingan" },
    { month: 4,  day: 1,  name: "Labor Day" },
    { month: 5,  day: 12, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 31, name: "New Year's Eve" },
];

// ✅ FIX Bug 26: Shape the backend surgery document into what the dashboard UI expects
const normalizeSurgery = (s) => ({
    id:          s._id,
    patientId:   s.patient?._id || s.patient,
    patientName: s.patient?.name
        ? `${s.patient.name.first} ${s.patient.name.last}`
        : 'Unknown Patient',
    time:        s.time     || '—',
    duration:    s.duration || '—',
    procedure:   s.procedure || '—',
    status:      s.status
        ? (s.status.charAt(0).toUpperCase() + s.status.slice(1))
        : 'Pending',
    rawDate:     new Date(s.date),
    notes:       s.notes || '',
});

export default function DentistDashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [currentTime, setCurrentTime] = useState(new Date());

    // Data States
    const [dentistProfile, setDentistProfile] = useState(null);
    const [allAppointments, setAllAppointments] = useState([]);

    // UI States
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // List & Calendar Filter States
    const [listFilter, setListFilter] = useState('Today');
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ✅ FIX Bug 26: Fetch real appointments from API instead of injecting MOCK_SCHEDULE
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const userId = user?.userId || user?.id || user?._id;

                if (userId) {
                    const [profileRes, surgeriesRes] = await Promise.all([
                        authFetch(`/user/${userId}`),
                        authFetch(`/surgeries?dentistId=${userId}`),
                    ]);

                    if (profileRes.ok) {
                        setDentistProfile(await profileRes.json());
                    }

                    if (surgeriesRes.ok) {
                        const data = await surgeriesRes.json();
                        setAllAppointments(
                            data.map(normalizeSurgery).sort((a, b) => a.rawDate - b.rawDate)
                        );
                    } else {
                        addToast('Failed to load your schedule.', 'error');
                    }
                }
            } catch (error) {
                console.error('Dashboard Fetch Error:', error);
                addToast('Could not connect to the server.', 'error');
            }
        };

        fetchDashboardData();
    }, [user, addToast]);

    // --- DYNAMIC FILTERING LOGIC ---
    const displayedAppointments = allAppointments.filter(apt => {
        const aptDate = apt.rawDate;
        const today = new Date();

        if (listFilter === 'Today') {
            return aptDate.toDateString() === today.toDateString();
        }
        if (listFilter === 'Week') {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            return aptDate >= startOfWeek && aptDate <= endOfWeek;
        }
        if (listFilter === 'All') {
            return true;
        }
        return aptDate.toDateString() === selectedDate.toDateString();
    });

    // Stats (always based on today for accurate daily KPIs)
    const todaysAppts      = allAppointments.filter(apt => apt.rawDate.toDateString() === new Date().toDateString());
    const totalPatients    = todaysAppts.length;
    const pendingTreatments = todaysAppts.filter(apt => ['Confirmed', 'Pending', 'In Clinic', 'In-clinic'].includes(apt.status)).length;
    const completedTreatments = todaysAppts.filter(apt => ['Completed', 'Done'].includes(apt.status)).length;

    // --- CALENDAR LOGIC ---
    const getCalendarDays = () => {
        const year  = currentMonthView.getFullYear();
        const month = currentMonthView.getMonth();
        const firstDay      = new Date(year, month, 1).getDay();
        const daysInMonth   = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const days = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ num: daysInPrevMonth - i, faded: true, date: new Date(year, month - 1, daysInPrevMonth - i) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const currentDate = new Date(year, month, i);
            const isSelected  = currentDate.toDateString() === selectedDate.toDateString();
            const isToday     = currentDate.toDateString() === new Date().toDateString();
            const hasEvent    = allAppointments.some(apt => apt.rawDate.toDateString() === currentDate.toDateString());
            const holidayObj  = PH_HOLIDAYS.find(h => h.month === month && h.day === i);

            days.push({
                num: i,
                active: isSelected,
                isToday,
                hasEvent,
                isHoliday:   !!holidayObj,
                holidayName: holidayObj ? holidayObj.name : null,
                date:        currentDate,
                faded:       false,
            });
        }

        const totalCells = days.length > 35 ? 42 : 35;
        const extra = totalCells - days.length;
        for (let i = 1; i <= extra; i++) {
            days.push({ num: i, faded: true, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const handlePrevMonth  = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() - 1, 1));
    const handleNextMonth  = () => setCurrentMonthView(new Date(currentMonthView.getFullYear(), currentMonthView.getMonth() + 1, 1));

    const handleDateClick = (day) => {
        setSelectedDate(day.date);
        setListFilter('Date');
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays     = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected  = selectedDate.toDateString() === new Date().toDateString();

    const getStatusClass = (status) => {
        switch (status) {
            case 'Pending':
            case 'Confirmed':   return styles['status-pending'];
            case 'In Clinic':
            case 'In-clinic':   return styles['status-in-clinic'];
            case 'Done':
            case 'Completed':   return styles['status-done'];
            default:            return styles['status-pending'];
        }
    };

    const dentistName = dentistProfile?.name?.first
        ? `${dentistProfile.name.first} ${dentistProfile.name.last}`
        : user?.name?.first
            ? `${user.name.first} ${user.name.last}`
            : 'Dentist';

    const profilePic = dentistProfile?.profileImage || user?.profileImage;

    return (
        <>
            <main className={styles['main-content']}>
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Clinical Dashboard</h1>
                        <p className={styles['subtitle']}>
                            {formatWeekdayDate(currentTime)} <span style={{ margin: '0 8px', color: '#2dccf6' }}>|</span> <strong style={{ color: '#01538b' }}>{formatTime(currentTime, true)}</strong>
                        </p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, Dr. {dentistName.split(' ')[0]}!</span>
                            <span className={styles['user-role']}>Dentist</span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <UserAvatar
                                user={{ name: dentistName, profileImage: profilePic }}
                                size={45}
                            />
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={() => { setIsProfileOpen(false); navigate('/dentist/profile'); }}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/dentist/settings')}>Settings</div>
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

                <div className={styles['main-grid']}>
                    {/* LEFT COLUMN: SCHEDULE */}
                    <div className={styles['left-column']}>
                        <div className={styles['widget-card']}>
                            <div className={styles['filterHeader']}>
                                <h2 className={styles['widget-title']}>
                                    <FaRegCalendarCheck className={styles['widget-icon']} />
                                    {listFilter === 'Date'
                                        ? (isTodaySelected ? "Today's Schedule" : `Schedule for ${formatDateShort(selectedDate)}`)
                                        : listFilter === 'Today' ? "Today's Clinical Schedule"
                                        : listFilter === 'Week'  ? "This Week's Schedule"
                                        : "All Appointments"
                                    }
                                </h2>
                                <div className={styles.pillGroup}>
                                    <button className={`${styles.filterPill} ${listFilter === 'Today' ? styles.activePill : ''}`} onClick={() => setListFilter('Today')}>Today</button>
                                    <button className={`${styles.filterPill} ${listFilter === 'Week'  ? styles.activePill : ''}`} onClick={() => setListFilter('Week')}>Week</button>
                                    <button className={`${styles.filterPill} ${listFilter === 'All'   ? styles.activePill : ''}`} onClick={() => setListFilter('All')}>All</button>
                                </div>
                            </div>

                            <div className={styles['list-content']}>
                                {displayedAppointments.length > 0 ? (
                                    displayedAppointments.map((apt) => (
                                        <div key={apt.id} className={styles['appointment-item']}>
                                            <div className={styles['time-block']}>
                                                <p className={styles['time-text']}>{apt.time}</p>
                                                <p className={styles['stat-desc']} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                                                <button className={styles['emr-btn']} onClick={() => { setSelectedPatientId(apt.patientId); setIsEMRModalOpen(true); }}>
                                                    <FaFileMedical /> View EMR
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles['empty-state']}>
                                        <p>Your schedule is clear for this selection.</p>
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
                                            ${day.active && listFilter === 'Date' ? styles['active'] : ''}
                                            ${day.isHoliday && !day.faded ? styles['holiday'] : ''}
                                        `}
                                    >
                                        {day.num}
                                        {day.hasEvent && <div className={`${styles['event-dot']} ${day.active && listFilter === 'Date' ? styles['white'] : ''}`}></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* EMR MODAL */}
            {isEMRModalOpen && selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => setIsEMRModalOpen(false)}
                    onEdit={() => addToast('Edit Profile action coming soon', 'info')}
                />
            )}

            {/* LOGOUT CONFIRM */}
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