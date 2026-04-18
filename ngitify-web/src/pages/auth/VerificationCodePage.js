import React, { useRef, useState, useEffect } from 'react';
import styles from '../../styles/auth/VerificationCodePage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate, useLocation } from 'react-router-dom';
import { BASE_URL } from '../../utils/api';

export default function VerificationCodePage() {
    const [code, setCode] = useState(new Array(6).fill(''));
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [resendTimer, setResendTimer] = useState(30);
    const [isLoading, setIsLoading] = useState(false);

    const userEmail = location.state?.email;

    useEffect(() => {
        if (!userEmail) {
            navigate('/forgot-password');
        }
        if (inputRefs.current[0]) inputRefs.current[0].focus();
    }, [userEmail, navigate]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleChange = (element, index) => {
        if (isNaN(element.value)) return false;
        
        if (errorMessage) setErrorMessage('');
        if (successMessage) setSuccessMessage('');

        const newCode = [...code];
        newCode[index] = element.value.substring(element.value.length - 1);
        setCode(newCode);
        
        if (element.value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };
    
    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
        if (e.key === 'Enter') {
            handleEnter();
        }
    };

    const handleResend = async (e) => {
        e.preventDefault();
        if (resendTimer > 0) return;
        
        setErrorMessage('');
        setSuccessMessage('');
        
        try {
            const response = await fetch(`${BASE_URL}/api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail }),
            });
            
            const data = await response.json();
            
            if (response.ok) { 
                setSuccessMessage("New code sent!"); 
                setResendTimer(30); 
                setCode(new Array(6).fill('')); 
                inputRefs.current[0].focus();
            } else {
                setErrorMessage(data.message || "Failed to resend code.");
            }
        } catch (err) { 
            console.error(err); 
            setErrorMessage("Network error. Please try again.");
        }
    };

    const handleEnter = async () => {
        const fullCode = code.join('');
        
        if (fullCode.length < 6) {
            setErrorMessage('Please enter the complete 6-digit code.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            // Reverted back to sending a String with the exact 'otp' key 
            // to perfectly match the backend: const { email, otp } = req.body;
            const response = await fetch(`${BASE_URL}/api/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: userEmail, 
                    otp: fullCode
                }),
            });
            
            const data = await response.json();

            if (response.ok) { 
                navigate('/new-password', { state: { email: userEmail } });
            } else { 
                setErrorMessage(data.message || "Invalid or expired code.");
                setCode(new Array(6).fill('')); 
                inputRefs.current[0].focus();
            }
        } catch (error) {
            console.error(error);
            setErrorMessage("Cannot connect to server.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!userEmail) return null;

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Logo' className={styles['logo']}/>
                <div className={styles['page-title']}><p className={styles['verify-title']}>Verify email address</p></div>
                <div className={styles['page-header']}><p>Enter 6-digit code sent to <strong>{userEmail}</strong></p></div>
                
                <div className={styles['code-field']}>
                    {code.map((data, index) => (
                        <input 
                            key={index} 
                            type='text' 
                            inputMode='numeric' 
                            maxLength='1' 
                            className={styles['code-input']}
                            value={data} 
                            ref={el => inputRefs.current[index] = el}
                            onChange={e => handleChange(e.target, index)} 
                            onKeyDown={e => handleKeyDown(e, index)}
                            disabled={isLoading}
                        />
                    ))}
                </div>

                <div className={styles['message']} style={{ minHeight: '24px', textAlign: 'center', marginTop: '10px' }}>
                    {successMessage && <div className={styles['success']} style={{ color: 'green', fontSize: '14px' }}>{successMessage}</div>}
                    {errorMessage && <div className={styles['error']} style={{ color: '#ff4d4d', fontSize: '14px' }}>{errorMessage}</div>}
                </div>
                
                <button 
                    className={styles['enter-button']} 
                    onClick={handleEnter}
                    disabled={isLoading}
                >
                    {isLoading ? 'VERIFYING...' : 'ENTER'}
                </button>
                
                <div className={styles['resend-container']}>
                    <p className={styles['resend-label']}>
                        Didn't get code?{' '}
                        {resendTimer > 0 ? (
                            <span>Wait {resendTimer}s</span>
                        ) : (
                            <span 
                                onClick={handleResend} 
                                className={styles['click-resend']}
                                style={{ cursor: 'pointer', color: 'var(--primary-color, #1a73e8)', fontWeight: 'bold' }}
                            >
                                Resend
                            </span>
                        )}
                    </p>
                </div>

                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                        Back to Login
                    </span>
                </div>
            </div>
        </div>
    );
}