import React, { useState } from 'react';
import styles from '../../styles/auth/ForgotPassPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassPage() {
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');

    const handleSendCode = async () => {
        if (!email) {
            setErrorMessage('Please enter your email address.');
            return;
        }
        
        try {
            // This API call now *always* returns a success-like response to the frontend.
            // The backend decides whether to actually send an email.
            await fetch('http://localhost:5000/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            // Navigate to the verification page regardless of whether the email exists,
            // passing the email along so the next page knows who is trying to verify.
            navigate('/verification-code', { state: { email } });

        } catch (error) {
            console.error("Error requesting password reset:", error);
            // Even if the server connection fails, we proceed to the next page
            // to avoid leaking information about the server's status.
            navigate('/verification-code', { state: { email } });
        }
    };

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Logo' className={styles.logo}/>
                
                <div className={styles['page-title']}>
                    <p>Forgot Password</p>
                </div>
                <div className={styles['page-header']}>
                    <p>Enter your email address and we'll send you a code to reset your password.</p>
                </div>

                <div className={styles['label-container']}><p className={styles.label}>EMAIL ADDRESS</p></div>
                <input 
                    type='email' 
                    className={styles['input-field']} 
                    value={email} 
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage('');
                    }} 
                />
                
                <div className={styles.error}>{errorMessage}</div>
                <button className={styles['enter-button']} onClick={handleSendCode}>SEND CODE</button>

                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')}>Back to Login</span>
                </div>
            </div>
        </div>
    );
}