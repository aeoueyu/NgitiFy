import React, { useState, useEffect } from 'react';
import styles from '../../styles/owner/Appointments.module.css';
import { 
    FaPlus, FaSearch, FaRobot, FaUserMd, 
    FaGlobe, FaPhoneAlt, FaWalking, FaBell, FaCheckCircle 
} from 'react-icons/fa';

// --- MOCK DATA ---
const MOCK_DENTISTS = ['Dr. Sarah Smith', 'Dr. Michael Cruz', 'Dr. Emily Chen'];
const MOCK_SOURCES = ['Smile Hub (Online)', 'Walk-in', 'Phone Call', 'AI Chatbot'];

const MOCK_APPOINTMENTS = [
    { id: 1, patientName: 'John Doe', time: '09:00 AM', procedure: 'Teeth Cleaning', status: 'Confirmed', date: new Date(), dentist: 'Dr. Sarah Smith', source: 'Smile Hub (Online)', notificationStatus: 'Confirmed by Patient' },
    { id: 2, patientName: 'Jane Smith', time: '10:30 AM', procedure: 'Root Canal', status: 'Pending', date: new Date(), dentist: 'Dr. Michael Cruz', source: 'Phone Call', notificationStatus: 'Reminder Sent' },
    { id: 3, patientName: 'Mike Johnson', time: '02:00 PM', procedure: 'Consultation', status: 'Completed', date: new Date(), dentist: 'Dr. Emily Chen', source: 'Walk-in', notificationStatus: 'Walk-in (No Notif)' },
    { id: 4, patientName: 'Emily Davis', time: '09:00 AM', procedure: 'Tooth Extraction', status: 'Confirmed', date: new Date(new Date().setDate(new Date().getDate() + 1)), dentist: 'Dr. Sarah Smith', source: 'AI Chatbot', notificationStatus: 'Confirmed by Patient' },
    { id: 5, patientName: 'Chris Wilson', time: '11:00 AM', procedure: 'Braces Adjustment', status: 'Confirmed', date: new Date(new Date().setDate(new Date().getDate() + 2)), dentist: 'Dr. Michael Cruz', source: 'Smile Hub (Online)', notificationStatus: 'Reminder Scheduled' },
];

const PROCEDURE_OPTIONS = [
    "Consultation", "Teeth Cleaning", "Tooth Extraction", "Root Canal", 
    "Dental Fillings", "Braces Adjustment", "Teeth Whitening"
];

export default function Appointments() {
    const [currentMonthView, setCurrentMonthView] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    
    // --- SEARCH & PAGINATION STATE ---
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 5;

    // --- MODAL STATES ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [timeError, setTimeError] = useState('');

    // Reset pagination when date or search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate, searchQuery]);

    // --- FILTER LOGIC ---
    const filteredAppointments = MOCK_APPOINTMENTS.filter(apt => {
        const matchesDate = apt.date.toDateString() === selectedDate.toDateString();
        const matchesSearch = apt.patientName.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesDate && matchesSearch;
    });

    // --- PAGINATION LOGIC ---
    const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedAppointments = filteredAppointments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
            const hasEvent = MOCK_APPOINTMENTS.some(apt => apt.date.toDateString() === currentDate.toDateString());

            days.push({ num: i, active: isSelected, isToday: isToday, hasEvent: hasEvent, date: currentDate, faded: false });
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

    // --- VALIDATION & SAVE LOGIC ---
    const getTodayDateString = () => {
        const today = new Date();
        return today.toISOString().split('T')[0];
    };

    const handleSaveAppointment = (e) => {
        e.preventDefault();
        setTimeError('');

        const selectedDateStr = e.target.appointmentDate.value;
        const selectedTimeStr = e.target.appointmentTime.value;

        if (selectedDateStr && selectedTimeStr) {
            const selectedDateTime = new Date(`${selectedDateStr}T${selectedTimeStr}`);
            if (selectedDateTime < new Date()) {
                setTimeError("Cannot book an appointment for a time that has already passed today.");
                return;
            }
        }
        // Proceed if validation passes (mock data closes modal)
        setIsAddModalOpen(false);
    };

    const calendarDays = getCalendarDays();
    const dynamicMonthYear = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isTodaySelected = selectedDate.toDateString() === new Date().toDateString();

    const getStatusClass = (status) => {
        switch (status) {
            case 'Confirmed': return styles.statusConfirmed;
            case 'Pending': return styles.statusPending;
            case 'Completed': return styles.statusCompleted;
            default: return '';
        }
    };

    const getSourceIcon = (source) => {
        if (source.includes('Smile Hub')) return <FaGlobe />;
        if (source.includes('Phone')) return <FaPhoneAlt />;
        if (source.includes('Walk-in')) return <FaWalking />;
        if (source.includes('AI')) return <FaRobot />;
        return null;
    };

    const getInitials = (name) => {
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    };

    return (
        <div className={styles.container}>
            <div className={styles.headerWrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Appointments</h1>
                    <p className={styles.subtitle}>Manage patient schedules and daily clinic appointments.</p>
                </div>
                <button className={styles.addBtn} onClick={() => { setIsAddModalOpen(true); setTimeError(''); }}>
                    <FaPlus /> Add Appointment
                </button>
            </div>

            <div className={styles.mainGrid}>
                {/* LEFT COLUMN: CALENDAR & AI PANEL */}
                <div className={styles.leftColumn}>
                    {/* Interactive Calendar */}
                    <div className={styles.calendarCard}>
                        <div className={styles.calendarHeader}>
                            <h3 className={styles.monthText}>{dynamicMonthYear}</h3>
                            <div className={styles.calNav}>
                                <button className={styles.calNavBtn} onClick={handlePrevMonth}>&lt;</button>
                                <button className={styles.calNavBtn} onClick={handleNextMonth}>&gt;</button>
                            </div>
                        </div>
                        
                        <div className={styles.calendarGrid}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                <div key={day} className={styles.dayName}>{day}</div>
                            ))}
                            
                            {calendarDays.map((day, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => handleDateClick(day)}
                                    className={`
                                        ${styles.dateNum} 
                                        ${day.faded ? styles.faded : ''} 
                                        ${day.isToday && !day.faded ? styles.today : ''}
                                        ${day.active ? styles.active : ''}
                                    `}
                                >
                                    {day.num}
                                    {day.hasEvent && <div className={`${styles.eventDot} ${day.active ? styles.white : ''}`}></div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AI Suggestions Panel - COLUMN FORMAT */}
                    <div className={styles.aiPanel}>
                        <div className={styles.aiHeader}>
                            <div className={styles.aiIconWrapper}>
                                <FaRobot />
                            </div>
                            <h4 className={styles.aiTitle}>AI Predictive Insights</h4>
                        </div>
                        <p className={styles.aiMessage}>3 patients are due for their 6-month prophylaxis this week based on their visit history.</p>
                        <button className={styles.aiActionBtn}>View Suggestions</button>
                    </div>
                </div>

                {/* RIGHT COLUMN: APPOINTMENT LIST */}
                <div className={styles.listCard}>
                    {/* STICKY HEADER (Title + Search) */}
                    <div className={styles.listHeaderSticky}>
                        <div className={styles.listHeaderTop}>
                            <h3 className={styles.listTitle}>
                                {isTodaySelected ? "Today's Schedule" : `Schedule for ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </h3>
                        </div>
                        <div className={styles.searchWrapperFull}>
                            <FaSearch className={styles.searchIcon} />
                            <input 
                                type="text" 
                                placeholder="Search patient name..." 
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* SCROLLABLE LIST */}
                    <div className={styles.appointmentList}>
                        {paginatedAppointments.length > 0 ? (
                            paginatedAppointments.map((apt) => (
                                <div 
                                    key={apt.id} 
                                    className={styles.appointmentItem}
                                    onClick={() => setSelectedAppointment(apt)}
                                >
                                    <div className={styles.itemTopRow}>
                                        <div className={styles.patientInfo}>
                                            <div className={styles.patientAvatar}>{getInitials(apt.patientName)}</div>
                                            <div className={styles.patientDetails}>
                                                <p className={styles.patientName}>{apt.patientName}</p>
                                                <p className={styles.treatmentType}>{apt.procedure}</p>
                                            </div>
                                        </div>
                                        <div className={styles.appointmentTimeInfo}>
                                            <p className={styles.timeText}>{apt.time}</p>
                                            <span className={`${styles.statusBadge} ${getStatusClass(apt.status)}`}>
                                                {apt.status}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.itemBottomRow}>
                                        <span className={styles.metaBadge} title="Assigned Dentist">
                                            <FaUserMd className={styles.metaIcon} /> {apt.dentist}
                                        </span>
                                        <span className={styles.metaBadge} title="Booking Source">
                                            <span className={styles.metaIcon}>{getSourceIcon(apt.source)}</span> {apt.source}
                                        </span>
                                        <span className={styles.metaBadge} title="Notification Status">
                                            {apt.notificationStatus.includes('Confirmed') ? <FaCheckCircle className={styles.metaIcon} style={{color: '#16a34a'}}/> : <FaBell className={styles.metaIcon} />} {apt.notificationStatus}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyState}>
                                <p>No appointments found for this criteria.</p>
                            </div>
                        )}
                    </div>

                    {/* PAGINATION CONTROLS */}
                    <div className={styles.paginationContainer}>
                        <span>
                            Showing {filteredAppointments.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredAppointments.length)} of {filteredAppointments.length} entries
                        </span>
                        <div className={styles.pageControls}>
                            <button 
                                className={styles.pageBtn} 
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1 || filteredAppointments.length === 0}
                            >
                                Previous
                            </button>
                            <button 
                                className={styles.pageBtn} 
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || filteredAppointments.length === 0}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- ADD APPOINTMENT MODAL --- */}
            {isAddModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle}>Add Appointment</h3>
                        <form onSubmit={handleSaveAppointment}>
                            <div className={styles.row} style={{ marginTop: '25px' }}>
                                <div className={styles.formGroup}>
                                    <label>PATIENT NAME</label>
                                    <input type="text" className={styles.inputField} placeholder="e.g. John Doe" required />
                                </div>
                            </div>
                            
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>PROCEDURE</label>
                                    <select className={styles.inputField} required defaultValue="">
                                        <option value="" disabled hidden>Select Procedure</option>
                                        {PROCEDURE_OPTIONS.map(proc => (
                                            <option key={proc} value={proc}>{proc}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>ASSIGNED DENTIST</label>
                                    <select className={styles.inputField} required defaultValue="">
                                        <option value="" disabled hidden>Select Dentist</option>
                                        {MOCK_DENTISTS.map(dentist => (
                                            <option key={dentist} value={dentist}>{dentist}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>BOOKING SOURCE</label>
                                    <select className={styles.inputField} required defaultValue="">
                                        <option value="" disabled hidden>Select Source</option>
                                        {MOCK_SOURCES.map(source => (
                                            <option key={source} value={source}>{source}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>DATE</label>
                                    <input type="date" name="appointmentDate" className={styles.inputField} min={getTodayDateString()} required />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>TIME</label>
                                    <input 
                                        type="time" 
                                        name="appointmentTime" 
                                        className={`${styles.inputField} ${timeError ? styles.errorBorder : ''}`} 
                                        required 
                                    />
                                </div>
                            </div>
                            
                            {timeError && (
                                <div style={{ textAlign: 'right', marginTop: '-20px', marginBottom: '10px' }}>
                                    <span className={styles.errorText} style={{ display: 'inline-block' }}>{timeError}</span>
                                </div>
                            )}

                            <div className={styles.modalButtonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.submitBtn}>Save Appointment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- VIEW APPOINTMENT MODAL --- */}
            {selectedAppointment && (
                <div className={styles.modalOverlay} onClick={() => setSelectedAppointment(null)}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h3 className={styles.modalTitle}>Appointment Details</h3>
                        
                        <div style={{ marginTop: '30px', textAlign: 'left' }}>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Patient Name</span>
                                <p className={styles.viewValue}>{selectedAppointment.patientName}</p>
                            </div>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Assigned Dentist</span>
                                <p className={styles.viewValue}>{selectedAppointment.dentist}</p>
                            </div>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Procedure</span>
                                <p className={styles.viewValue}>{selectedAppointment.procedure}</p>
                            </div>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Date</span>
                                <p className={styles.viewValue}>{selectedAppointment.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            </div>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Time</span>
                                <p className={styles.viewValue}>{selectedAppointment.time}</p>
                            </div>
                            <div className={styles.viewDetailRow}>
                                <span className={styles.viewLabel}>Booking Source</span>
                                <p className={styles.viewValue}>{selectedAppointment.source}</p>
                            </div>
                            <div className={styles.viewDetailRow} style={{ borderBottom: 'none' }}>
                                <span className={styles.viewLabel}>Status</span>
                                <span className={`${styles.statusBadge} ${getStatusClass(selectedAppointment.status)}`}>
                                    {selectedAppointment.status}
                                </span>
                            </div>
                        </div>

                        <div className={styles.modalButtonGroup} style={{ marginTop: '20px' }}>
                            <button type="button" className={styles.submitBtn} style={{ width: '100%' }} onClick={() => setSelectedAppointment(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}