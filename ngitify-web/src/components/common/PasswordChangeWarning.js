import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';

export default function PasswordChangeWarning() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const userId = user?.userId || user?.id || user?._id;
        if (!userId) return;

        const fetchProfile = async () => {
            try {
                const res = await authFetch(`/user/${userId}`);
                if (res.ok) {
                    setProfile(await res.json());
                }
            } catch {
                // Silent fallback
            }
        };

        fetchProfile();
    }, [user]);

    const settingsTarget = useMemo(() => {
        if (user?.role === 'administrator') return '/admin/settings';
        if (user?.role === 'owner') return '/owner/settings';
        if (user?.role === 'branch-manager') return '/branch-manager/settings';
        if (user?.role === 'secretary') return '/secretary/settings';
        if (user?.role === 'dentist') return '/dentist/settings';
        if (user?.role === 'patient') return '/patient/settings';
        return '/login';
    }, [user?.role]);

    const passwordChangeDeadline = profile?.temporaryPasswordExpires ? new Date(profile.temporaryPasswordExpires) : null;
    const showWarning = profile?.isPasswordChanged === false
        && passwordChangeDeadline
        && !Number.isNaN(passwordChangeDeadline.getTime());

    if (!showWarning) return null;

    return (
        <button
            type="button"
            onClick={() => navigate(settingsTarget)}
            style={{
                width: '100%',
                margin: '10px 0 18px',
                border: '1px solid #fcd34d',
                background: '#fffbeb',
                color: '#92400e',
                borderRadius: '14px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Lexend Deca, sans-serif',
            }}
        >
            <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Password change required
            </span>
            <span style={{ fontSize: '11px', lineHeight: 1.45, fontWeight: 600 }}>
                You are still using your temporary password. Change it before {passwordChangeDeadline.toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })} to keep your account active.
            </span>
        </button>
    );
}
