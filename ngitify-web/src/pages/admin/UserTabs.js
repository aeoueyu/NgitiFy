// ngitify-web/src/pages/admin/UserTabs.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/UserTabs.module.css';

export default function UserTabs({ activeTab }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const isAdministrator = user?.role === 'administrator';

    const currentTab = location.pathname.includes('/secretaries') ? 'secretaries'
                     : location.pathname.includes('/patients') ? 'patients'
                     : location.pathname.includes('/branch-managers') ? 'branch-managers'
                     : location.pathname.includes('/co-admins') ? 'co-admins'
                     : activeTab || 'dentists';

    return (
        <div className={styles.tabContainer}>
            <button
                className={`${styles.tabButton} ${currentTab === 'dentists' ? styles.activeTab : ''}`}
                onClick={() => navigate('/admin/manage-users/dentists')}
            >
                Dentists
            </button>
            <button
                className={`${styles.tabButton} ${currentTab === 'secretaries' ? styles.activeTab : ''}`}
                onClick={() => navigate('/admin/manage-users/secretaries')}
            >
                Secretaries
            </button>
            <button
                className={`${styles.tabButton} ${currentTab === 'patients' ? styles.activeTab : ''}`}
                onClick={() => navigate('/admin/manage-users/patients')}
            >
                Patient Records
            </button>
            {/* ✅ PHASE 2: New tabs — only shown to full administrator */}
            {isAdministrator && (
                <>
                    <button
                        className={`${styles.tabButton} ${currentTab === 'branch-managers' ? styles.activeTab : ''}`}
                        onClick={() => navigate('/admin/manage-users/branch-managers')}
                    >
                        Branch Managers
                    </button>
                    <button
                        className={`${styles.tabButton} ${currentTab === 'co-admins' ? styles.activeTab : ''}`}
                        onClick={() => navigate('/admin/manage-users/co-admins')}
                    >
                        Co-Admins
                    </button>
                </>
            )}
        </div>
    );
}