import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { FaCog, FaSignOutAlt } from 'react-icons/fa';

import DentimeLogo from '../../assets/images/logo-dentime.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import AuditIcon from '../../assets/icons/SystemAuditLogs.svg';
import PatientIcon from '../../assets/icons/Patient.svg';
import DentistIcon from '../../assets/icons/Dentist.svg';

export default function Sidebar() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);

    useEffect(() => {
        if (location.pathname.includes('/owner/manage-')) {
            setIsUserManagementOpen(true);
        }
    }, [location.pathname]);

    const getNavClass = (path) => location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    const getDropdownClass = (path) => location.pathname === path ? `${styles['dropdown-item']} ${styles.active}` : styles['dropdown-item'];

    const handleMainNavigation = (path) => {
        setIsUserManagementOpen(false);
        navigate(path);
    };

    const isManageStaffActive = location.pathname.includes('/owner/manage-');

    return (
        <aside className={styles.sidebar}>
            <div className={styles['logo-container']}>
                <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
            </div>

            <div className={styles['nav-menu']}>
                <div className={getNavClass('/owner/dashboard')} onClick={() => handleMainNavigation('/owner/dashboard')}>
                    <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> <span>Dashboard</span>
                </div>

                <div 
                    className={`${styles['nav-item']} ${isManageStaffActive ? styles.active : ''}`} 
                    onClick={() => {
                        setIsUserManagementOpen(true);
                        navigate('/owner/manage-dentists'); 
                    }}
                    style={{ justifyContent: 'space-between' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src={StaffIcon} alt="Manage Staff" className={styles['nav-icon']} /> 
                        <span>Manage Staff</span>
                    </div>
                    <span style={{ fontSize: '12px' }}>{isUserManagementOpen ? '▲' : '▼'}</span>
                </div>

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

            {/* UPDATED: Clean Footer Section */}
            <div className={styles['footer-section']}>
                <div className={styles['settings-link']} onClick={() => handleMainNavigation('/owner/settings')}>
                    <FaCog className={styles['nav-icon']} /> 
                    <span>Settings</span>
                </div>
                
                <div className={styles['logout-btn']} onClick={logout}>
                    <FaSignOutAlt className={styles['nav-icon']} /> 
                    <span>Logout</span>
                </div>
            </div>
        </aside>
    );
}