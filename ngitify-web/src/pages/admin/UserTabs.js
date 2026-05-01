import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/UserTabs.module.css';

// Order: Patients → Secretaries → Dentists → Branch Managers → Owners (admin-only) → Co-Admins
const ADMIN_TABS = [
    { key: 'patients',       label: 'Patients',        path: '/admin/manage-users/patients' },
    { key: 'secretaries',    label: 'Secretaries',     path: '/admin/manage-users/secretaries' },
    { key: 'dentists',       label: 'Dentists',        path: '/admin/manage-users/dentists' },
    { key: 'branchManagers', label: 'Branch Managers', path: '/admin/manage-users/branch-managers' },
    { key: 'owners',         label: 'Owners',          path: '/admin/manage-users/owners', adminTierOnly: true },
    { key: 'coAdmins',       label: 'Co-Admins',       path: '/admin/manage-users/co-admins' },
];

const OWNER_TABS = [
    { key: 'patients',    label: 'Patients',    path: '/owner/manage-users/patients' },
    { key: 'secretaries', label: 'Secretaries', path: '/owner/manage-users/secretaries' },
    { key: 'dentists',    label: 'Dentists',    path: '/owner/manage-users/dentists' },
    { key: 'branchManagers', label: 'Branch Managers', path: '/owner/manage-users/branch-managers' },
    { key: 'owners', label: 'Owners', path: '/owner/manage-users/owners' },
    { key: 'coAdmins', label: 'Co-Admins', path: '/owner/manage-users/co-admins' },
];

const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const isOwner = user?.role === 'owner';
    const isAdminTier = user?.role === 'administrator' || user?.role === 'co-administrator';

    let tabs;
    if (isOwner) {
        tabs = OWNER_TABS;
    } else {
        tabs = ADMIN_TABS.filter(tab => !tab.adminTierOnly || isAdminTier);
    }

    if (tabs.length === 0) return null;

    return (
        <div className={styles.tabContainer}>
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    className={`${styles.tabButton} ${activeTab === tab.key ? styles.activeTab : ''}`}
                    onClick={() => navigate(tab.path)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default UserTabs;
