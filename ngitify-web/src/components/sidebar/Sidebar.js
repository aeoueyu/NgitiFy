import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { FaCog, FaSignOutAlt, FaTools, FaListUl, FaBell, FaShieldAlt, FaChartBar, FaCodeBranch, FaHeadset, FaDatabase, FaTooth } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';

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

    const isAdmin         = user?.role === 'administrator' || user?.role === 'co-administrator';
    const isBranchManager = user?.role === 'branch-manager';
    const isSecretary     = user?.role === 'secretary';
    const isOwner         = user?.role === 'owner';
    const isDentistOwner  = isOwner && user?.isDentist;
    const isDentistUser   = user?.role === 'dentist';

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);

    // ── Full profile for avatar + name display ──
    const [sidebarProfile, setSidebarProfile] = useState(null);

    useEffect(() => {
        const userId = user?.userId || user?.id || user?._id;
        if (!userId) return;
        const fetchProfile = async () => {
            try {
                const res = await authFetch(`/user/${userId}`);
                if (res.ok) {
                    const data = await res.json();
                    setSidebarProfile(data);
                }
            } catch (e) { /* silent */ }
        };
        fetchProfile();
    }, [user]);

    useEffect(() => {
        if (!isAdmin && !isBranchManager && !isOwner) return;
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
    }, [isAdmin, isBranchManager, isOwner]);

    const getBasePath = () => {
        if (user?.role === 'dentist')        return '/dentist';
        if (user?.role === 'secretary')      return '/secretary';
        if (user?.role === 'branch-manager') return '/branch-manager';
        if (user?.role === 'owner')          return '/owner';
        if (user?.role === 'administrator' || user?.role === 'co-administrator') return '/admin';
        return '/login';
    };

    const basePath = getBasePath();
    const dashboardPath    = `${basePath}/dashboard`;
    const appointmentsPath = `${basePath}/appointments`;
    const settingsPath     = `${basePath}/settings`;
    const inventoryPath    = `${basePath}/inventory`;
    const profilePath      = `${basePath}/profile`;

    const patientsPath = isSecretary
        ? '/secretary/patients'
        : isBranchManager
            ? '/branch-manager/manage-users'
            : '/admin/manage-users/patients';

    useEffect(() => {
        // Owner always has full inventory access — bypass the permissions check
        if (!canReadInventory && !isOwner) return;
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
                console.error('Error fetching inventory for sidebar badge:', error);
            }
        };
        fetchInventoryAlerts();
    }, [canReadInventory, isOwner]);

    const getNavClass = (path) => {
        const isManageUsers = path === '/admin/manage-users' && location.pathname.includes('/admin/manage-');
        if (isManageUsers) return `${styles['nav-item']} ${styles.active}`;
        return location.pathname === path || location.pathname.startsWith(path + '/')
            ? `${styles['nav-item']} ${styles.active}`
            : styles['nav-item'];
    };

    const getFooterNavClass = (path) =>
        location.pathname === path ? `${styles['settings-link']} ${styles.active}` : styles['settings-link'];

    // ── Resolve display name and avatar from fetched profile ──
    // sidebarProfile uses { name: { first, last }, profileImage } (MongoDB shape)
    // Fall back to user.firstName/lastName from auth context while loading
    const displayFirst = sidebarProfile?.name?.first || user?.firstName || '';
    const displayLast  = sidebarProfile?.name?.last  || user?.lastName  || '';
    const displayName  = `${displayFirst} ${displayLast}`.trim() || 'User';

    // UserAvatar accepts { name: { first, last }, profileImage } OR { firstName, lastName, profileImage }
    // Pass the fetched profile if available (it has the nested name shape), otherwise pass a compatible object
    const avatarUser = sidebarProfile || {
        name: { first: displayFirst, last: displayLast },
        profileImage: user?.profileImage || ''
    };

    const roleLabel = {
        'administrator':    'Administrator',
        'co-administrator': 'Co-Administrator',
        'branch-manager':   'Branch Manager',
        'dentist':          'Dentist',
        'secretary':        'Secretary',
        'owner':            'Owner',
    }[user?.role] || '';

    return (
        <>
            <aside className={styles.sidebar}>

                {/* ── USER PROFILE SECTION ── */}
                {user && (
                    <div className={styles['profile-section']}>
                        <UserAvatar
                            user={avatarUser}
                            size={44}
                        />
                        <div className={styles['profile-info']}>
                            <span className={styles['profile-name']}>{displayName}</span>
                            {roleLabel && (
                                <span className={`${styles['role-badge']} ${styles[`role-${user.role}`] || ''}`}>
                                    {roleLabel}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div className={styles['nav-menu']}>
                    {/* ── SHARED: Dashboard & Appointments ── */}
                    <div className={getNavClass(dashboardPath)} onClick={() => navigate(dashboardPath)}>
                        <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Dashboard</span>
                    </div>

                    <div className={getNavClass(appointmentsPath)} onClick={() => navigate(appointmentsPath)}>
                        <img src={ScheduleIcon} alt="Appointments" className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Appointments</span>
                    </div>

                    {/* ── ADMIN (administrator + co-administrator) ── */}
                    {isAdmin && (
                        <div className={getNavClass('/admin/manage-users')} onClick={() => navigate('/admin/manage-users')}>
                            <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>User Management</span>
                        </div>
                    )}

                    {/* ── BRANCH MANAGER ── */}
                    {isBranchManager && (
                        <>
                            <div className={getNavClass('/branch-manager/manage-users')} onClick={() => navigate('/branch-manager/manage-users')}>
                                <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>User Management</span>
                            </div>

                            <div className={getNavClass('/branch-manager/notifications')} onClick={() => navigate('/branch-manager/notifications')}>
                                <FaBell className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Notifications</span>
                                {notifUnreadCount > 0 && (
                                    <span className={styles['notification-badge']}>{notifUnreadCount}</span>
                                )}
                            </div>

                            <div className={getNavClass('/branch-manager/queue')} onClick={() => navigate('/branch-manager/queue')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Queue</span>
                            </div>

                            <div className={getNavClass('/branch-manager/chat-support')} onClick={() => navigate('/branch-manager/chat-support')}>
                                <FaHeadset className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Chat Support</span>
                            </div>

                            <div className={getNavClass('/branch-manager/analytics')} onClick={() => navigate('/branch-manager/analytics')}>
                                <FaChartBar className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Branch Analytics</span>
                            </div>

                            <div className={getNavClass('/branch-manager/activity-logs')} onClick={() => navigate('/branch-manager/activity-logs')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Activity Logs</span>
                            </div>
                        </>
                    )}

                    {/* ── OWNER ── */}
                    {isOwner && (
                        <>
                            <div className={getNavClass('/owner/manage-users')} onClick={() => navigate('/owner/manage-users')}>
                                <img src={StaffIcon} alt="User Management" className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>User Management</span>
                            </div>

                            <div className={getNavClass('/owner/notifications')} onClick={() => navigate('/owner/notifications')}>
                                <FaBell className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Notifications</span>
                                {notifUnreadCount > 0 && (
                                    <span className={styles['notification-badge']}>{notifUnreadCount}</span>
                                )}
                            </div>

                            <div className={getNavClass('/owner/roles')} onClick={() => navigate('/owner/roles')}>
                                <FaShieldAlt className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Roles & Permissions</span>
                            </div>

                            <div className={getNavClass('/owner/branches')} onClick={() => navigate('/owner/branches')}>
                                <FaCodeBranch className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Branches</span>
                            </div>

                            <div className={getNavClass('/owner/branches/analytics')} onClick={() => navigate('/owner/branches/analytics')}>
                                <FaChartBar className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Branch Analytics</span>
                            </div>

                            <div className={getNavClass('/owner/inventory')} onClick={() => navigate('/owner/inventory')}>
                                <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Inventory</span>
                                {lowStockCount > 0 && (
                                    <span className={styles['notification-badge']}>{lowStockCount}</span>
                                )}
                            </div>

                            <div className={getNavClass('/owner/activity-logs')} onClick={() => navigate('/owner/activity-logs')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Activity Logs</span>
                            </div>
                        </>
                    )}

                    {/* ── SECRETARY / DENTIST: Patients ── */}
                    {!isAdmin && !isBranchManager && canReadPatients && (
                        <div className={getNavClass(patientsPath)} onClick={() => navigate(patientsPath)}>
                            <img src={StaffIcon} alt="Patients" className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Patients</span>
                        </div>
                    )}

                    {/* ── INVENTORY (admin + branch-manager) ── */}
                    {(isAdmin || isBranchManager) && (
                        <div className={getNavClass(inventoryPath)} onClick={() => navigate(inventoryPath)}>
                            <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Inventory</span>
                            {lowStockCount > 0 && (
                                <span className={styles['notification-badge']}>{lowStockCount}</span>
                            )}
                        </div>
                    )}

                    {canReadInventory && !isAdmin && !isBranchManager && (
                        <div className={getNavClass(inventoryPath)} onClick={() => navigate(inventoryPath)}>
                            <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} />
                            <span className={styles['nav-text']}>Inventory</span>
                        </div>
                    )}

                    {/* ── DENTIST-SPECIFIC items ── */}
                    {isDentistUser && (
                        <>
                            <div className={getNavClass('/dentist/material-usage')} onClick={() => navigate('/dentist/material-usage')}>
                                <FaTooth className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Material Usage</span>
                            </div>

                            <div className={getNavClass('/dentist/notifications')} onClick={() => navigate('/dentist/notifications')}>
                                <FaBell className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Notifications</span>
                            </div>

                            <div className={getNavClass('/dentist/activity-logs')} onClick={() => navigate('/dentist/activity-logs')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Activity Logs</span>
                            </div>
                        </>
                    )}

                    {/* ── ADMIN-ONLY items ── */}
                    {isAdmin && (
                        <>
                            <div className={getNavClass('/admin/notifications')} onClick={() => navigate('/admin/notifications')}>
                                <FaBell className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Notifications</span>
                                {notifUnreadCount > 0 && (
                                    <span className={styles['notification-badge']}>{notifUnreadCount}</span>
                                )}
                            </div>

                            <div className={getNavClass('/admin/queue')} onClick={() => navigate('/admin/queue')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Queue</span>
                            </div>

                            <div className={getNavClass('/admin/chat-support')} onClick={() => navigate('/admin/chat-support')}>
                                <FaHeadset className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Chat Support</span>
                            </div>

                            <div className={getNavClass('/admin/roles')} onClick={() => navigate('/admin/roles')}>
                                <FaShieldAlt className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Roles & Permissions</span>
                            </div>

                            <div className={getNavClass('/admin/branches')} onClick={() => navigate('/admin/branches')}>
                                <FaCodeBranch className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Branches</span>
                            </div>

                            <div className={getNavClass('/admin/branches/analytics')} onClick={() => navigate('/admin/branches/analytics')}>
                                <FaChartBar className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Branch Analytics</span>
                            </div>

                            <div className={getNavClass('/admin/audit-trail')} onClick={() => navigate('/admin/audit-trail')}>
                                <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Audit Trail</span>
                            </div>

                            <div className={getNavClass('/admin/activity-logs')} onClick={() => navigate('/admin/activity-logs')}>
                                <FaListUl className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Activity Logs</span>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles['footer-section']}>
                    {/* Admin-only footer items */}
                    {isAdmin && (
                        <>
                            <div className={getFooterNavClass('/admin/system-config')} onClick={() => navigate('/admin/system-config')}>
                                <FaTools className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>System Config</span>
                            </div>

                            <div className={getFooterNavClass('/admin/backup')} onClick={() => navigate('/admin/backup')}>
                                <FaDatabase className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Database Backup</span>
                            </div>

                            <div className={getFooterNavClass('/admin/integrity')} onClick={() => navigate('/admin/integrity')}>
                                <FaTools className={styles['nav-icon']} />
                                <span className={styles['nav-text']}>Integrity Tools</span>
                            </div>
                        </>
                    )}

                    <div className={getFooterNavClass(profilePath)} onClick={() => navigate(profilePath)}>
                        <img src={ProfileIcon} alt="My Profile" className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>My Profile</span>
                    </div>

                    <div className={getFooterNavClass(settingsPath)} onClick={() => navigate(settingsPath)}>
                        <FaCog className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Settings</span>
                    </div>

                    <div className={styles['logout-btn']} onClick={() => setShowLogoutModal(true)}>
                        <FaSignOutAlt className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Logout</span>
                    </div>
                </div>
            </aside>

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