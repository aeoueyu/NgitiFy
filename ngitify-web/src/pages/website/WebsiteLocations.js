import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { locationCards } from '../../data/websiteContent';

export default function WebsiteLocations() {
    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>Locations</p>
                        <h1 className={styles.sectionTitle}>Current and upcoming branch locations</h1>
                        <p className={styles.bodyText}>
                            Dentime is currently operating in Marikina City and preparing a second branch in Rodriguez, Rizal
                            to support a larger patient community.
                        </p>
                    </article>

                    <div className={styles.portraitPlaceholder}>
                        <span className={styles.placeholderLabel}>Locations Hero Image Placeholder</span>
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
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
