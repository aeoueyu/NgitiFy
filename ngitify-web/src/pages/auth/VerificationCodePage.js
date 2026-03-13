import React, { useRef, useState, useEffect } from 'react';
import styles from '../../styles/auth/VerificationCodePage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate, useLocation } from 'react-router-dom';

export default function VerificationCodePage() {
    const [code, setCode] = useState(new Array(6).fill('')); 
    const inputRefs = useRef([]);
    const navigate = useNavigate();
    const location = useLocation();

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [resendTimer, setResendTimer] = useState(30);

    const userEmail = location.state?.email || 'your email';

    // ... (Use existing handleChange, handleKeyDown, handleResend, useEffects) ...
    // NOTE: Keep your existing logic functions here
    const handleChange = (element, index) => {
        if (isNaN(element.value)) return false;
        const newCode = [...code];
        newCode[index] = element.value.substring(element.value.length - 1);
        setCode(newCode);
        if (element.value && index < 5) inputRefs.current[index + 1].focus();
    };
    
    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) inputRefs.current[index - 1].focus();
    };

    const handleResend = async (e) => {
        e.preventDefault();
        if (resendTimer > 0) return;
        try {
            const response = await fetch('http://localhost:5000/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail }),
            });
            if (response.ok) { setSuccessMessage("New code sent!"); setResendTimer(30); }
        } catch (err) { console.error(err); }
    };

    useEffect(() => { if (inputRefs.current[0]) inputRefs.current[0].focus(); }, []);
    useEffect(() => {
        let interval;
        if (resendTimer > 0) interval = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleEnter = async () => {
        const fullCode = code.join('');
        const response = await fetch('http://localhost:5000/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, otp: fullCode }),
        });
        if (response.ok) navigate('/new-password', { state: { email: userEmail } });
        else setErrorMessage("Invalid Code");
    };

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Logo' className={styles['logo']}/>
                <div className={styles['page-title']}><p className={styles['verify-title']}>Verify email address</p></div>
                <div className={styles['page-header']}><p>Enter 6-digit code sent to <strong>{userEmail}</strong></p></div>
                
                <div className={styles['code-field']}>
                    {code.map((data, index) => (
                        <input key={index} type='text' inputMode='numeric' maxLength='1' className={styles['code-input']}
                            value={data} ref={el => inputRefs.current[index] = el}
                            onChange={e => handleChange(e.target, index)} onKeyDown={e => handleKeyDown(e, index)}
                        />
                    ))}
                </div>

                <div className={styles['message']}>
                    <div className={styles['success']}>{successMessage}</div>
                    <div className={styles['error']}>{errorMessage}</div>
                </div>
                <button className={styles['enter-button']} onClick={handleEnter}>ENTER</button>
                <div className={styles['resend-container']}>
                    <p className={styles['resend-label']}>
                        Didn't get code?{' '}
                        {resendTimer > 0 ? <span>Wait {resendTimer}s</span> : <a href='#!' onClick={handleResend} className={styles['click-resend']}>Resend</a>}
                    </p>
                </div>

                {/* ADDED: Back Link */}
                <div className={styles['back-container']}>
                    <span onClick={() => navigate('/login')}>Back to Login</span>
                </div>
            </div>
        </div>
    )
}