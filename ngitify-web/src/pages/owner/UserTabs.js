import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/owner/UserTabs.module.css';

export default function UserTabs({ activeTab }) {
    const navigate = useNavigate();

    return (
        <div className={styles.tabContainer}>
            <button 
                className={`${styles.tabButton} ${activeTab === 'dentists' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/dentists')}
            >
                Dentists
            </button>
            <button 
                className={`${styles.tabButton} ${activeTab === 'secretaries' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/secretaries')}
            >
                Secretaries
            </button>
            <button 
                className={`${styles.tabButton} ${activeTab === 'patients' ? styles.activeTab : ''}`}
                onClick={() => navigate('/owner/manage-users/patients')}
            >
                Patients
            </button>
        </div>
    );
}