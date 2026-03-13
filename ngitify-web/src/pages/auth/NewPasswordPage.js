import React, { useEffect, useState } from "react";
import styles from '../../styles/auth/NewPasswordPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate, useLocation } from "react-router-dom";

export default function NewPasswordPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
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

    const handleReset = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: location.state?.email, newPassword }),
            });
        
            if (response.ok) {
                navigate('/password-reset-success'); 
            } else {
                setErrorMessage("Failed to reset password.");
            }
        } catch(e) { setErrorMessage("Server Error"); }
    };

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Logo' className={styles.logo}/>
                <div className={styles['page-title']}><p className={styles['newpass-title']}>New Password</p></div>
                <div className={styles['page-header']}><p>Please enter your new password.</p></div>
                
                <div className={styles['label-container']}><p className={styles.label}>PASSWORD</p></div>
                
                <input 
                    type='password' 
                    className={styles['input-field']} 
                    value={newPassword} 
                    onChange={(e)=>setNewPassword(e.target.value)} 
                    onFocus={() => setShowChecklist(true)} // Show checklist
                    onBlur={() => setShowChecklist(false)} // Hide checklist
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
                            <span className={validations.special ? styles.textValid : styles.textInvalid}>Special character</span>
                        </div>
                    </div>
                )}

                <div className={styles['label-container']} style={{marginTop: '15px'}}><p className={styles.label}>CONFIRM PASSWORD</p></div>
                <input type='password' className={styles['input-field']} value={confirmNewPassword} onChange={(e)=>setConfirmNewPassword(e.target.value)} />
                
                <div className={styles.error}>{errorMessage}</div>
                <button className={styles['enter-button']} onClick={handleReset} disabled={isButtonDisabled}>ENTER</button>

                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')}>Back to Login</span>
                </div>
            </div>
        </div>
    )
}