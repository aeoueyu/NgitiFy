import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { FaCog, FaSignOutAlt } from 'react-icons/fa';
import { authFetch } from '../../utils/api'; 

// CRITICAL RULE: Import ConfirmModal
import ConfirmModal from '../common/ConfirmModal'; 

import DentimeLogo from '../../assets/images/logo-dentime.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import ScheduleIcon from '../../assets/icons/MySchedule.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import AuditIcon from '../../assets/icons/SystemAuditLogs.svg';
import ProfileIcon from '../../assets/icons/MyProfile.svg';

export default function Sidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const { canReadPatients, canReadInventory } = usePermissions();
    const isOwner = user?.role === 'owner' || user?.role === 'co-owner';
    const isSecretary = user?.role === 'secretary';
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const [lowStockCount, setLowStockCount] = useState(0);

    // --- DYNAMIC PATHS LOGIC ---
    const getBasePath = () => {
        if (user?.role === 'dentist') return '/dentist';
        if (user?.role === 'secretary') return '/secretary';
        return '/owner';
    };
    const basePath = getBasePath();

    const dashboardPath = `${basePath}/dashboard`;
    const appointmentsPath = `${basePath}/appointments`;
    const profilePath = `${basePath}/profile`;
    const settingsPath = `${basePath}/settings`;
    const inventoryPath = `${basePath}/inventory`;
    
    // Dedicated patient path routing if the user is a secretary
    const patientsPath = isSecretary ? '/secretary/patients' : '/owner/manage-users/patients';

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
                        <div className={getNavClass(patientsPath)} onClick={() => handleMainNavigation(patientsPath)}>
                            <img src={StaffIcon} alt="Patients" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>Patients</span>
                        </div>
                    )}

                    {canReadInventory && (
                        <div className={getNavClass(inventoryPath)} onClick={() => handleMainNavigation(inventoryPath)}>
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