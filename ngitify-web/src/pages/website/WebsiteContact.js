import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { clinicInfo, locationCards } from '../../data/websiteContent';

export default function WebsiteContact() {
    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>Contact Us</p>
                        <h1 className={styles.sectionTitle}>Reach the clinic through call or social media</h1>
                        <p className={styles.bodyText}>
                            Dentime currently accommodates patients through regular scheduled appointments and walk-ins.
                            You may also follow the clinic through its social channels for updates and inquiries.
                        </p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <span className={styles.placeholderLabel}>Contact Hero Image Placeholder</span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridThree}>
                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <span className={styles.placeholderLabel}>Phone Card Image Placeholder</span>
                        </div>
                        <h2 className={styles.cardTitle}>Phone Number</h2>
                        <span className={styles.contactValue}>{clinicInfo.contactNumber}</span>
                    </article>

                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <span className={styles.placeholderLabel}>Facebook Card Image Placeholder</span>
                        </div>
                        <h2 className={styles.cardTitle}>Facebook</h2>
                        <p>{clinicInfo.facebookName}</p>
                        <a
                            href={clinicInfo.facebookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.socialBtn}
                        >
                            Open Facebook Page
                        </a>
                    </article>

                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <span className={styles.placeholderLabel}>Instagram Card Image Placeholder</span>
                        </div>
                        <h2 className={styles.cardTitle}>Instagram</h2>
                        <span className={styles.contactValue}>@{clinicInfo.instagramHandle}</span>
                    </article>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.locationCard}>
                        <span className={styles.statusPill}>{locationCards[0].status}</span>
                        <h3 className={styles.cardTitle}>{locationCards[0].name}</h3>
                        <p>{locationCards[0].address}</p>
                    </article>

                    <div className={styles.bannerPlaceholder}>
                        <span className={styles.placeholderLabel}>Map or Clinic Front Placeholder</span>
                    </div>
                </div>
            </section>
        </WebsiteShell>
    );
}
