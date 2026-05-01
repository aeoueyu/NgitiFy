import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import estheticsImage from '../../assets/images/esthetics-image.jpg';
import generalDentistryImage from '../../assets/images/general-dentistry-image.jpg';
import oralSurgeryImage from '../../assets/images/oral-surgery-image.jpg';
import orthodonticsImage from '../../assets/images/orthodontics-image.jpg';
import servicesHeroImage from '../../assets/images/services-hero-image.jpg';
import { serviceHighlights } from '../../data/websiteContent';

const serviceImages = {
    'General Dentistry': generalDentistryImage,
    Orthodontics: orthodonticsImage,
    Esthetics: estheticsImage,
    'Oral Surgery': oralSurgeryImage,
};

export default function WebsiteServices() {
    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>Services</p>
                        <h1 className={styles.sectionTitle}>Comprehensive dental services for everyday care and long-term smile support</h1>
                        <p className={styles.bodyText}>
                            Dentime Dental Clinic offers a focused set of dental services across General Dentistry,
                            Orthodontics, Esthetics, and Oral Surgery.
                        </p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={servicesHeroImage} alt="Dentime dental services" className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridTwo}>
                    {serviceHighlights.map((service) => (
                        <article key={service.category} className={styles.serviceCard}>
                            <div className={styles.bannerPlaceholder}>
                                <img src={serviceImages[service.category]} alt={service.category} className={styles.placeholderImage} />
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
