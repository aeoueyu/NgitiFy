// ngitify-web/src/pages/admin/UserTabs.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/UserTabs.module.css';

const TABS = [
    { key: 'dentists',       label: 'Dentists',       path: '/admin/manage-users/dentists' },
    { key: 'secretaries',    label: 'Secretaries',     path: '/admin/manage-users/secretaries' },
    { key: 'patients',       label: 'Patients',        path: '/admin/manage-users/patients' },
    { key: 'branchManagers', label: 'Branch Managers', path: '/admin/manage-users/branch-managers' },
    { key: 'coAdmins',       label: 'Co-Admins',       path: '/admin/manage-users/co-admins' }
];

// This component is a TAB BAR ONLY. It navigates to routes.
// It does NOT render child pages — those are handled by App.js routes.
const UserTabs = ({ activeTab }) => {
    const navigate = useNavigate();

    return (
        <div className={styles.tabBar}>
            {TABS.map(tab => (
                <button
                    key={tab.key}
                    className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
                    onClick={() => navigate(tab.path)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default UserTabs;