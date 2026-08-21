import React, { useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../sidebar/Sidebar';
import SessionWarningModal from '../common/SessionWarningModal';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { authFetch } from '../../utils/api';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import PatientAIChat from '../patient/PatientAIChat';

export default function DashboardLayout() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [showWarning, setShowWarning] = useState(false);
    const { config } = useSystemConfig();

    const timeoutMinutes = config?.sessionTimeoutMinutes || 30;
    const isSessionTimeoutEnabled = config?.featureToggles?.sessionTimeout !== false;

    const handleTimeout = useCallback(async () => {
        setShowWarning(false);
        try {
            await authFetch('/logout', {
                method: 'POST',
                body: JSON.stringify({
                    email: user?.email,
                    role: user?.role,
                    reason: 'session_timeout',
                }),
            });
        } catch {
            // Silent fallback during automatic logout.
        }
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
        window.dispatchEvent(new MouseEvent('mousemove'));
    }, []);

    useSessionTimeout({
        onTimeout: handleTimeout,
        onWarn: handleWarn,
        onResetWarn: handleResetWarn,
        timeoutMinutes,
        enabled: isSessionTimeoutEnabled,
    });

    return (
        <div className={styles.dashboardContainer}>
            <Sidebar />
            <div className={styles.mainContent}>
                <Outlet />
            </div>

            {user?.role === 'patient' ? <PatientAIChat /> : null}

            <SessionWarningModal
                isOpen={showWarning}
                onStayLoggedIn={handleStayLoggedIn}
            />
        </div>
    );
}
