import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../../styles/owner/UserTabs.module.css';

export default function UserTabs({ activeTab }) {
    const navigate = useNavigate();
    const location = useLocation();

    // TASK 4.1 UPDATE: Dynamically determine active tab from the URL 
    // (with a fallback to the prop if explicitly provided)
    const currentTab = location.pathname.includes('/secretaries') ? 'secretaries'
                     : location.pathname.includes('/patients') ? 'patients'
                     : activeTab || 'dentists';

    return (
        <div className={styles.tabContainer}>
            <button 
                className={`${styles.tabButton} ${currentTab === 'dentists' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/dentists')}
            >
                Dentists
            </button>
            <button 
                className={`${styles.tabButton} ${currentTab === 'secretaries' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/secretaries')}
            >
                Secretaries
            </button>
            <button 
                className={`${styles.tabButton} ${currentTab === 'patients' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/patients')}
            >
                Patients
            </button>
        </div>
    );
}