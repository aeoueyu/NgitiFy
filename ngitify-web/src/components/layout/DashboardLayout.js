import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar'; 
import styles from '../../styles/owner/OwnerDashboard.module.css'; // I-import ang css mo para sa container background

export default function DashboardLayout() {
    return (
        // HETO ANG DATING NASA LABAS NG OWNERDASHBOARD MO
        <div className={styles['dashboard-container']}>
            <Sidebar />
            <Outlet /> {/* Dito magpapalit-palit ang mga pages sa kanan */}
        </div>
    );
}