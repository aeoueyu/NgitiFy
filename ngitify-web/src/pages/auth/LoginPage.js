import React, { useState, useContext } from 'react';
import styles from '../../styles/auth/LoginPage.module.css';
import logo from '../../assets/icons/logo-dentime.svg'; 
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext'; // Imported AuthContext directly

export default function LoginPage() {
    const navigate = useNavigate();
    // Use useContext directly with your AuthContext to extract the login function
    const { login } = useContext(AuthContext); 
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage(""); // Clear previous errors
        setIsLoading(true);
        
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
                // === FIX: EXPLICITLY SAVE THE CLEAN TOKEN STRING HERE ===
                localStorage.setItem('token', data.token);

                // Pass the user data to update the global AuthContext state.
                await login({
                    token: data.token,
                    role: data.role,
                    userId: data.userId,
                    userEmail: email
                });

                // Redirect based on role returned by backend
                if (data.role === 'owner') {
                    navigate('/owner/dashboard');
                } else if (data.role === 'dentist') {
                    navigate('/dentist/dashboard');
                } else if (data.role === 'secretary') {
                    navigate('/secretary/dashboard');
                } else if (data.role === 'patient') {
                    navigate('/patient/dashboard');
                } else {
                    setErrorMessage("Unrecognized user role.");
                }
            } else {
                // Show Error
                setErrorMessage(data.message || "Invalid email or password.");
            }
        } catch (error) {
            console.error("Login failed", error);
            setErrorMessage("Cannot connect to server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles['main-container']}>
            <form className={styles['container']} onSubmit={handleLogin}>
                <img src={logo} alt='Lardizabal Dental Clinic' className={styles['logo']} />
                
                <div className={styles['header-text']}>
                    <h2>Login to your <span className={styles['accent-text']}>Account</span></h2>
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
                        disabled={isLoading}
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
                        disabled={isLoading}
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
                    <div className={styles.error} style={{ color: 'red', marginBottom: '10px', fontSize: '14px', textAlign: 'center' }}>
                        {errorMessage}
                    </div>
                )}

                <button 
                    type="submit" 
                    className={styles['login-button']} 
                    disabled={isLoading}
                >
                    {isLoading ? 'LOGGING IN...' : 'LOGIN'}
                </button>

                <div className={styles['back-home']}>
                    Don't have an account? <span onClick={() => navigate('/')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Go back to Home</span>
                </div>
            </form>
        </div>
    );
}