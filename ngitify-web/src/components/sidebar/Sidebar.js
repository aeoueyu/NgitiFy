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

export default function Sidebar() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // State for Logout Modal
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const getNavClass = (path) => {
        if (path === '/owner/manage-users' && location.pathname.includes('/owner/manage-')) {
            return `${styles['nav-item']} ${styles.active}`;
        }
        return location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    };

    const handleMainNavigation = (path) => {
        navigate(path);
    };

    return (
        <>
            <aside className={styles.sidebar}>
                <div className={styles['logo-container']}>
                    <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
                </div>

                <div className={styles['nav-menu']}>
                    <div className={getNavClass('/owner/dashboard')} onClick={() => handleMainNavigation('/owner/dashboard')}>
                        <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> <span>Dashboard</span>
                    </div>

                    <div className={getNavClass('/owner/manage-users')} onClick={() => handleMainNavigation('/owner/manage-users')}>
                        <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} /> <span>User Management</span>
                    </div>

                    <div className={getNavClass('/owner/inventory')} onClick={() => handleMainNavigation('/owner/inventory')}>
                        <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} /> <span>Inventory</span>
                    </div>

                    <div className={getNavClass('/owner/audit-logs')} onClick={() => handleMainNavigation('/owner/audit-logs')}>
                        <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> <span>Audit Logs</span>
                    </div>
                </div>

                <div className={styles['footer-section']}>
                    <div className={styles['settings-link']} onClick={() => handleMainNavigation('/owner/settings')}>
                        <FaCog className={styles['nav-icon']} /> 
                        <span>Settings</span>
                    </div>
                    
                    {/* Trigger Logout Modal */}
                    <div className={styles['logout-btn']} onClick={() => setShowLogoutModal(true)}>
                        <FaSignOutAlt className={styles['nav-icon']} /> 
                        <span>Logout</span>
                    </div>
                </div>
            </aside>

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