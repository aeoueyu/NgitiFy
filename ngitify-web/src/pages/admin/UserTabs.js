// ngitify-web/src/pages/admin/UserTabs.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/UserTabs.module.css';

const TABS = [
    { key: 'dentists',       label: 'Dentists',        path: '/admin/manage-users/dentists' },
    { key: 'secretaries',    label: 'Secretaries',      path: '/admin/manage-users/secretaries' },
    { key: 'patients',       label: 'Patients',         path: '/admin/manage-users/patients' },
    { key: 'branchManagers', label: 'Branch Managers',  path: '/admin/manage-users/branch-managers' },
    { key: 'coAdmins',       label: 'Co-Admins',        path: '/admin/manage-users/co-admins' },
];

// TAB BAR ONLY — navigates to routes. Child pages are rendered by App.js routes.
const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();

    return (
        <div className={styles.tabContainer}>
            {TABS.map(tab => (
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