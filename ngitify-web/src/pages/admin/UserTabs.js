// ngitify-web/src/pages/admin/UserTabs.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/UserTabs.module.css';

const ALL_TABS = [
    { key: 'dentists',       label: 'Dentists',        path: '/admin/manage-users/dentists',         roles: ['administrator', 'co-administrator'] },
    { key: 'secretaries',    label: 'Secretaries',      path: '/admin/manage-users/secretaries',      roles: ['administrator', 'co-administrator'] },
    { key: 'patients',       label: 'Patients',         path: '/admin/manage-users/patients',         roles: ['administrator', 'co-administrator'] },
    { key: 'branchManagers', label: 'Branch Managers',  path: '/admin/manage-users/branch-managers',  roles: ['administrator', 'co-administrator'] },
    { key: 'coAdmins',       label: 'Co-Admins',        path: '/admin/manage-users/co-admins',        roles: ['administrator', 'co-administrator'] },
    { key: 'owners',         label: 'Owners',           path: '/admin/manage-users/owners',           roles: ['administrator'] }, // Legacy migration tab — Admin only
];

// TAB BAR ONLY — navigates to routes. Child pages are rendered by App.js routes.
const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const visibleTabs = ALL_TABS.filter(tab =>
        !tab.roles || tab.roles.includes(user?.role)
    );

    return (
        <div className={styles.tabContainer}>
            {visibleTabs.map(tab => (
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