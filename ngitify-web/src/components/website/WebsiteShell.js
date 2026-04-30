import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../../assets/images/logo-dentime.svg';
import styles from '../../styles/website/WebsiteShell.module.css';

const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Services', path: '/services' },
    { label: 'Locations', path: '/locations' },
    { label: 'Contact Us', path: '/contact-us' },
    { label: 'Appointment', path: '/appointment' },
];

export default function WebsiteShell({ children }) {
    const navigate = useNavigate();

    return (
        <div className={styles.page}>
            <header className={styles.topBar}>
                <button className={styles.logoButton} onClick={() => navigate('/')} type="button">
                    <img src={logo} alt="Dentime Logo" className={styles.logo} />
                </button>

                <nav className={styles.navLinks}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                isActive ? `${styles.navItem} ${styles.activeNavItem}` : styles.navItem
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className={styles.actions}>
                    <button className={styles.loginBtn} onClick={() => navigate('/login')} type="button">
                        LOGIN
                    </button>
                </div>
            </header>

            <main className={styles.content}>{children}</main>
        </div>
    );
}
