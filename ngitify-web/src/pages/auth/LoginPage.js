import React, { useState } from 'react';
import styles from '../../styles/auth/LoginPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage(""); // Clear previous errors
        
        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    password
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Login Success
                localStorage.setItem('token', data.token);
                localStorage.setItem('role', data.role); // Save role for future checks
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userEmail', email);

                // Redirect based on role returned by backend
                if (data.role === 'owner') navigate('/owner/dashboard');
                else if (data.role === 'dentist') navigate('/dentist/dashboard');
                else if (data.role === 'secretary') navigate('/secretary/dashboard');
                else if (data.role === 'patient') navigate('/patient/dashboard');
            } else {
                // Show Error
                setErrorMessage(data.message);
            }
        } catch (error) {
            console.error("Login failed", error);
            setErrorMessage("Cannot connect to server.");
        }
    }

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Lardizabal Dental Clinic' className={styles['logo']} />
                
                <div className={styles['header-text']}>
                    <h2>Login to your <span className={styles['pink-text']}>Account</span></h2>
                </div>

                <div className={styles['form-group']}>
                    <label className={styles['label']}>EMAIL ADDRESS</label>
                    <input
                        type='email' 
                        placeholder='Enter your email' 
                        className={styles['input-field']}
                        value={email}
                        onChange={(e)=>setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className={styles['form-group']}>
                    <label className={styles['label']}>PASSWORD</label>
                    <input
                        type='password'
                        placeholder='Enter your password'
                        className={styles['input-field']}
                        value={password}
                        onChange={(e)=>setPassword(e.target.value)}
                        required
                    />
                    <span 
                        onClick={() => navigate('/forgot-password')} 
                        className={styles['forgotpass-link']}
                        style={{cursor: 'pointer'}}
                    >
                        Forgot Password?
                    </span>
                </div>

                {/* Error Message Display */}
                {errorMessage && (
                    <div className={styles.error}>
                        {errorMessage}
                    </div>
                )}

                <button className={styles['login-button']} onClick={handleLogin}>
                    LOGIN
                </button>

                <div className={styles['change-role']}>
                    Don't have an account? <span onClick={() => navigate('/')}>Go back to Home</span>
                </div>
            </div>
        </div>
    );
}