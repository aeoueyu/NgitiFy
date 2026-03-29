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
import DentistIcon from '../../assets/icons/Dentist.svg';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

    // Auto-expand dropdowns if the user refreshes the page while already inside one of those routes
    useEffect(() => {
        if (location.pathname.includes('/owner/manage-')) {
            setIsUserManagementOpen(true);
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
        navigate(path);
    };

    // Parent Active State Checks
    const isManageStaffActive = location.pathname.includes('/owner/manage-');

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

                <div className={getNavClass('/owner/audit-logs')} onClick={() => handleMainNavigation('/owner/audit-logs')}>
                    <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> <span>Audit Logs</span>
                </div>
            </div>
        </aside>
    );
}