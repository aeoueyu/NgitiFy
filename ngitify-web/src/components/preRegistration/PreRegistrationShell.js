import React from 'react';
import { Link } from 'react-router-dom';
import dentimeLogo from '../../assets/images/logo-dentime.svg';
import styles from './PreRegistrationShell.module.css';

export default function PreRegistrationShell({ children }) {
    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <Link to="/" className={styles.brand} aria-label="Go to the Dentime home page">
                    <img src={dentimeLogo} alt="Dentime Dental Clinic" className={styles.logo} />
                </Link>
                <span className={styles.secureLabel}>Secure Pre-Registration</span>
            </header>
            <main className={styles.main}>{children}</main>
            <footer className={styles.footer}>
                Dentime Dental Clinic · Patient Pre-Registration
            </footer>
        </div>
    );
}
