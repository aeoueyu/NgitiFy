import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import locationsHeroImage from '../../assets/images/locations-hero-image.jpg';
import { clinicInfo, locationCards } from '../../data/websiteContent';

export default function WebsiteLocations() {
    const navigate = useNavigate();
    const getMapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>Locations</p>
                        <h1 className={styles.sectionTitle}>Visit Dentime at the branch nearest to you</h1>
                        <p className={styles.bodyText}>
                            Dentime is currently serving patients in Marikina City and Rodriguez, Rizal through its active branches.
                        </p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={locationsHeroImage} alt="Dentime branch locations" className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridTwo}>
                    {locationCards.map((location) => (
                        <article key={location.name} className={styles.locationCard}>
                            <div className={styles.bannerPlaceholder}>
                                <span className={styles.placeholderLabel}>{location.name} Image Placeholder</span>
                            </div>
                            <span className={styles.statusPill}>{location.status}</span>
                            <h2 className={styles.cardTitle}>{location.name}</h2>
                            <p>{location.address}</p>
                            <p className={styles.bodyText}>{location.note}</p>
                            <div className={styles.contactActionRow}>
                                <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                                    Book at This Branch
                                </button>
                                <a href={`tel:${clinicInfo.contactNumber}`} className={styles.secondaryBtn}>
                                    Call the Clinic
                                </a>
                                <a
                                    href={getMapUrl(location.address)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.socialBtn}
                                >
                                    Open in Maps
                                </a>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
