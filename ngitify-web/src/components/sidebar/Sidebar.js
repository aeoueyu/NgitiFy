import React from 'react';
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

    // Helper to apply the active class for individual direct routes
    const getNavClass = (path) => {
        // Keeps the tab active if the user is anywhere inside user management
        if (path === '/owner/manage-users' && location.pathname.includes('/owner/manage-')) {
            return `${styles['nav-item']} ${styles.active}`;
        }
        return location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    };

    const handleMainNavigation = (path) => {
        navigate(path);
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles['logo-container']}>
                <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
            </div>

            <div className={styles['nav-menu']}>
                <div className={getNavClass('/owner/dashboard')} onClick={() => handleMainNavigation('/owner/dashboard')}>
                    <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> <span>Dashboard</span>
                </div>

                {/* NEW: Single Link for User Management */}
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
                
                <div className={styles['logout-btn']} onClick={logout}>
                    <FaSignOutAlt className={styles['nav-icon']} /> 
                    <span>Logout</span>
                </div>
            </div>
        </aside>
    );
}