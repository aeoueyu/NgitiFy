import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../../styles/auth/NewPasswordPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { BASE_URL } from '../../utils/api';

const getPasswordChecks = (password = '') => ({
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
});

export default function ActivateAccountPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [status, setStatus] = useState('loading');
    const [accountEmail, setAccountEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showChecklist, setShowChecklist] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const validateToken = async () => {
            try {
                const response = await fetch(`${BASE_URL}/api/activate-account/${token}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Invalid or expired activation link.');
                }

                setAccountEmail(data.email || '');
                setStatus('ready');
            } catch (error) {
                setErrorMessage(error.message || 'Invalid or expired activation link.');
                setStatus('error');
            }
        };

        if (token) {
            validateToken();
        } else {
            setErrorMessage('Invalid activation link.');
            setStatus('error');
        }
    }, [token]);

    const validations = useMemo(() => getPasswordChecks(password), [password]);
    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const canSubmit = Object.values(validations).every(Boolean) && passwordsMatch && !isSubmitting;

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!Object.values(validations).every(Boolean)) {
            setErrorMessage('Please complete all password requirements.');
            return;
        }

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${BASE_URL}/api/activate-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    newPassword: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to activate account.');
            }

            setSuccessMessage(data.message || 'Account activated successfully.');
            setStatus('success');
            window.setTimeout(() => navigate('/login'), 2500);
        } catch (error) {
            setErrorMessage(error.message || 'Failed to activate account.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles['main-container']}>
            <form className={styles.container} onSubmit={handleSubmit}>
                <img src={logo} alt="Dentime" className={styles.logo} />

                {status === 'loading' && (
                    <>
                        <div className={styles['page-title']}><p className={styles['newpass-title']}>Checking Link</p></div>
                        <div className={styles['page-header']}><p>Please wait while we verify your activation link.</p></div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className={styles['page-title']}><p className={styles['newpass-title']}>Activation Unavailable</p></div>
                        <div className={styles['page-header']}><p>{errorMessage}</p></div>
                        <div className={styles['back-container']}>
                            <span onClick={() => navigate('/login')}>Back to Login</span>
                        </div>
                    </>
                )}

                {status === 'ready' && (
                    <>
                        <div className={styles['page-title']}><p className={styles['newpass-title']}>Set Your Password</p></div>
                        <div className={styles['page-header']}>
                            <p>
                                Activate your account by creating a password{accountEmail ? ` for ${accountEmail}` : ''}.
                            </p>
                        </div>

                        <div className={styles['label-container']}><p className={styles.label}>PASSWORD</p></div>
                        <input
                            type="password"
                            className={styles['input-field']}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onFocus={() => setShowChecklist(true)}
                            onBlur={() => setShowChecklist(false)}
                            disabled={isSubmitting}
                            required
                        />

                        {showChecklist && (
                            <div className={styles.checklistBox}>
                                <p className={styles.checklistTitle}>Password must contain:</p>
                                <div className={styles.ruleItem}>
                                    <span className={validations.length ? styles.iconValid : styles.iconInvalid}>●</span>
                                    <span className={validations.length ? styles.textValid : styles.textInvalid}>At least 8 characters</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <span className={validations.upper ? styles.iconValid : styles.iconInvalid}>●</span>
                                    <span className={validations.upper ? styles.textValid : styles.textInvalid}>Uppercase letter</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <span className={validations.lower ? styles.iconValid : styles.iconInvalid}>●</span>
                                    <span className={validations.lower ? styles.textValid : styles.textInvalid}>Lowercase letter</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <span className={validations.number ? styles.iconValid : styles.iconInvalid}>●</span>
                                    <span className={validations.number ? styles.textValid : styles.textInvalid}>Number</span>
                                </div>
                                <div className={styles.ruleItem}>
                                    <span className={validations.special ? styles.iconValid : styles.iconInvalid}>●</span>
                                    <span className={validations.special ? styles.textValid : styles.textInvalid}>Special character</span>
                                </div>
                            </div>
                        )}

                        <div className={styles['label-container']} style={{ marginTop: '15px' }}><p className={styles.label}>CONFIRM PASSWORD</p></div>
                        <input
                            type="password"
                            className={styles['input-field']}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            disabled={isSubmitting}
                            required
                        />

                        <div className={styles.error}>
                            {errorMessage || (!passwordsMatch && confirmPassword ? 'Passwords do not match.' : '')}
                        </div>

                        <button
                            type="submit"
                            className={styles['enter-button']}
                            disabled={!canSubmit}
                        >
                            {isSubmitting ? 'ACTIVATING...' : 'ACTIVATE ACCOUNT'}
                        </button>

                        <div className={styles['back-container']}>
                            <span onClick={() => navigate('/login')}>Back to Login</span>
                        </div>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className={styles['page-title']}><p className={styles['newpass-title']}>Account Activated</p></div>
                        <div className={styles['page-header']}><p>{successMessage}</p></div>
                        <div className={styles['back-container']}>
                            <span onClick={() => navigate('/login')}>Go to Login</span>
                        </div>
                    </>
                )}
            </form>
        </div>
    );
}
