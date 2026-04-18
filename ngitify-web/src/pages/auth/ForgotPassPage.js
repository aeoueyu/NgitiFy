import React, { useState } from 'react';
import styles from '../../styles/auth/ForgotPassPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../../utils/api';

export default function ForgotPassPage() {
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSendCode = async (e) => {
        e.preventDefault(); // Prevent page reload on form submit

        if (!email) {
            setErrorMessage('Please enter your email address.');
            return;
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setErrorMessage('Please enter a valid email address.');
            return;
        }
        
        setIsLoading(true);
        
        try {
            // This API call now *always* returns a success-like response to the frontend.
            // The backend decides whether to actually send an email to prevent user enumeration.
            await fetch(`${BASE_URL}/api/forgot-password`, {
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
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles['main-container']}>
            {/* Wrapped in a form to allow native "Enter" key submission */}
            <form className={styles['container']} onSubmit={handleSendCode}>
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
                    disabled={isLoading}
                    required
                />
                
                {/* Added inline styles strictly for error formatting without changing external CSS */}
                <div className={styles.error} style={{ color: '#ff4d4d', minHeight: '20px', fontSize: '14px', marginTop: '5px', textAlign: 'center' }}>
                    {errorMessage}
                </div>
                
                <button 
                    type="submit" 
                    className={styles['enter-button']}
                    disabled={isLoading}
                >
                    {isLoading ? 'SENDING...' : 'SEND CODE'}
                </button>

                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        Back to Login
                    </span>
                </div>
            </form>
        </div>
    );
}