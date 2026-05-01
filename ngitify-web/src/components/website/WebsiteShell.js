import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaXmark } from 'react-icons/fa6';
import { FaRegComments, FaPaperPlane } from 'react-icons/fa';
import logo from '../../assets/images/logo-dentime.svg';
import { clinicInfo } from '../../data/websiteContent';
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
    const [chatOpen, setChatOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        setChatOpen(false);
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

            <div className={styles.mobileQuickBar}>
                <a href={`tel:${clinicInfo.contactNumber}`} className={styles.mobileQuickAction}>
                    Call
                </a>
                <button className={styles.mobileQuickAction} type="button" onClick={() => navigate('/appointment')}>
                    Book
                </button>
                <button className={styles.mobileQuickAction} type="button" onClick={() => navigate('/locations')}>
                    Branches
                </button>
            </div>

            <div className={styles.chatbotLayer}>
                {chatOpen ? (
                    <div className={styles.chatbotPanel}>
                        <div className={styles.chatbotHeader}>
                            <div>
                                <p className={styles.chatbotEyebrow}>Dentime Assistant</p>
                                <h3 className={styles.chatbotTitle}>Chat Support</h3>
                            </div>
                            <button
                                className={styles.chatbotClose}
                                type="button"
                                aria-label="Close chat support"
                                onClick={() => setChatOpen(false)}
                            >
                                <FaXmark />
                            </button>
                        </div>

                        <div className={styles.chatbotBody}>
                            <div className={styles.chatBubbleBot}>
                                Hello! Our website assistant is still being prepared.
                            </div>
                            <div className={styles.chatBubbleBot}>
                                For now, you may book an appointment, call the clinic, or visit the Contact Us page for help.
                            </div>
                            <div className={styles.chatQuickActions}>
                                <button type="button" className={styles.chatActionBtn} onClick={() => navigate('/appointment')}>
                                    Book Appointment
                                </button>
                                <button type="button" className={styles.chatActionBtn} onClick={() => navigate('/contact-us')}>
                                    Contact Us
                                </button>
                            </div>
                        </div>

                        <div className={styles.chatbotInputRow}>
                            <div className={styles.chatbotStaticInput}>Type your message...</div>
                            <button type="button" className={styles.chatbotSendBtn} aria-label="Static send button">
                                <FaPaperPlane />
                            </button>
                        </div>
                    </div>
                ) : null}

                <button
                    className={styles.chatbotFab}
                    type="button"
                    aria-label={chatOpen ? 'Hide chat support' : 'Open chat support'}
                    onClick={() => setChatOpen((prev) => !prev)}
                >
                    <FaRegComments />
                </button>
            </div>
        </div>
    );
}
