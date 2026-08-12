import React, { useEffect, useState } from "react";
import styles from '../../styles/auth/NewPasswordPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate, useLocation } from "react-router-dom";
import { BASE_URL } from '../../utils/api';
import PasswordField from '../../components/common/PasswordField';

export default function NewPasswordPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // UI State: Show checklist only when focused
    const [showChecklist, setShowChecklist] = useState(false);

    // Validation State
    const [validations, setValidations] = useState({
        length: false,
        upper: false,
        lower: false,
        number: false,
        special: false
    });

    const userEmail = location.state?.email;
    const userOtp = location.state?.otp;

    // Redirect if accessed directly without going through the OTP flow
    useEffect(() => {
        if (!userEmail || !userOtp) {
            navigate('/forgot-password');
        }
    }, [userEmail, userOtp, navigate]);

    useEffect(() => {
        setValidations({
            length: newPassword.length >= 8,
            upper: /[A-Z]/.test(newPassword),
            lower: /[a-z]/.test(newPassword),
            number: /[0-9]/.test(newPassword),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
        });

        if (newPassword && confirmNewPassword) {
            if (newPassword !== confirmNewPassword) setErrorMessage("Passwords do not match.");
            else setErrorMessage("");
        }
    }, [newPassword, confirmNewPassword]);

    const isButtonDisabled = Object.values(validations).some(v => !v) || newPassword !== confirmNewPassword;

    const handleReset = async (e) => {
        e.preventDefault();
        if (isButtonDisabled) return;

        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${BASE_URL}/api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: userEmail, 
                    otp: userOtp,
                    newPassword 
                }),
            });
            
            const data = await response.json();

            if (response.ok) {
                navigate('/password-reset-success'); 
            } else {
                setErrorMessage(data.message || "Failed to reset password.");
            }
        } catch(e) { 
            console.error(e);
            setErrorMessage("Server Error. Please try again."); 
        } finally {
            setIsLoading(false);
        }
    };

    if (!userEmail || !userOtp) return null; // Prevent flash before redirect

    return (
        <div className={styles['main-container']}>
            <form className={styles['container']} onSubmit={handleReset}>
                <img src={logo} alt='Logo' className={styles.logo}/>
                <div className={styles['page-title']}><p className={styles['newpass-title']}>New Password</p></div>
                <div className={styles['page-header']}><p>Please enter your new password.</p></div>
                
                <div className={styles['label-container']}><p className={styles.label}>PASSWORD</p></div>
                
                <PasswordField
                    className={styles['input-field']} 
                    value={newPassword} 
                    onChange={(e)=>setNewPassword(e.target.value)} 
                    onFocus={() => setShowChecklist(true)} 
                    onBlur={() => setShowChecklist(false)} 
                    disabled={isLoading}
                    required
                />
                
                {/* CHECKLIST BOX (Visible only when focused) */}
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
                            <span className={validations.special ? styles.textValid : styles.textInvalid}>Special character like `! @ # $ % ^ & *`</span>
                        </div>
                    </div>
                )}

                <div className={styles['label-container']} style={{marginTop: '15px'}}><p className={styles.label}>CONFIRM PASSWORD</p></div>
                <PasswordField
                    className={styles['input-field']} 
                    value={confirmNewPassword} 
                    onChange={(e)=>setConfirmNewPassword(e.target.value)} 
                    disabled={isLoading}
                    required
                />
                
                <div className={styles.error} style={{ minHeight: '20px', color: '#ff4d4d', fontSize: '14px', textAlign: 'center', marginTop: '10px' }}>
                    {errorMessage}
                </div>
                
                <button 
                    type="submit"
                    className={styles['enter-button']} 
                    disabled={isButtonDisabled || isLoading}
                >
                    {isLoading ? 'UPDATING...' : 'ENTER'}
                </button>

                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        Back to Login
                    </span>
                </div>
            </form>
        </div>
    )
}
