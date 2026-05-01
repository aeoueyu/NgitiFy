import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import {
    FaBell,
    FaBoxes,
    FaCalendarCheck,
    FaChartBar,
    FaClipboardList,
    FaCodeBranch,
    FaCog,
    FaDatabase,
    FaFileMedical,
    FaHeadset,
    FaListUl,
    FaRobot,
    FaShieldAlt,
    FaSignOutAlt,
    FaTachometerAlt,
    FaTooth,
    FaTools,
    FaUserCircle,
    FaUserInjured,
    FaUsers,
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import AIChatAssistant from '../common/AIChatAssistant';

export default function Sidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const { canReadInventory } = usePermissions();

    const isAdmin = user?.role === 'administrator' || user?.role === 'co-administrator';
    const isBranchManager = user?.role === 'branch-manager';
    const isSecretary = user?.role === 'secretary';
    const isOwner = user?.role === 'owner';
    const isDentistUser = user?.role === 'dentist';

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);
    const [sidebarProfile, setSidebarProfile] = useState(null);

    useEffect(() => {
        const userId = user?.userId || user?.id || user?._id;
        if (!userId) return;

        const fetchProfile = async () => {
            try {
                const res = await authFetch(`/user/${userId}`);
                if (res.ok) {
                    setSidebarProfile(await res.json());
                }
            } catch {}
        };

        fetchProfile();
    }, [user]);

    useEffect(() => {
        if (!isAdmin && !isBranchManager && !isOwner && !isSecretary) return;

        const fetchNotifCount = async () => {
            try {
                const res = await authFetch('/notifications');
                if (res.ok) {
                    const data = await res.json();
                    setNotifUnreadCount(data.filter((n) => !n.isRead).length);
                }
            } catch {}
        };

        fetchNotifCount();
        const interval = setInterval(fetchNotifCount, 60000);
        return () => clearInterval(interval);
    }, [isAdmin, isBranchManager, isOwner, isSecretary]);

    const getBasePath = () => {
        if (user?.role === 'dentist') return '/dentist';
        if (user?.role === 'secretary') return '/secretary';
        if (user?.role === 'branch-manager') return '/branch-manager';
        if (user?.role === 'owner') return '/owner';
        if (user?.role === 'administrator' || user?.role === 'co-administrator') return '/admin';
        return '/login';
    };

    const basePath = getBasePath();
    const dashboardPath = `${basePath}/dashboard`;
    const appointmentsPath = `${basePath}/appointments`;
    const settingsPath = `${basePath}/settings`;
    const inventoryPath = `${basePath}/inventory`;
    const profilePath = `${basePath}/profile`;

    useEffect(() => {
        if (!canReadInventory && !isOwner) return;

        const fetchInventoryAlerts = async () => {
            try {
                const response = await authFetch('/inventory');
                if (response.ok) {
                    const invData = await response.json();
                    const alerts = invData.filter((item) => {
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

    const getNavClass = (path) =>
        location.pathname === path || location.pathname.startsWith(path + '/')
            ? `${styles['nav-item']} ${styles.active}`
            : styles['nav-item'];

    const getFooterNavClass = (path) =>
        location.pathname === path ? `${styles['settings-link']} ${styles.active}` : styles['settings-link'];

    const displayFirst = sidebarProfile?.name?.first || user?.firstName || '';
    const displayLast = sidebarProfile?.name?.last || user?.lastName || '';
    const displayName = `${displayFirst} ${displayLast}`.trim() || 'User';

    const avatarUser = sidebarProfile || {
        name: { first: displayFirst, last: displayLast },
        profileImage: user?.profileImage || '',
    };

    const roleLabel = {
        administrator: 'Administrator',
        'co-administrator': 'Co-Administrator',
        'branch-manager': 'Branch Manager',
        dentist: 'Dentist',
        secretary: 'Secretary',
        owner: 'Owner',
    }[user?.role] || '';

    const navItem = (path, Icon, label, badge = null) => (
        <div className={getNavClass(path)} onClick={() => navigate(path)}>
            <Icon className={styles['nav-icon']} />
            <span className={styles['nav-text']}>{label}</span>
            {badge}
        </div>
    );

    const notifBadge = notifUnreadCount > 0 ? (
        <span className={styles['notification-badge']}>{notifUnreadCount}</span>
    ) : null;

    const inventoryBadge = lowStockCount > 0 ? (
        <span className={styles['notification-badge']}>{lowStockCount}</span>
    ) : null;

    const aiAssistantActive = isDentistUser
        ? location.pathname === '/dentist/ai-assistant'
        : isOwner
            ? location.pathname === '/owner/ai-assistant'
            : isBranchManager
                ? location.pathname === '/branch-manager/ai-assistant'
                : isAdmin
                    ? location.pathname === '/admin/ai-assistant'
                : isChatOpen;

    return (
        <>
            <aside className={styles.sidebar}>
                {user && (
                    <div className={styles['profile-section']}>
                        <UserAvatar user={avatarUser} size={44} />
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
                    {navItem(dashboardPath, FaTachometerAlt, 'Dashboard')}
                    {navItem(appointmentsPath, FaCalendarCheck, 'Appointments')}

                    {isAdmin && navItem('/admin/manage-users', FaUsers, 'User Management')}

                    {isBranchManager && (
                        <>
                            {navItem('/branch-manager/manage-users', FaUsers, 'User Management')}
                            {navItem('/branch-manager/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem('/branch-manager/queue', FaListUl, 'Queue')}
                            {navItem('/branch-manager/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/branch-manager/branches', FaCodeBranch, 'Branch')}
                            {navItem('/branch-manager/analytics', FaChartBar, 'Branch Analytics')}
                            {navItem('/branch-manager/activity-logs', FaClipboardList, 'Activity Logs')}
                        </>
                    )}

                    {isOwner && (
                        <>
                            {navItem('/owner/manage-users', FaUsers, 'User Management')}
                            {navItem('/owner/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem('/owner/roles', FaShieldAlt, 'Roles & Permissions')}
                            {navItem('/owner/branches', FaCodeBranch, 'Branches')}
                            {navItem('/owner/branches/analytics', FaChartBar, 'Branch Analytics')}
                            {navItem('/owner/inventory', FaBoxes, 'Inventory', inventoryBadge)}
                            {navItem('/owner/activity-logs', FaClipboardList, 'Activity Logs')}
                        </>
                    )}

                    {isSecretary && (
                        <>
                            {navItem('/secretary/patients', FaUserInjured, 'Patients')}
                            {navItem('/secretary/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem('/secretary/queue', FaListUl, 'Queue')}
                            {navItem('/secretary/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/secretary/activity-logs', FaClipboardList, 'Activity Logs')}
                        </>
                    )}

                    {(isAdmin || isBranchManager) && navItem(inventoryPath, FaBoxes, 'Inventory', inventoryBadge)}
                    {canReadInventory && !isAdmin && !isBranchManager && !isSecretary && navItem(inventoryPath, FaBoxes, 'Inventory')}

                    {isDentistUser && (
                        <>
                            {navItem('/dentist/emr', FaFileMedical, 'Patient EMR')}
                            {navItem('/dentist/odontogram', FaTooth, 'Odontogram')}
                            {navItem('/dentist/material-usage', FaBoxes, 'Material Usage')}
                            {navItem('/dentist/notifications', FaBell, 'Notifications')}
                            {navItem('/dentist/activity-logs', FaClipboardList, 'Activity Logs')}
                        </>
                    )}

                    {isAdmin && (
                        <>
                            {navItem('/admin/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem('/admin/queue', FaListUl, 'Queue')}
                            {navItem('/admin/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/admin/roles', FaShieldAlt, 'Roles & Permissions')}
                            {navItem('/admin/branches', FaCodeBranch, 'Branches')}
                            {navItem('/admin/branches/analytics', FaChartBar, 'Branch Analytics')}
                            {navItem('/admin/audit-trail', FaClipboardList, 'Audit Trail')}
                            {navItem('/admin/activity-logs', FaClipboardList, 'Activity Logs')}
                        </>
                    )}
                </div>

                <div className={styles['footer-section']}>
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
                        <FaUserCircle className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>My Profile</span>
                    </div>

                    <div className={getFooterNavClass(settingsPath)} onClick={() => navigate(settingsPath)}>
                        <FaCog className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Settings</span>
                    </div>

                    <div
                        className={`${styles['settings-link']} ${aiAssistantActive ? styles.active : ''}`}
                        onClick={() => {
                            if (isDentistUser) {
                                navigate('/dentist/ai-assistant');
                                return;
                            }
                            if (isOwner) {
                                navigate('/owner/ai-assistant');
                                return;
                            }
                            if (isBranchManager) {
                                navigate('/branch-manager/ai-assistant');
                                return;
                            }
                            if (isAdmin) {
                                navigate('/admin/ai-assistant');
                                return;
                            }
                            setIsChatOpen((prev) => !prev);
                        }}
                        title="AI Staff Assistant"
                    >
                        <FaRobot className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>AI Assistant</span>
                        <span className={styles['ai-badge']}>AI</span>
                    </div>

                    <div className={styles['logout-btn']} onClick={() => setShowLogoutModal(true)}>
                        <FaSignOutAlt className={styles['nav-icon']} />
                        <span className={styles['nav-text']}>Logout</span>
                    </div>
                </div>
            </aside>

            <AIChatAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

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
