import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebsiteShell from '../../components/website/WebsiteShell';
import WebsiteImage from '../../components/website/WebsiteImage';
import styles from '../../styles/website/WebsitePages.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';
import { websiteMediaDefaults } from '../../data/websiteMediaDefaults';

export default function WebsiteLocations() {
    const navigate = useNavigate();
    const { clinicInfo, locationCards, websiteContent } = usePublicClinicConfig();
    const locationsContent = websiteContent.locationsPage;
    const media = websiteContent.media;
    const getMapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>{locationsContent.eyebrow}</p>
                        <h1 className={styles.sectionTitle}>{locationsContent.title}</h1>
                        <p className={styles.bodyText}>{locationsContent.description}</p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <WebsiteImage src={media.locationsHeroImageUrl} fallbackSrc={websiteMediaDefaults.locationsHeroImageUrl} alt={`${clinicInfo.name} branch locations`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridTwo}>
                    {locationCards.map((location) => (
                        <article key={location.name} className={styles.locationCard}>
                            <div className={styles.bannerPlaceholder}>
                                <WebsiteImage src={media.locationCardImageUrl} fallbackSrc={websiteMediaDefaults.locationCardImageUrl} alt={location.name} className={styles.placeholderImage} />
                            </div>
                            <span className={styles.statusPill}>{location.status}</span>
                            <h2 className={styles.cardTitle}>{location.name}</h2>
                            <p>{location.address}</p>
                            <p className={styles.bodyText}>{location.note}</p>
                            <div className={styles.contactActionRow}>
                                <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                                    {locationsContent.bookCtaLabel}
                                </button>
                                <a href={`tel:${clinicInfo.contactNumber}`} className={styles.secondaryBtn}>
                                    {locationsContent.callCtaLabel}
                                </a>
                                <a
                                    href={getMapUrl(location.address)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.socialBtn}
                                >
                                    {locationsContent.mapCtaLabel}
                                </a>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
