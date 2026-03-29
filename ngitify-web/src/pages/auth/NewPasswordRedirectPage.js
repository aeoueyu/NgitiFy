import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/auth/NewPasswordRedirectPage.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import successIcon from '../../assets/alert/success.svg'; 

export default function NewPasswordRedirectPage() {
    const navigate = useNavigate();

    return (
        <div className={styles['main-container']}>
            <div className={styles['container']}>
                <img src={logo} alt='Dentime Logo' className={styles.logo} />
                <img src={successIcon} alt="Success Icon" style={{ width: '60px', marginBottom: '15px' }} />
                
                <div className={styles['page-title']}>
                    <p>Password Changed!</p>
                </div>
                
                <div className={styles['page-header']}>
                    <p>Your password has been successfully reset. You can now login with your new password.</p>
                </div>

                <button 
                    className={styles['login-button']} 
                    onClick={() => navigate('/login')}
                    autoFocus // Automatically focuses the button so users can just press 'Enter'
                >
                    GO TO LOGIN
                </button>
            </div>
        </div>
    );
}