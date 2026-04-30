import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { aboutHighlights, clinicInfo } from '../../data/websiteContent';

export default function WebsiteAbout() {
    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>About Dentime</p>
                        <h1 className={styles.sectionTitle}>Dental care that feels warm, modern, and approachable</h1>
                        <p className={styles.bodyText}>
                            {clinicInfo.name} is a growing clinic led by {clinicInfo.owner}, focused on making quality dental care
                            easier to access and more comfortable to experience.
                        </p>
                    </article>

                    <div className={styles.portraitPlaceholder}>
                        <span className={styles.placeholderLabel}>About Hero Image Placeholder</span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridThree}>
                    {aboutHighlights.map((highlight, index) => (
                        <article key={index} className={styles.infoCard}>
                            <div className={styles.squarePlaceholder}>
                                <span className={styles.placeholderLabel}>Feature Image Placeholder</span>
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
