import React from 'react';
import { FaEnvelope, FaFacebookF, FaInstagram, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';
import { websiteMediaDefaults } from '../../data/websiteMediaDefaults';
import WebsiteImage from './WebsiteImage';
import styles from '../../styles/website/WebsiteFooter.module.css';

export default function WebsiteFooter() {
    const { clinicInfo, locationCards, websiteContent } = usePublicClinicConfig();
    const primaryLocation = locationCards[0];
    const mainBranchAddress = clinicInfo.address || primaryLocation?.address || '';
    const mainBranchMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mainBranchAddress)}`;
    const media = websiteContent.media;
    const clinicLogoUrl = media.logoUrl || media.logoIconUrl;

    return (
        <footer className={styles.footer} aria-label="Clinic contact details and social media">
            <div className={styles.inner}>
                <div className={styles.column}>
                    <h2 className={styles.title}>Contact Us</h2>
                    <div className={styles.contactList}>
                        <a href={mainBranchMapUrl} target="_blank" rel="noreferrer" className={styles.contactItem}>
                            <span className={styles.contactIcon}><FaMapMarkerAlt /></span>
                            <span>{mainBranchAddress}</span>
                        </a>
                        <a href={`tel:${clinicInfo.contactNumber}`} className={styles.contactItem}>
                            <span className={styles.contactIcon}><FaPhoneAlt /></span>
                            <span>{clinicInfo.contactNumber}</span>
                        </a>
                        <a href={`mailto:${clinicInfo.email}`} className={styles.contactItem}>
                            <span className={styles.contactIcon}><FaEnvelope /></span>
                            <span>{clinicInfo.email || 'Email not available'}</span>
                        </a>
                    </div>
                </div>

                <div className={styles.column}>
                    <h2 className={styles.title}>Follow Us</h2>
                    <div className={styles.socialLinks}>
                        <a href={clinicInfo.facebookUrl} target="_blank" rel="noreferrer" className={styles.socialIcon} aria-label="Visit Dentime on Facebook">
                            <FaFacebookF />
                        </a>
                        <a href={`https://www.instagram.com/${clinicInfo.instagramHandle}/`} target="_blank" rel="noreferrer" className={styles.socialIcon} aria-label="Visit Dentime on Instagram">
                            <FaInstagram />
                        </a>
                    </div>
                </div>

                <div className={styles.brand}>
                    <WebsiteImage
                        src={clinicLogoUrl}
                        fallbackSrc={websiteMediaDefaults.logoUrl || websiteMediaDefaults.logoIconUrl}
                        alt={`${clinicInfo.name} logo`}
                        className={styles.logo}
                    />
                </div>
            </div>
        </footer>
    );
}
