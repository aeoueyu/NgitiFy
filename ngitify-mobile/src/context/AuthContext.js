import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [userToken, setUserToken] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    const users = {
        owner: { email: 'admin@ngitify.com', pass: 'admin123', name: 'Dr. Owner', role: 'owner' },
        dentist: { email: 'dentist@ngitify.com', pass: 'dentist123', name: 'Dr. Smile', role: 'dentist' },
        secretary: { email: 'sec@ngitify.com', pass: 'sec123', name: 'Sec. Jen', role: 'secretary' },
        patient: { email: 'patient@gmail.com', pass: 'patient123', name: 'Alice Gupta', role: 'patient' }
    };

    const login = async (email, password) => {
        setIsLoading(true);

        return new Promise((resolve) => {
            setTimeout(() => {
                const targetUser = Object.values(users).find(
                    (user) => user.email.toLowerCase() === email.toLowerCase() && user.pass === password
                );

                if (targetUser) {
                    setUserToken('fake-jwt-token-12345'); 
                    setUserRole(targetUser.role);
                    setUserInfo(targetUser.name);
                    setIsLoading(false);
                    console.log(`Login Successful: ${targetUser.name} as ${targetUser.role}`);
                    resolve({ success: true });
                } else {
                    setIsLoading(false);
                    resolve({ success: false, message: 'Invalid email or password. Please try again.' });
                }
            }, 1000);
        });
    };

    const logout = () => {
        setIsLoading(true);
        setUserToken(null);
        setUserRole(null);
        setUserInfo(null);
        setIsLoading(false);
    };

    return (
        <AuthContext.Provider value={{ login, logout, isLoading, userToken, userRole, userInfo }}>
            {children}
        </AuthContext.Provider>
    );
};