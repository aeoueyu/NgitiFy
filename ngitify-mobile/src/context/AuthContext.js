import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logActivity } from '../utils/logActivity';

export const AuthContext = createContext();

// ─── Change this to your backend IP/URL ───────────────────────────────────────
// For local dev on Android emulator: http://10.0.2.2:5000
// For a physical device: http://<your-machine-local-ip>:5000
// For production: https://your-backend.com
export const API_BASE_URL = 'http://10.0.2.2:5000';
// ──────────────────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
    TOKEN:   'ngitify_token',
    USER_ID: 'ngitify_userId',
    ROLE:    'ngitify_role',
};

export const AuthProvider = ({ children }) => {
    const [isLoading,  setIsLoading]  = useState(true);   // true on boot until token check done
    const [userToken,  setUserToken]  = useState(null);
    const [userRole,   setUserRole]   = useState(null);
    const [userId,     setUserId]     = useState(null);
    const [userInfo,   setUserInfo]   = useState(null);   // { firstName, lastName, fullName, email }

    // ─── Boot: restore session from AsyncStorage ────────────────────────────
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const [token, storedId, storedRole] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
                    AsyncStorage.getItem(STORAGE_KEYS.USER_ID),
                    AsyncStorage.getItem(STORAGE_KEYS.ROLE),
                ]);

                if (token && storedId && storedRole) {
                    // Fetch the user's profile so we have their name ready
                    const profile = await fetchUserProfile(storedId, token);

                    setUserToken(token);
                    setUserId(storedId);
                    setUserRole(storedRole);
                    setUserInfo(profile);
                }
            } catch (err) {
                console.warn('Session restore failed:', err);
            } finally {
                setIsLoading(false);
            }
        };

        restoreSession();
    }, []);

    // ─── Helper: fetch user profile (name, email) ────────────────────────────
    const fetchUserProfile = async (id, token) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return null;
            const data = await res.json();
            return {
                firstName: data.name?.first  || '',
                lastName:  data.name?.last   || '',
                fullName:  `${data.name?.first || ''} ${data.name?.last || ''}`.trim(),
                email:     data.email || '',
            };
        } catch {
            return null;
        }
    };

    // ─── Login ───────────────────────────────────────────────────────────────
    const login = async (email, password) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                // Backend returns 400/403/404 with a { message } body
                return { success: false, message: data.message || 'Login failed. Please try again.' };
            }

            const { token, role, userId: id } = data;

            // Only patients may use the mobile app
            if (role !== 'patient') {
                return {
                    success: false,
                    message: 'This app is for patients only. Please use the web portal.',
                };
            }

            // Persist session
            await Promise.all([
                AsyncStorage.setItem(STORAGE_KEYS.TOKEN,   token),
                AsyncStorage.setItem(STORAGE_KEYS.USER_ID, id.toString()),
                AsyncStorage.setItem(STORAGE_KEYS.ROLE,    role),
            ]);

            // Fetch full profile (name, email)
            const profile = await fetchUserProfile(id, token);

            setUserToken(token);
            setUserId(id);
            setUserRole(role);
            setUserInfo(profile);

            return { success: true };

        } catch (err) {
            console.error('Login error:', err);
            return { success: false, message: 'Unable to connect to the server. Please check your internet connection.' };
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Logout ──────────────────────────────────────────────────────────────
    const logout = async () => {
        logActivity('LOGOUT', 'User logged out', userToken, API_BASE_URL);
        try {
            await Promise.all([
                AsyncStorage.removeItem(STORAGE_KEYS.TOKEN),
                AsyncStorage.removeItem(STORAGE_KEYS.USER_ID),
                AsyncStorage.removeItem(STORAGE_KEYS.ROLE),
            ]);
        } catch (err) {
            console.warn('Logout storage clear failed:', err);
        } finally {
            setUserToken(null);
            setUserRole(null);
            setUserId(null);
            setUserInfo(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                login,
                logout,
                isLoading,
                userToken,
                userRole,
                userId,
                userInfo,   // { firstName, lastName, fullName, email }
                API_BASE_URL,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};