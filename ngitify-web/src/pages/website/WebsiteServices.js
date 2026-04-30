import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { serviceHighlights } from '../../data/websiteContent';

export default function WebsiteServices() {
    return (
        <WebsiteShell>
            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>Services</p>
                        <h1 className={styles.sectionTitle}>Comprehensive dental services for everyday care and long-term smile support</h1>
                        <p className={styles.bodyText}>
                            Dentime Dental Clinic offers a focused set of dental services across General Dentistry,
                            Orthodontics, Esthetics, and Oral Surgery.
                        </p>
                    </article>

                    <div className={styles.portraitPlaceholder}>
                        <span className={styles.placeholderLabel}>Services Hero Image Placeholder</span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridTwo}>
                    {serviceHighlights.map((service) => (
                        <article key={service.category} className={styles.serviceCard}>
                            <div className={styles.bannerPlaceholder}>
                                <span className={styles.placeholderLabel}>{service.category} Featured Image Placeholder</span>
                            </div>
                            <span className={styles.serviceTag}>{service.category}</span>
                            <h2 className={styles.cardTitle}>{service.category}</h2>
                            <p>{service.description}</p>
                            <ul className={styles.bulletList}>
                                {service.items.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
