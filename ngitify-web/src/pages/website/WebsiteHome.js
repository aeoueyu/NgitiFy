import React from 'react';
import styles from '../../styles/website/WebsiteHome.module.css';
import logo from '../../assets/images/logo-dentime.svg';
import background from '../../assets/images/bg.svg';
import { useNavigate } from 'react-router-dom';

export default function WebsiteHome() {
    const navigate = useNavigate();
    
    return (
        <div className={styles['main-container']}>
            <nav className={styles['top-bar']}>
                <div className={styles['logo-container']}>
                    <img src={logo} alt='Dentime Logo' className={styles['logo']} />
                </div>

                <div className={styles['nav-links']}>
                    <a href="#home" className={styles['nav-item']}>Home</a>
                    <a href="#about" className={styles['nav-item']}>About</a>
                    <a href="#services" className={styles['nav-item']}>Services</a>
                    <a href="#client" className={styles['nav-item']}>Client</a>
                    <a href="#locations" className={styles['nav-item']}>Locations</a>
                    <a href="#contact" className={styles['nav-item']}>Contact Us</a>
                </div>

                <div className={styles['auth-buttons']}>
                    <button className={styles['login-btn']} onClick={() => navigate('/login')}>
                        LOGIN
                    </button>
                </div>
            </nav>

            <div className={styles['content-wrapper']}>
                {/* Background Image Layer */}
                <img src={background} alt="Dentime" className={styles['bg-image']} />
                
                {/* Content Layer */}
                <div className={styles['hero-container']}>
                    <div className={styles['intro-section']}>
                        <h2 className={styles['intro-subtitle']}>
                            AFFORDABLE <span className={styles['pink-text']}>SMILES?</span> ALWAYS.
                        </h2>
                        <p className={styles['intro-description']}>
                            A healthy, confident smile should never come with a heavy price tag. 
                            At <strong>Dentime Dental Clinic</strong>, we believe in providing professional, 
                            quality, and affordable care for every patient.
                        </p>
                        <button className={styles['visit-btn']}>
                            VISIT NOW
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}