import React, { useState, useContext } from 'react';
import styles from '../../styles/auth/LoginPage.module.css';
import logo from '../../assets/icons/logo-dentime.svg';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { FaEye, FaEyeSlash, FaEnvelope, FaLock } from 'react-icons/fa';
import { BASE_URL } from '../../utils/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const validateFields = () => {
        const errors = {};
        if (!email.trim()) errors.email = 'Email address is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.';
        if (!password) errors.password = 'Password is required.';
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        if (!validateFields()) return;
        setIsLoading(true);

        try {
            const response = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const rawBody = await response.text();
            const data = rawBody ? JSON.parse(rawBody) : {};

            if (response.ok) {
                localStorage.setItem('token', data.token);

                let profileData = {};
                try {
                    const profileRes = await fetch(`${BASE_URL}/api/user/${data.userId}`, {
                        headers: { 'Authorization': `Bearer ${data.token}` }
                    });
                    if (profileRes.ok) profileData = await profileRes.json();
                } catch (e) {
                    console.warn('Profile pre-fetch failed:', e);
                }

                await login({
                    token:          data.token,
                    role:           data.role,
                    userId:         data.userId,
                    userEmail:      email,
                    name:           profileData.name,
                    profileImage:   profileData.profileImage,
                    assignedBranch: data.assignedBranch || null,
                    isDentist:      data.isDentist || false,
                });

                if (data.role === 'administrator') {
                    navigate('/admin/dashboard');
                } else if (data.role === 'branch-manager') {
                    navigate('/branch-manager/dashboard');
                } else if (data.role === 'owner') {
                    navigate('/owner/dashboard');
                } else if (data.role === 'dentist') {
                    navigate('/dentist/dashboard');
                } else if (data.role === 'secretary') {
                    navigate('/secretary/dashboard');
                } else if (data.role === 'patient') {
                    setErrorMessage('Patient access is only available on the mobile app.');
                    localStorage.removeItem('token');
                } else {
                    setErrorMessage('Unrecognized user role.');
                }
            } else {
                setErrorMessage(data.message || 'Invalid email or password.');
            }
        } catch (error) {
            console.error('Login failed', error);
            setErrorMessage('Cannot connect to server. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles['main-container']}>
            <form className={styles['container']} onSubmit={handleLogin} noValidate>
                <img src={logo} alt="Dentime Dental Clinic" className={styles['logo']} />

                <div className={styles['header-text']}>
                    <h2>Login to your <span className={styles['accent-text']}>Account</span></h2>
                </div>

                {/* Email Field */}
                <div className={styles['form-group']}>
                    <label className={styles['label']}>EMAIL ADDRESS</label>
                    <div className={styles['input-wrapper']}>
                        <FaEnvelope className={styles['input-icon']} />
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className={`${styles['input-field']} ${fieldErrors.email ? styles['input-error'] : ''}`}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' }));
                            }}
                            disabled={isLoading}
                            autoComplete="email"
                        />
                    </div>
                    {fieldErrors.email && (
                        <span className={styles['field-error']}>{fieldErrors.email}</span>
                    )}
                </div>

                {/* Password Field */}
                <div className={styles['form-group']}>
                    <label className={styles['label']}>PASSWORD</label>
                    <div className={styles['input-wrapper']}>
                        <FaLock className={styles['input-icon']} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            className={`${styles['input-field']} ${styles['input-field--padded-right']} ${fieldErrors.password ? styles['input-error'] : ''}`}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: '' }));
                            }}
                            disabled={isLoading}
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            className={styles['toggle-password']}
                            onClick={() => setShowPassword(p => !p)}
                            tabIndex={-1}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                    </div>
                    {fieldErrors.password && (
                        <span className={styles['field-error']}>{fieldErrors.password}</span>
                    )}
                    <span
                        onClick={() => navigate('/forgot-password')}
                        className={styles['forgotpass-link']}
                    >
                        Forgot Password?
                    </span>
                </div>

                {/* Server-level Error */}
                {errorMessage && (
                    <div className={styles.error}>{errorMessage}</div>
                )}

                <button
                    type="submit"
                    className={styles['login-button']}
                    disabled={isLoading}
                >
                    {isLoading ? 'LOGGING IN...' : 'LOGIN'}
                </button>

                <div className={styles['back-home']}>
                    Don't have an account?{' '}
                    <span onClick={() => navigate('/')}>Go back to Home</span>
                </div>
            </form>
        </div>
    );
}
