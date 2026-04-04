import React, { useState } from 'react';
import styles from '../../styles/owner/UserManagement.module.css';

// Importing your existing, untouched components
import ManageDentists from './ManageDentists';
import ManageSecretaries from './ManageSecretaries';
import ManagePatients from './ManagePatients';

export default function UserManagement() {
    // Default to 'dentists' tab
    const [activeTab, setActiveTab] = useState('dentists');

    return (
        <div className={styles.wrapper}>
            
            {/* Clean Tabbed Navigation Header */}
            <div className={styles.tabContainer}>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'dentists' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('dentists')}
                >
                    Dentists
                </button>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'secretaries' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('secretaries')}
                >
                    Secretaries
                </button>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'patients' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('patients')}
                >
                    Patients
                </button>
            </div>

            {/* Content Rendering Area */}
            <div className={styles.contentArea}>
                {activeTab === 'dentists' && <ManageDentists />}
                {activeTab === 'secretaries' && <ManageSecretaries />}
                {activeTab === 'patients' && <ManagePatients />}
            </div>
            
        </div>
    );
}