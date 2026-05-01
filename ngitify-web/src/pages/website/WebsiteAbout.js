import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import aboutHeroImage from '../../assets/images/about-hero-image.jpg';
import featureImage1 from '../../assets/images/feature-image-1.jpg';
import featureImage2 from '../../assets/images/feature-image-2.jpg';
import featureImage3 from '../../assets/images/feature-image-3.jpg';
import { aboutHighlights, clinicInfo } from '../../data/websiteContent';

const featureImages = [featureImage1, featureImage2, featureImage3];

export default function WebsiteAbout() {
    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>About Dentime</p>
                        <h1 className={styles.sectionTitle}>Dental care that feels warm, modern, and approachable</h1>
                        <p className={styles.bodyText}>
                            {clinicInfo.name} is a growing clinic led by {clinicInfo.owner}, focused on making quality dental care
                            easier to access and more comfortable to experience.
                        </p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={aboutHeroImage} alt="About Dentime Dental Clinic" className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridThree}>
                    {aboutHighlights.map((highlight, index) => (
                        <article key={index} className={`${styles.infoCard} ${styles.whiteSurfaceCard}`}>
                            <div className={styles.squarePlaceholder}>
                                <img
                                    src={featureImages[index]}
                                    alt={`Dentime feature ${index + 1}`}
                                    className={styles.placeholderImage}
                                />
                            </div>
                            <h3 className={styles.cardTitle}>Why Patients Visit</h3>
                            <p>{highlight}</p>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
