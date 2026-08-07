import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaXmark } from 'react-icons/fa6';
import styles from '../../styles/website/WebsiteShell.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';
import { websiteMediaDefaults } from '../../data/websiteMediaDefaults';
import WebsiteImage from './WebsiteImage';

const navItems = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Services', path: '/services' },
    { label: 'Contact Us', path: '/contact-us' },
    { label: 'Appointment', path: '/appointment' },
];

export default function WebsiteShell({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { clinicInfo, websiteContent } = usePublicClinicConfig();
    const [menuOpen, setMenuOpen] = useState(false);
    const logoUrl = websiteContent?.media?.logoUrl || websiteContent?.media?.logoIconUrl || '';

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!location.hash) {
            window.scrollTo(0, 0);
            return undefined;
        }

        const scrollToHashTarget = () => {
            const target = document.getElementById(location.hash.replace('#', ''));
            if (!target) return false;
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return true;
        };

        if (scrollToHashTarget()) {
            return undefined;
        }

        const timeoutId = window.setTimeout(scrollToHashTarget, 120);
        return () => window.clearTimeout(timeoutId);
    }, [location.hash, location.pathname]);

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
    }, [location.pathname]);

    return (
        <div className={styles.page}>
            <header className={styles.topBar}>
                <div className={styles.brandRow}>
                    <button className={styles.logoButton} onClick={() => navigate('/')} type="button">
                        <WebsiteImage
                            src={logoUrl}
                            fallbackSrc={websiteMediaDefaults.logoUrl || websiteMediaDefaults.logoIconUrl}
                            alt={`${clinicInfo.name} logo`}
                            className={styles.logo}
                        />
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

            <div className={styles.mobileQuickBar}>
                <a href={`tel:${clinicInfo.contactNumber}`} className={styles.mobileQuickAction}>
                    Call
                </a>
                <button className={styles.mobileQuickAction} type="button" onClick={() => navigate('/appointment')}>
                    Book
                </button>
                <button className={styles.mobileQuickAction} type="button" onClick={() => navigate('/about#locations')}>
                    Branches
                </button>
            </div>

        </div>
    );
}
