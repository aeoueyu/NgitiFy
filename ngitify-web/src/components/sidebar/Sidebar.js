import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

// --- IMPORTS ---
import DentimeLogo from '../../assets/images/logo-dentime.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import AuditIcon from '../../assets/icons/SystemAuditLogs.svg';
import PatientIcon from '../../assets/icons/Patient.svg';

// Dentist Tools Icons
import DentistIcon from '../../assets/icons/Dentist.svg';
import ScheduleIcon from '../../assets/icons/MySchedule.svg';
import RecordIcon from '../../assets/icons/MedicalRecords.svg';
import AIPredictIcon from '../../assets/icons/AIPredict.svg';
import PrescriptionIcon from '../../assets/icons/EPrescription.svg';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
    const [isDentistToolsOpen, setIsDentistToolsOpen] = useState(false);

    const dentistToolsRoutes = ['/owner/appointments', '/owner/patient-records', '/owner/surgeries', '/owner/prescriptions'];

    // Auto-expand dropdowns if the user refreshes the page while already inside one of those routes
    useEffect(() => {
        if (location.pathname.includes('/owner/manage-')) {
            setIsUserManagementOpen(true);
        }
        if (dentistToolsRoutes.includes(location.pathname)) {
            setIsDentistToolsOpen(true);
        }
    }, [location.pathname]);

    // Helpers to apply the active class for individual direct routes
    const getNavClass = (path) => {
        return location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    };

    const getDropdownClass = (path) => {
        return location.pathname === path ? `${styles['dropdown-item']} ${styles.active}` : styles['dropdown-item'];
    };

    // Helper to handle main navigation clicks (auto-collapse dropdowns)
    const handleMainNavigation = (path) => {
        setIsUserManagementOpen(false);
        setIsDentistToolsOpen(false);
        navigate(path);
    };

    // Parent Active State Checks
    const isManageStaffActive = location.pathname.includes('/owner/manage-');
    const isDentistToolsActive = dentistToolsRoutes.includes(location.pathname);

    return (
        <aside className={styles.sidebar}>
            <div className={styles['logo-container']}>
                <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
            </div>

            <div className={styles['nav-menu']}>
                {/* Main Dashboard */}
                <div className={getNavClass('/owner/dashboard')} onClick={() => handleMainNavigation('/owner/dashboard')}>
                    <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> <span>Dashboard</span>
                </div>

                {/* Manage Staff Dropdown Trigger */}
                <div 
                    className={`${styles['nav-item']} ${isManageStaffActive ? styles.active : ''}`} 
                    onClick={() => {
                        setIsUserManagementOpen(true);
                        setIsDentistToolsOpen(false); // Close the other dropdown to keep UI clean
                        navigate('/owner/manage-dentists'); // Default instant route
                    }}
                    style={{ justifyContent: 'space-between' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src={StaffIcon} alt="Manage Staff" className={styles['nav-icon']} /> 
                        <span>Manage Staff</span>
                    </div>
                    <span style={{ fontSize: '12px' }}>{isUserManagementOpen ? '▲' : '▼'}</span>
                </div>

                {/* Manage Staff Dropdown Items */}
                {isUserManagementOpen && (
                    <div className={styles['dropdown-menu']}>
                        <div className={getDropdownClass('/owner/manage-dentists')} onClick={() => navigate('/owner/manage-dentists')}>
                            <img src={DentistIcon} alt="Dentists" className={styles['nav-icon']} /> Dentists
                        </div>
                        <div className={getDropdownClass('/owner/manage-secretaries')} onClick={() => navigate('/owner/manage-secretaries')}>
                            <img src={StaffIcon} alt="Secretaries" className={styles['nav-icon']} /> Secretaries
                        </div>
                        <div className={getDropdownClass('/owner/manage-patients')} onClick={() => navigate('/owner/manage-patients')}>
                            <img src={PatientIcon} alt="Patients" className={styles['nav-icon']} /> Patients
                        </div>
                    </div>
                )}

                <div className={getNavClass('/owner/inventory')} onClick={() => handleMainNavigation('/owner/inventory')}>
                    <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} /> <span>Inventory</span>
                </div>

                {/* FINANCIAL REPORTS ROUTE COMPLETELY REMOVED HERE */}

                <div className={getNavClass('/owner/audit-logs')} onClick={() => handleMainNavigation('/owner/audit-logs')}>
                    <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> <span>Audit Logs</span>
                </div>

                {/* Dentist Tools Dropdown Trigger */}
                <div 
                    className={`${styles['nav-item']} ${isDentistToolsActive ? styles.active : ''}`} 
                    onClick={() => {
                        setIsDentistToolsOpen(!isDentistToolsOpen); // Keeping this as a toggle since it doesn't have a default parent route
                        setIsUserManagementOpen(false);
                    }} 
                    style={{ marginTop: '10px', borderTop: '1px solid rgba(1, 83, 139, 0.08)', paddingTop: '15px', justifyContent: 'space-between' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src={DentistIcon} alt="Dentist" className={styles['nav-icon']} /> 
                        <span>Dentist Tools</span>
                    </div>
                    <span style={{ fontSize: '12px' }}>{isDentistToolsOpen ? '▲' : '▼'}</span>
                </div>

                {/* Dentist Tools Dropdown Items */}
                {isDentistToolsOpen && (
                    <div className={styles['dropdown-menu']}>
                        <div className={getDropdownClass('/owner/appointments')} onClick={() => navigate('/owner/appointments')}>
                            <img src={ScheduleIcon} alt="Appointments" className={styles['nav-icon']} /> Appointments
                        </div>
                        <div className={getDropdownClass('/owner/patient-records')} onClick={() => navigate('/owner/patient-records')}>
                            <img src={RecordIcon} alt="Records" className={styles['nav-icon']} /> Patient Records
                        </div>
                        <div className={getDropdownClass('/owner/surgeries')} onClick={() => navigate('/owner/surgeries')}>
                            <img src={AIPredictIcon} alt="Simulation" className={styles['nav-icon']} /> Simulation Tool
                        </div>
                        <div className={getDropdownClass('/owner/prescriptions')} onClick={() => navigate('/owner/prescriptions')}>
                            <img src={PrescriptionIcon} alt="Prescriptions" className={styles['nav-icon']} /> Prescriptions
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}