import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { FaCog, FaSignOutAlt } from 'react-icons/fa';
import { authFetch } from '../../utils/api'; 

import DentimeLogo from '../../assets/images/logo-dentime.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import ScheduleIcon from '../../assets/icons/MySchedule.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import AuditIcon from '../../assets/icons/SystemAuditLogs.svg';
import ProfileIcon from '../../assets/icons/MyProfile.svg'; // TASK 1.2: Import Profile Icon

export default function Sidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { canReadPatients, canReadInventory } = usePermissions();
    const isOwner = user?.role === 'owner' || user?.role === 'co-owner';
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const [lowStockCount, setLowStockCount] = useState(0);

    // --- DYNAMIC PATHS ---
    // Automatically adjust paths based on whether the logged in user is a Dentist or Owner
    const dashboardPath = user?.role === 'dentist' ? '/dentist/dashboard' : '/owner/dashboard';
    const appointmentsPath = user?.role === 'dentist' ? '/dentist/appointments' : '/owner/appointments';
    const profilePath = user?.role === 'dentist' ? '/dentist/profile' : '/owner/profile';
    const settingsPath = user?.role === 'dentist' ? '/dentist/settings' : '/owner/settings';

    // Fetch low stock items for the badge
    useEffect(() => {
        if (!canReadInventory) return;

        const fetchInventoryAlerts = async () => {
            try {
                const response = await authFetch('/inventory');
                if (response.ok) {
                    const invData = await response.json();
                    const alerts = invData.filter(item => {
                        const stock = Number(item.quantity !== undefined ? item.quantity : (item.currentStock || 0));
                        const limit = Number(item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0));
                        return stock <= limit;
                    });
                    setLowStockCount(alerts.length);
                }
            } catch (error) {
                console.error("Error fetching inventory for sidebar badge:", error);
            }
        };

        fetchInventoryAlerts();
    }, [canReadInventory]);

    const getNavClass = (path) => {
        if (path === '/owner/manage-users' && location.pathname.includes('/owner/manage-')) {
            return `${styles['nav-item']} ${styles.active}`;
        }
        return location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    };

    // Helper for footer links (Settings, Profile)
    const getFooterNavClass = (path) => {
        return location.pathname === path ? `${styles['settings-link']} ${styles.active}` : styles['settings-link'];
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
                    <div className={getNavClass(dashboardPath)} onClick={() => handleMainNavigation(dashboardPath)}>
                        <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> 
                        <span className={styles['nav-text']}>Dashboard</span>
                    </div>

                    {/* DYNAMIC APPOINTMENTS ROUTE */}
                    <div className={getNavClass(appointmentsPath)} onClick={() => handleMainNavigation(appointmentsPath)}>
                        <img src={ScheduleIcon} alt="Appointments" className={styles['nav-icon']} /> 
                        <span className={styles['nav-text']}>Appointments</span>
                    </div>

                    {isOwner && (
                        <div className={getNavClass('/owner/manage-users')} onClick={() => handleMainNavigation('/owner/manage-users')}>
                            <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>User Management</span>
                        </div>
                    )}

                    {!isOwner && canReadPatients && (
                        <div className={getNavClass('/owner/manage-users/patients')} onClick={() => handleMainNavigation('/owner/manage-users/patients')}>
                            <img src={StaffIcon} alt="Patients" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>Patients</span>
                        </div>
                    )}

                    {canReadInventory && (
                        <div className={getNavClass('/owner/inventory')} onClick={() => handleMainNavigation('/owner/inventory')}>
                            <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>Inventory</span>
                            {lowStockCount > 0 && (
                                <span className={styles['notification-badge']}>{lowStockCount}</span>
                            )}
                        </div>
                    )}

                    {isOwner && (
                        <div className={getNavClass('/owner/audit-logs')} onClick={() => handleMainNavigation('/owner/audit-logs')}>
                            <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>Audit Logs</span>
                        </div>
                    )}
                </div>

                <div className={styles['footer-section']}>
                    {/* TASK 1.2: Added specific My Profile routing to footer */}
                    <div className={getFooterNavClass(profilePath)} onClick={() => handleMainNavigation(profilePath)}>
                        <img src={ProfileIcon} alt="Profile" className={styles['nav-icon']} /> 
                        <span className={styles['nav-text']}>My Profile</span>
                    </div>

                    <div className={getFooterNavClass(settingsPath)} onClick={() => handleMainNavigation(settingsPath)}>
                        <FaCog className={styles['nav-icon']} /> 
                        <span className={styles['nav-text']}>Settings</span>
                    </div>
                    
                    <div className={styles['logout-btn']} onClick={() => setShowLogoutModal(true)}>
                        <FaSignOutAlt className={styles['nav-icon']} /> 
                        <span className={styles['nav-text']}>Logout</span>
                    </div>
                </div>
            </aside>

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