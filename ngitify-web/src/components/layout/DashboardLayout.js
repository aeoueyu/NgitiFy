// src/components/layout/DashboardLayout.js
import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import Sidebar from '../sidebar/Sidebar'; 
import styles from './DashboardLayout.module.css'; 
import { authFetch } from '../../utils/api'; // ✅ Correctly imported authFetch

export default function DashboardLayout() {
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate(); // ✅ Needed for clicking the bell

    // Fetch unread notifications
    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const response = await authFetch('/notifications');
                if (response.ok) {
                    const data = await response.json();
                    const unread = data.filter(n => !n.isRead).length;
                    setUnreadCount(unread);
                }
            } catch (err) {
                console.error("Failed to fetch notifications bell count", err);
            }
        };

        fetchUnread(); // Run on mount
        const interval = setInterval(fetchUnread, 60000); // Poll every 60 seconds

        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    return (
        <div className={styles.dashboardContainer}>
            <Sidebar />
            <div className={styles.mainContent}>
                
                {/* ✅ NOTIFICATION BELL HEADER */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px 30px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
                    <div 
                        style={{ position: 'relative', cursor: 'pointer' }} 
                        onClick={() => navigate('/admin/appointment-notifications')}
                    >
                        <FaBell size={24} color="#7f8c8d" />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-5px',
                                right: '-5px',
                                backgroundColor: '#e74c3c',
                                color: 'white',
                                borderRadius: '50%',
                                padding: '2px 6px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </div>
                </div>

                <Outlet />
            </div>
        </div>
    );
}