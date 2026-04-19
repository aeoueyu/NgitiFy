import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { FaCog, FaSignOutAlt, FaTools, FaListUl, FaBell, FaShieldAlt, FaChartBar, FaCodeBranch, FaHeadset, FaDatabase } from 'react-icons/fa';
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
    const isAdmin = user?.role === 'administrator' || user?.role === 'co-administrator' || user?.role === 'branch-manager';
    const isSecretary = user?.role === 'secretary';
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const [lowStockCount, setLowStockCount] = useState(0);

    const [notifUnreadCount, setNotifUnreadCount] = useState(0);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchNotifCount = async () => {
            try {
                const res = await authFetch('/notifications');
                if (res.ok) {
                    const data = await res.json();
                    setNotifUnreadCount(data.filter(n => !n.isRead).length);
                }
            } catch (e) { /* silent */ }
        };
        fetchNotifCount();
        const interval = setInterval(fetchNotifCount, 60000);
        return () => clearInterval(interval);
    }, [isAdmin]);

    // --- DYNAMIC PATHS LOGIC ---
    // Task 16 Fix: Route 'co-administrator' to the '/administrator' base path
    const getBasePath = () => {
        if (user?.role === 'dentist') return '/dentist';
        if (user?.role === 'secretary') return '/secretary';
        if (user?.role === 'administrator' || user?.role === 'co-administrator' || user?.role === 'branch-manager') return '/admin';
        return '/login'; // Fallback just in case
    };
    
    const basePath = getBasePath();

    const dashboardPath = `${basePath}/dashboard`;
    const appointmentsPath = `${basePath}/appointments`;
    const profilePath = `${basePath}/profile`;
    const settingsPath = `${basePath}/settings`;
    const inventoryPath = `${basePath}/inventory`;
    
    // Dedicated patient path routing if the user is a secretary
    const patientsPath = isSecretary ? '/secretary/patients' : '/admin/manage-users/patients';

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
        if (path === '/admin/manage-users' && location.pathname.includes('/admin/manage-')) {
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

                    {isAdmin && (
                        <div className={getNavClass('/admin/manage-users')} onClick={() => handleMainNavigation('/admin/manage-users')}>
                            <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>User Management</span>
                        </div>
                    )}

                    {!isAdmin && canReadPatients && (
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

                    {isAdmin && (
                        <div className={getNavClass('/admin/notifications')} onClick={() => handleMainNavigation('/admin/notifications')}>
                            <FaBell className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Notifications</span>
                            {notifUnreadCount > 0 && (
                                <span className={styles['notification-badge']}>{notifUnreadCount}</span>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/queue')} onClick={() => handleMainNavigation('/admin/queue')}>
                            <FaListUl className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Queue</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/chat-support')} onClick={() => handleMainNavigation('/admin/chat-support')}>
                            <FaHeadset className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Chat Support</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/roles')} onClick={() => handleMainNavigation('/admin/roles')}>
                            <FaShieldAlt className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Roles & Permissions</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/branches')} onClick={() => handleMainNavigation('/admin/branches')}>
                            <FaCodeBranch className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Branches</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/branches/analytics')} onClick={() => handleMainNavigation('/admin/branches/analytics')}>
                            <FaChartBar className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Branch Analytics</span>
                        </div>
                    )}
                
                    {isAdmin && (
                        <div className={getNavClass('/admin/audit-trail')} onClick={() => handleMainNavigation('/admin/audit-trail')}>
                            <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> 
                            <span className={styles['nav-text']}>Audit Trail</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getNavClass('/admin/activity-logs')} onClick={() => handleMainNavigation('/admin/activity-logs')}>
                            <FaListUl className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Activity Logs</span>
                        </div>
                    )}
                </div>

                <div className={styles['footer-section']}>
                    {isAdmin && (
                        <div className={getFooterNavClass('/admin/system-config')} onClick={() => handleMainNavigation('/admin/system-config')}>
                            <FaTools className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>System Config</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getFooterNavClass('/admin/backup')} onClick={() => handleMainNavigation('/admin/backup')}>
                            <FaDatabase className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Database Backup</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className={getFooterNavClass('/admin/integrity')} onClick={() => handleMainNavigation('/admin/integrity')}>
                            <FaTools className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Integrity Tools</span>
                        </div>
                    )}

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