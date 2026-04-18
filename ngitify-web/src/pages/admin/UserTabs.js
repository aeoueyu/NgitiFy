import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ManageDentists from './ManageDentists';
import ManageSecretaries from './ManageSecretaries';
import ManagePatients from './ManagePatients';
import ManageBranchManagers from './ManageBranchManagers';
import ManageCoAdmins from './ManageCoAdmins';
import styles from '../../styles/admin/UserTabs.module.css';

const TABS = [
    { key: 'dentists',       label: 'Dentists' },
    { key: 'secretaries',    label: 'Secretaries' },
    { key: 'patients',       label: 'Patients' },
    { key: 'branchManagers', label: 'Branch Managers' },
    { key: 'coAdmins',       label: 'Co-Admins' }
];

const UserTabs = () => {
    const [activeTab, setActiveTab] = useState('dentists');

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>User Management</h1>
            </div>

            <div className={styles.tabBar}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={styles.tabContent}>
                {activeTab === 'dentists'       && <ManageDentists />}
                {activeTab === 'secretaries'    && <ManageSecretaries />}
                {activeTab === 'patients'       && <ManagePatients />}
                {activeTab === 'branchManagers' && <ManageBranchManagers />}
                {activeTab === 'coAdmins'       && <ManageCoAdmins />}
            </div>
        </div>
    );
};

export default UserTabs;