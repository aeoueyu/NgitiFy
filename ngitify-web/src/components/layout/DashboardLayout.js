// src/components/layout/DashboardLayout.js
import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar'; 
import styles from './DashboardLayout.module.css'; // Dito na siya kukuha ng design!

export default function DashboardLayout() {
    return (
        <div className={styles.dashboardContainer}>
            <Sidebar />
            <div className={styles.mainContent}>
                <Outlet />
            </div>
        </div>
    );
}