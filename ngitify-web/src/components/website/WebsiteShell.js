import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaXmark } from 'react-icons/fa6';
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
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        document.body.style.overflow = menuOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [menuOpen]);

    useEffect(() => {
        const revealTargets = Array.from(
            document.querySelectorAll('main section, main article, main form')
        ).filter((node) => !node.closest(`.${styles.topBar}`));

        revealTargets.forEach((node, index) => {
            node.classList.add('website-reveal');
            node.style.setProperty('--reveal-delay', `${Math.min(index * 0.06, 0.36)}s`);
        });

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('website-reveal-visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                threshold: 0.16,
                rootMargin: '0px 0px -40px 0px',
            }
        );

        revealTargets.forEach((node) => observer.observe(node));

        return () => {
            observer.disconnect();
            revealTargets.forEach((node) => {
                node.classList.remove('website-reveal', 'website-reveal-visible');
                node.style.removeProperty('--reveal-delay');
            });
        };
    }, [children]);

    return (
        <div className={styles.page}>
            <header className={styles.topBar}>
                <div className={styles.brandRow}>
                    <button className={styles.logoButton} onClick={() => navigate('/')} type="button">
                        <img src={logo} alt="Dentime Logo" className={styles.logo} />
                    </button>

                    <button
                        className={styles.menuToggle}
                        type="button"
                        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((prev) => !prev)}
                    >
                        {menuOpen ? <FaXmark /> : <FaBars />}
                    </button>
                </div>

                <nav className={`${styles.navPanel} ${menuOpen ? styles.navPanelOpen : ''}`}>
                    <div className={styles.navLinks}>
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
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.loginBtn} onClick={() => navigate('/login')} type="button">
                            LOGIN
                        </button>
                    </div>
                </nav>
            </header>

            {menuOpen ? <button className={styles.menuBackdrop} type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} /> : null}

            <main className={styles.content}>{children}</main>
        </div>
    );
}
