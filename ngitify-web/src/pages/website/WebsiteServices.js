import React from 'react';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';

export default function WebsiteServices() {
    const { serviceHighlights, websiteContent, clinicInfo } = usePublicClinicConfig();
    const servicesContent = websiteContent.servicesPage;
    const media = websiteContent.media;

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>{servicesContent.eyebrow}</p>
                        <h1 className={styles.sectionTitle}>{servicesContent.title}</h1>
                        <p className={styles.bodyText}>{servicesContent.description}</p>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={media.servicesHeroImageUrl} alt={`${clinicInfo.name} services`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridTwo}>
                    {serviceHighlights.map((service) => (
                        <article key={service.category} className={styles.serviceCard}>
                            <div className={styles.bannerPlaceholder}>
                                <img src={service.imageUrl} alt={service.category} className={styles.placeholderImage} />
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
