import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/UserTabs.module.css';

// Order: Patients → Secretaries → Dentists → Branch Managers → Owners
const ADMIN_TABS = [
    { key: 'secretaries',    label: 'Secretaries',     path: '/admin/manage-staffs/secretaries' },
    { key: 'dentists',       label: 'Dentists',        path: '/admin/manage-staffs/dentists' },
    { key: 'branchManagers', label: 'Branch Managers', path: '/admin/manage-staffs/branch-managers' },
    { key: 'owners',         label: 'Owners',          path: '/admin/manage-staffs/owners', adminTierOnly: true },
];

const OWNER_TABS = [
    { key: 'secretaries', label: 'Secretaries', path: '/owner/manage-staffs/secretaries' },
    { key: 'dentists',    label: 'Dentists',    path: '/owner/manage-staffs/dentists' },
    { key: 'branchManagers', label: 'Branch Managers', path: '/owner/manage-staffs/branch-managers' },
];

const BRANCH_MANAGER_TABS = [
    { key: 'secretaries', label: 'Secretaries', path: '/branch-manager/manage-staffs/secretaries' },
    { key: 'dentists',    label: 'Dentists',    path: '/branch-manager/manage-staffs/dentists' },
];

const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const isOwner = user?.role === 'owner';
    const isBranchManager = user?.role === 'branch-manager';
    const isAdminTier = user?.role === 'administrator';

    let tabs;
    if (isBranchManager) {
        tabs = BRANCH_MANAGER_TABS;
    } else if (isOwner) {
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
