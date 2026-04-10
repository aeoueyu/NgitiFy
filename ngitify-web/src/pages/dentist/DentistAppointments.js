import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistAppointments.module.css';
import { 
    FaClock, FaFileMedical, FaSearch, FaCalendarAlt,
    FaBoxOpen, FaTrash, FaPlus
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

// Imported Modular Components
import PatientEMR from './PatientEMR';
import MaterialUsageLog from './MaterialUsageLog';

// --- ROBUST MOCK DATA FOR UI TESTING ---
const MOCK_SCHEDULE = [
    { id: 1, patientId: 'PT-2023-0842', time: '09:00 AM', duration: '60 Min', patientName: 'Eleanor Vance', procedure: 'Root Canal Therapy', status: 'In Clinic', rawDate: new Date() },
    { id: 2, patientId: 'PT-2024-1105', time: '10:30 AM', duration: '30 Min', patientName: 'Marcus Chen', procedure: 'Routine Prophylaxis', status: 'Confirmed', rawDate: new Date() },
    { id: 3, patientId: 'PT-2023-0199', time: '11:15 AM', duration: '45 Min', patientName: 'Sophia Reyes', procedure: 'Composite Filling', status: 'Pending', rawDate: new Date() },
    { id: 4, patientId: 'PT-2022-0441', time: '01:00 PM', duration: '60 Min', patientName: 'James Wilson', procedure: 'Tooth Extraction', status: 'Completed', rawDate: new Date(new Date().setDate(new Date().getDate() - 1)) },
    { id: 5, patientId: 'PT-2021-0911', time: '09:00 AM', duration: '60 Min', patientName: 'David Lee', procedure: 'Braces Adjustment', status: 'Confirmed', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: 6, patientId: 'PT-2023-0222', time: '11:00 AM', duration: '45 Min', patientName: 'Maria Santos', procedure: 'Crown Fitting', status: 'Confirmed', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: 7, patientId: 'PT-2024-0012', time: '02:30 PM', duration: '90 Min', patientName: 'Lucas Torres', procedure: 'Wisdom Tooth Extraction', status: 'Completed', rawDate: new Date() },
];

const PH_HOLIDAYS = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 3, day: 9, name: "Araw ng Kagitingan" },
    { month: 4, day: 1, name: "Labor Day" },
    { month: 5, day: 12, name: "Independence Day" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 31, name: "New Year's Eve" }
];

export default function DentistAppointments() {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); 
    const { addToast } = useToast();
    
    // Header & Global Modal States
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false); 
    
    // EMR Modal States
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // Material Logger Modal States
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [selectedAptForMaterial, setSelectedAptForMaterial] = useState(null);

    // --- FILTER STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [procedureFilter, setProcedureFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Calendar States
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [listFilter, setListFilter] = useState('Date');

    // Extract unique procedures for the dropdown
    const dynamicProcedures = useMemo(() => {
        const procedures = MOCK_SCHEDULE.map(apt => apt.procedure).filter(Boolean);
        return [...new Set(procedures)].sort();
    }, []);

    // --- FILTER LOGIC ---
    const displayedAppointments = MOCK_SCHEDULE.filter(apt => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = apt.patientName.toLowerCase().includes(searchLower) || 
                              apt.procedure.toLowerCase().includes(searchLower);
        
        const matchesProcedure = procedureFilter === 'All' || apt.procedure === procedureFilter;
        
        let matchesDate = true;
        
        // If the user has explicitly set the start/end date inputs, use those
        if (startDate || endDate) {
            if (startDate) {
                matchesDate = matchesDate && new Date(apt.rawDate) >= new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); 
                matchesDate = matchesDate && new Date(apt.rawDate) <= end;
            }
        } else {
            // Otherwise, filter by the currently selected calendar date
            matchesDate = apt.rawDate.toDateString() === selectedDate.toDateString();
        }

        return matchesSearch && matchesProcedure && matchesDate;
    });

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
        // Clear manual date filters so the calendar selection takes precedence
        setStartDate('');
        setEndDate('');
        if (day.faded) setCurrentMonthView(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // --- RENDER HELPERS ---
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

    const handleLogoutClick = () => {
        setIsProfileOpen(false);
        setShowLogoutModal(true);
    };

    const handleProfileNavigation = () => {
        setIsProfileOpen(false);
        navigate('/dentist/profile'); 
    };

    const handleViewEMR = (patientId) => {
        setSelectedPatientId(patientId);
        setIsEMRModalOpen(true);
    };

    const handleOpenMaterialLog = (apt) => {
        setSelectedAptForMaterial(apt);
        setIsMaterialModalOpen(true);
    };

    const dentistName = user?.name?.first ? `${user.name.first} ${user.name.last}` : 'Dentist';

    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Clinical Appointments</h1>
                        <p className={styles['subtitle']}>Manage your patient schedule, access EMRs, and log materials.</p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, Dr. {dentistName.split(' ')[0]}!</span>
                            <span className={styles['user-role']}>Dentist</span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            <UserAvatar 
                                user={{ name: dentistName, profileImage: user?.profileImage }} 
                                size={45} 
                            />
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={handleProfileNavigation}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/dentist/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={handleLogoutClick}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* --- FILTER CONTROLS --- */}
                <div className={styles.controlsRow}>
                    <div className={styles.searchFilterGroup}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input 
                                type="text" 
                                placeholder="Search patient name or procedure..." 
                                className={styles.searchInput} 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                            />
                        </div>
                        
                        <select 
                            className={styles.filterSelect} 
                            value={procedureFilter}
                            onChange={(e) => setProcedureFilter(e.target.value)}
                        >
                            <option value="All">All Procedures</option>
                            {dynamicProcedures.map((proc, i) => (
                                <option key={`proc-${i}`} value={proc}>{proc}</option>
                            ))}
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                }}
                                title="From Date"
                            />
                            <span className={styles.dateSeparator}>-</span>
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                title="To Date"
                            />
                        </div>
                    </div>
                </div>

                <div className={styles['main-grid']}>
                    {/* LEFT COLUMN: LIST CONTAINER */}
                    <div className={styles['left-column']}>
                        <div className={styles['listContainer']} style={{ height: '100%' }}>
                            {displayedAppointments.length > 0 ? (
                                displayedAppointments.map((apt) => (
                                    <div key={apt.id} className={styles['appointment-item']}>
                                        
                                        <div className={styles['time-block']}>
                                            <p className={styles['time-text']}>{formatDateShort(apt.rawDate)}</p>
                                            <p className={styles['stat-desc']}>
                                                <FaClock style={{ fontSize: '10px' }}/> {apt.time} • {apt.duration}
                                            </p>
                                        </div>
                                        
                                        <div className={styles['patient-block']}>
                                            <UserAvatar user={{ name: apt.patientName }} size={45} style={{ border: '2px solid #e0f2fe' }} />
                                            <div className={styles['patient-details']}>
                                                <p className={styles['patient-name']}>{apt.patientName}</p>
                                                <p className={styles['treatment-type']}>{apt.procedure}</p>
                                            </div>
                                        </div>

                                        <div className={styles['action-block']}>
                                            <span className={`${styles['status-badge']} ${getStatusClass(apt.status)}`}>
                                                {apt.status}
                                            </span>
                                            
                                            <button className={styles['emr-btn']} onClick={() => handleViewEMR(apt.patientId)}>
                                                <FaFileMedical /> View EMR
                                            </button>

                                            {/* CONDITIONAL RENDER: Log Materials Button */}
                                            {(apt.status === 'Completed' || apt.status === 'Done') && (
                                                <button className={styles['logMaterialsBtn']} onClick={() => handleOpenMaterialLog(apt)}>
                                                    <FaBoxOpen /> Log Materials
                                                </button>
                                            )}
                                        </div>

                                    </div>
                                ))
                            ) : (
                                <div className={styles['empty-state']}>
                                    <p>No appointments match your current filters.</p>
                                </div>
                            )}
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
                                            ${day.active && !startDate && !endDate ? styles['active'] : ''} 
                                            ${day.isHoliday && !day.faded ? styles['holiday'] : ''}
                                        `}
                                    >
                                        {day.num}
                                        {day.hasEvent && <div className={`${styles['event-dot']} ${day.active && !startDate && !endDate ? styles['white'] : ''}`}></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* EMR MODAL INJECTION */}
            {isEMRModalOpen && selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => setIsEMRModalOpen(false)}
                    onEdit={() => addToast("Edit Profile action coming soon", "info")}
                />
            )}

            {/* POST-TREATMENT MATERIAL LOGGER MODAL */}
            {isMaterialModalOpen && selectedAptForMaterial && (
                <MaterialUsageLog 
                    appointment={selectedAptForMaterial}
                    onClose={() => {
                        setIsMaterialModalOpen(false);
                        setSelectedAptForMaterial(null);
                    }}
                />
            )}

            {/* CRITICAL RULE: ConfirmModal implementation */}
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