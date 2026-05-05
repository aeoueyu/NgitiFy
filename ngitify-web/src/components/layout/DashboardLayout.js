import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar';
import SessionWarningModal from '../common/SessionWarningModal';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { authFetch } from '../../utils/api';

export default function DashboardLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [showWarning, setShowWarning] = useState(false);

    // ── Fetch session timeout duration from SystemConfig ──────────────────
    // This ensures the configured value in System Config applies to all dashboard roles.
    const [timeoutMinutes, setTimeoutMinutes] = useState(30); // safe default while loading

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await authFetch('/system-config');
                if (res.ok) {
                    const config = await res.json();
                    const minutes = config?.sessionTimeoutMinutes;
                    if (typeof minutes === 'number' && minutes > 0) {
                        setTimeoutMinutes(minutes);
                    }
                }
            } catch {
                // Silent — fallback to default 30 minutes
            }
        };
        fetchConfig();
    }, []);

    // ─────────────────────────────────────────────────────────────────────

    const handleTimeout = useCallback(async () => {
        setShowWarning(false);
        // Log the session timeout reason before logging out
        try {
            await authFetch('/logout', {
                method: 'POST',
                body: JSON.stringify({
                    email: user?.email,
                    role: user?.role,
                    reason: 'session_timeout'
                })
            });
        } catch { /* silent */ }
        logout();
        navigate('/login');
    }, [logout, navigate, user]);

    const handleWarn = useCallback(() => {
        setShowWarning(true);
    }, []);

    const handleResetWarn = useCallback(() => {
        setShowWarning(false);
    }, []);

    const handleStayLoggedIn = useCallback(() => {
        setShowWarning(false);
        // Dispatching any event resets the timer inside useSessionTimeout
        window.dispatchEvent(new MouseEvent('mousemove'));
    }, []);

    useSessionTimeout({
        onTimeout:   handleTimeout,
        onWarn:      handleWarn,
        onResetWarn: handleResetWarn,
        timeoutMinutes,             // ← now driven by SystemConfig
    });

    return (
        <div className={styles.dashboardContainer}>
            <Sidebar />
            <div className={styles.mainContent}>
                <Outlet />
            </div>

            <SessionWarningModal
                isOpen={showWarning}
                onStayLoggedIn={handleStayLoggedIn}
            />
        </div>
    );
}
