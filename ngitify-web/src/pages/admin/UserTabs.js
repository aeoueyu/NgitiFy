// ngitify-web/src/pages/admin/UserTabs.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/UserTabs.module.css';

const ADMIN_TABS = [
    { key: 'dentists',       label: 'Dentists',        path: '/admin/manage-users/dentists' },
    { key: 'secretaries',    label: 'Secretaries',      path: '/admin/manage-users/secretaries' },
    { key: 'patients',       label: 'Patients',         path: '/admin/manage-users/patients' },
    { key: 'branchManagers', label: 'Branch Managers',  path: '/admin/manage-users/branch-managers' },
    { key: 'coAdmins',       label: 'Co-Admins',        path: '/admin/manage-users/co-admins' },
    { key: 'owners',         label: 'Owners',           path: '/admin/manage-users/owners',  adminOnly: true },
];

const OWNER_TABS = [
    { key: 'dentists',    label: 'Dentists',    path: '/owner/manage-users/dentists' },
    { key: 'secretaries', label: 'Secretaries', path: '/owner/manage-users/secretaries' },
    { key: 'patients',    label: 'Patients',    path: '/owner/manage-users/patients' },
];

const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const isOwner = user?.role === 'owner';
    const isAdmin = user?.role === 'administrator';

    let tabs;
    if (isOwner) {
        tabs = OWNER_TABS;
    } else {
        tabs = ADMIN_TABS.filter(tab => !tab.adminOnly || isAdmin);
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