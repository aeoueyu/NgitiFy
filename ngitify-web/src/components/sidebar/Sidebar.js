import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import {
    FaBell,
    FaBoxes,
    FaCalendarAlt,
    FaChevronRight,
    FaClipboardList,
    FaCodeBranch,
    FaCog,
    FaDatabase,
    FaHistory,
    FaHeadset,
    FaRobot,
    FaShieldAlt,
    FaSignOutAlt,
    FaTachometerAlt,
    FaUserCircle,
    FaUserInjured,
    FaUsers,
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import UserAvatar from '../common/UserAvatar';
import ConfirmModal from '../common/ConfirmModal';
import AIChatAssistant from '../common/AIChatAssistant';
import { useSystemConfig } from '../../hooks/useSystemConfig';

export default function Sidebar() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { config: systemConfig } = useSystemConfig();

    const { canReadInventory } = usePermissions();

    const isAdmin = user?.role === 'administrator';
    const isBranchManager = user?.role === 'branch-manager';
    const isSecretary = user?.role === 'secretary';
    const isOwner = user?.role === 'owner';
    const isDentistUser = user?.role === 'dentist' || (user?.role === 'owner' && user?.isDentist);
    const isChatSupportEnabled = systemConfig?.featureToggles?.chatSupport === true;

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [notifUnreadCount, setNotifUnreadCount] = useState(0);
    const [sidebarProfile, setSidebarProfile] = useState(null);
    const sidebarRef = useRef(null);

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
        if (!isAdmin && !isBranchManager && !isOwner && !isSecretary && !isDentistUser) return;

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
    }, [isAdmin, isBranchManager, isOwner, isSecretary, isDentistUser]);

    const getBasePath = () => {
        if (user?.role === 'dentist') return '/dentist';
        if (user?.role === 'secretary') return '/secretary';
        if (user?.role === 'branch-manager') return '/branch-manager';
        if (user?.role === 'owner') return '/owner';
        if (user?.role === 'administrator') return '/admin';
        return '/login';
    };

    const basePath = getBasePath();
    const dashboardPath = `${basePath}/dashboard`;
    const schedulePath = `${basePath}/schedule`;
    const settingsPath = `${basePath}/settings`;
    const inventoryPath = `${basePath}/inventory`;
    const profilePath = `${basePath}/profile`;
    const userManagementPath = isAdmin
        ? '/admin/manage-users'
        : isOwner
            ? '/owner/manage-users'
            : isBranchManager
                ? '/branch-manager/manage-users'
                : `${basePath}/patients`;
    const managePatientsPath = isAdmin
        ? '/admin/patients'
        : isOwner
            ? '/owner/patients'
            : isBranchManager
                ? '/branch-manager/patients'
                : isDentistUser
                    ? '/dentist/patients'
                    : '/secretary/patients';

    useEffect(() => {
        if ((!canReadInventory && !isOwner) || user?.role === 'dentist') return;

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
    }, [canReadInventory, isOwner, user?.role]);

    useEffect(() => {
        if (!isExpanded) return;

        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded]);

    const isManageUsersActive = (
        (isAdmin && location.pathname.startsWith('/admin/manage-users'))
        || (isOwner && location.pathname.startsWith('/owner/manage-users'))
        || (isBranchManager && location.pathname.startsWith('/branch-manager/manage-users'))
    );

    const getNavClass = (path) => {
        if (path === userManagementPath && isManageUsersActive) {
            return `${styles['nav-item']} ${styles.active}`;
        }

        return location.pathname === path || location.pathname.startsWith(path + '/')
            ? `${styles['nav-item']} ${styles.active}`
            : styles['nav-item'];
    };

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
        'branch-manager': 'Branch Manager',
        dentist: 'Dentist',
        secretary: 'Secretary',
        owner: 'Owner',
    }[user?.role] || '';

    const renderBadge = (count, extraClassName = '') => {
        if (!count) return null;
        if (!isExpanded) return <span className={styles['badge-dot']} />;
        return <span className={`${styles['notification-badge']} ${extraClassName}`.trim()}>{count}</span>;
    };

    const handleNavigate = (path) => {
        navigate(path);
        setIsExpanded(false);
    };

    const navItem = (path, Icon, label, badge = null) => (
        <div
            className={getNavClass(path)}
            onClick={() => handleNavigate(path)}
            data-tooltip={label}
        >
            <Icon className={styles['nav-icon']} />
            {isExpanded && <span className={styles['nav-text']}>{label}</span>}
            {badge}
        </div>
    );

    const sectionLabel = (label) => (
        isExpanded ? <span className={styles.sectionLabel}>{label}</span> : null
    );

    const notifBadge = renderBadge(notifUnreadCount);
    const inventoryBadge = renderBadge(lowStockCount);

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
            {isExpanded && (
                <div
                    className={styles['sidebar-backdrop']}
                    onClick={() => setIsExpanded(false)}
                />
            )}

            <aside
                ref={sidebarRef}
                className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}
            >
                <button
                    type="button"
                    className={styles.toggleButton}
                    onClick={() => setIsExpanded((prev) => !prev)}
                    aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    <FaChevronRight className={styles.toggleIcon} />
                </button>

                {user && (
                    <div className={`${styles['profile-section']} ${isExpanded ? styles['profile-expanded'] : ''}`}>
                        <UserAvatar user={avatarUser} size={44} />
                        {isExpanded && (
                            <div className={styles['profile-info']}>
                                <span className={styles['profile-name']}>{displayName}</span>
                                {roleLabel && (
                                    <span className={`${styles['role-badge']} ${styles[`role-${user.role}`] || ''}`}>
                                        {roleLabel}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className={styles['nav-menu']}>
                    {sectionLabel('Main')}
                    {navItem(dashboardPath, FaTachometerAlt, 'Dashboard')}

                    {sectionLabel('Clinic')}
                    {navItem(schedulePath, FaCalendarAlt, 'Schedule')}

                    {sectionLabel('Patients')}
                    {(isAdmin || isOwner || isBranchManager || isSecretary || isDentistUser) && navItem(managePatientsPath, FaUserInjured, 'Manage Patients')}

                    {isBranchManager && (
                        <>
                            {sectionLabel('Management')}
                            {navItem(userManagementPath, FaUsers, 'Manage Users')}
                            {navItem('/branch-manager/notifications', FaBell, 'Notifications', notifBadge)}
                            {isChatSupportEnabled && navItem('/branch-manager/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/branch-manager/activity-logs', FaHistory, 'Activity Logs')}
                        </>
                    )}

                    {isOwner && (
                        <>
                            {sectionLabel('Management')}
                            {navItem(userManagementPath, FaUsers, 'Manage Users')}
                            {navItem('/owner/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem('/owner/branches', FaCodeBranch, 'Branches')}
                            {navItem('/owner/inventory', FaBoxes, 'Inventory', inventoryBadge)}
                            {navItem('/owner/activity-logs', FaHistory, 'Activity Logs')}
                        </>
                    )}

                    {isSecretary && (
                        <>
                            {sectionLabel('Management')}
                            {navItem('/secretary/notifications', FaBell, 'Notifications', notifBadge)}
                            {isChatSupportEnabled && navItem('/secretary/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/secretary/activity-logs', FaHistory, 'Activity Logs')}
                        </>
                    )}

                    {(isAdmin || isBranchManager) && navItem(inventoryPath, FaBoxes, 'Inventory', inventoryBadge)}
                    {canReadInventory && !isAdmin && !isBranchManager && !isSecretary && !isOwner && !isDentistUser && navItem(inventoryPath, FaBoxes, 'Inventory')}

                    {isDentistUser && (
                        <>
                            {sectionLabel('Clinic')}
                            {navItem(isOwner ? '/owner/material-usage' : '/dentist/material-usage', FaBoxes, 'Material Usage')}
                            {sectionLabel('System')}
                            {navItem(isOwner ? '/owner/notifications' : '/dentist/notifications', FaBell, 'Notifications', notifBadge)}
                            {navItem(isOwner ? '/owner/activity-logs' : '/dentist/activity-logs', FaHistory, 'Activity Logs')}
                        </>
                    )}

                    {isAdmin && (
                        <>
                            {sectionLabel('Management')}
                            {navItem(userManagementPath, FaUsers, 'Manage Users')}
                            {navItem('/admin/notifications', FaBell, 'Notifications', notifBadge)}
                            {sectionLabel('System')}
                            {isChatSupportEnabled && navItem('/admin/chat-support', FaHeadset, 'Chat Support')}
                            {navItem('/admin/branches', FaCodeBranch, 'Branches')}
                            {navItem('/admin/activity-logs', FaHistory, 'Activity Logs')}
                            {navItem('/admin/audit-trail', FaClipboardList, 'Audit Trail')}
                        </>
                    )}
                </div>

                <div className={styles['footer-section']}>
                    {sectionLabel('Account')}
                    {isAdmin && (
                        <>
                            <div
                                className={getFooterNavClass('/admin/system-config')}
                                onClick={() => handleNavigate('/admin/system-config')}
                                data-tooltip="System Config"
                            >
                                <FaCog className={styles['nav-icon']} />
                                {isExpanded && <span className={styles['nav-text']}>System Config</span>}
                            </div>

                            <div
                                className={getFooterNavClass('/admin/backup')}
                                onClick={() => handleNavigate('/admin/backup')}
                                data-tooltip="Database Backup"
                            >
                                <FaDatabase className={styles['nav-icon']} />
                                {isExpanded && <span className={styles['nav-text']}>Database Backup</span>}
                            </div>

                            <div
                                className={getFooterNavClass('/admin/integrity')}
                                onClick={() => handleNavigate('/admin/integrity')}
                                data-tooltip="Integrity Tools"
                            >
                                <FaShieldAlt className={styles['nav-icon']} />
                                {isExpanded && <span className={styles['nav-text']}>Integrity Tools</span>}
                            </div>
                        </>
                    )}

                    <div
                        className={getFooterNavClass(profilePath)}
                        onClick={() => handleNavigate(profilePath)}
                        data-tooltip="My Profile"
                    >
                        <FaUserCircle className={styles['nav-icon']} />
                        {isExpanded && <span className={styles['nav-text']}>My Profile</span>}
                    </div>

                    <div
                        className={getFooterNavClass(settingsPath)}
                        onClick={() => handleNavigate(settingsPath)}
                        data-tooltip="Settings"
                    >
                        <FaCog className={styles['nav-icon']} />
                        {isExpanded && <span className={styles['nav-text']}>Settings</span>}
                    </div>

                    <div
                        className={`${styles['settings-link']} ${aiAssistantActive ? styles.active : ''}`}
                        onClick={() => {
                            if (isDentistUser && !isOwner) {
                                handleNavigate('/dentist/ai-assistant');
                                return;
                            }
                            if (isOwner) {
                                handleNavigate('/owner/ai-assistant');
                                return;
                            }
                            if (isBranchManager) {
                                handleNavigate('/branch-manager/ai-assistant');
                                return;
                            }
                            if (isAdmin) {
                                handleNavigate('/admin/ai-assistant');
                                return;
                            }
                            setIsChatOpen((prev) => !prev);
                            setIsExpanded(false);
                        }}
                        data-tooltip="AI Assistant"
                    >
                        <FaRobot className={styles['nav-icon']} />
                        {isExpanded && <span className={styles['nav-text']}>AI Assistant</span>}
                        {isExpanded && <span className={styles['ai-badge']}>AI</span>}
                    </div>

                    <div
                        className={styles['logout-btn']}
                        onClick={() => {
                            setShowLogoutModal(true);
                            setIsExpanded(false);
                        }}
                        data-tooltip="Logout"
                    >
                        <FaSignOutAlt className={styles['nav-icon']} />
                        {isExpanded && <span className={styles['nav-text']}>Logout</span>}
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
