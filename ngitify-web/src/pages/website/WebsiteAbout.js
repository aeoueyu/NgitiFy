import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';

export default function WebsiteAbout() {
    const navigate = useNavigate();
    const { clinicInfo, locationCards, websiteContent } = usePublicClinicConfig();
    const aboutContent = websiteContent.about;
    const locationsContent = websiteContent.locationsPage;
    const media = websiteContent.media;
    const getMapUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>{aboutContent.eyebrow}</p>
                        <h1 className={styles.sectionTitle}>{aboutContent.title}</h1>
                        <p className={styles.bodyText}>{aboutContent.description}</p>
                        <p className={styles.referenceMeta}>Led by {clinicInfo.owner}</p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={media.aboutHeroImageUrl} alt={`About ${clinicInfo.name}`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridThree}>
                    {aboutContent.highlights.map((highlight, index) => (
                        <article key={index} className={`${styles.infoCard} ${styles.whiteSurfaceCard}`}>
                            <div className={styles.squarePlaceholder}>
                                <img
                                    src={media.aboutHighlightImageUrls[index] || media.aboutHighlightImageUrls[media.aboutHighlightImageUrls.length - 1] || media.aboutHeroImageUrl}
                                    alt={`${clinicInfo.name} feature ${index + 1}`}
                                    className={styles.placeholderImage}
                                />
                            </div>
                            <h3 className={styles.cardTitle}>{aboutContent.highlightCardTitle}</h3>
                            <p>{highlight}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="locations" className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.eyebrow}>{locationsContent.eyebrow}</p>
                    <h2 className={styles.sectionTitle}>{locationsContent.title}</h2>
                    <p className={styles.bodyText}>{locationsContent.description}</p>
                </div>

                <div className={styles.gridTwo}>
                    {locationCards.map((location) => (
                        <article key={location.name} className={styles.locationCard}>
                            <div className={styles.bannerPlaceholder}>
                                <img src={media.locationCardImageUrl} alt={location.name} className={styles.placeholderImage} />
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
