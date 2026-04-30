import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import heroImage from '../../assets/images/dentime-dental-clinic-home.svg';
import { clinicInfo, serviceHighlights } from '../../data/websiteContent';

export default function WebsiteHome() {
    const navigate = useNavigate();

    return (
        <WebsiteShell>
            <section className={styles.hero}>

                <div className={styles.heroCard}>
                    <p className={styles.eyebrow}>Specialized Dental Care</p>
                    <h1 className={styles.heroTitle}>
                        Bright smiles start with
                        <span className={styles.heroTitleAccent}> care that feels easy to trust.</span>
                    </h1>
                    <p className={styles.heroText}>
                        {clinicInfo.name} delivers approachable, affordable dental care for patients and families,
                        with services ranging from routine cleaning to braces, esthetics, and oral surgery.
                    </p>
                    <div className={styles.buttonRow}>
                        <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                            Book an Appointment
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => navigate('/services')} type="button">
                            View Services
                        </button>
                    </div>
                </div>

                <div className={styles.heroImageCard}>
                    <img src={heroImage} alt="Dentime Dental Clinic" className={styles.heroImage} />
                </div>

                <article className={`${styles.statCard} ${styles.heroStatCard}`}>
                    <span className={styles.statValue}>General Dentistry</span>
                    <span className={styles.statLabel}>Orthodontics | Esthetics | Oral Surgery</span>
                    <p className={styles.bodyText}>
                        A focused dental service lineup for everyday care, smile improvement, and advanced treatment needs.
                    </p>
                </article>
            </section>

            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.infoCard}>
                        <p className={styles.eyebrow}>About the Clinic</p>
                        <h2 className={styles.sectionTitle}>Simple, welcoming, and ready to care for your smile</h2>
                        <p className={styles.bodyText}>
                            Dentime Dental Clinic is built around comfortable care, friendly service, and practical treatment
                            options that make dental visits feel more approachable for patients of all ages.
                        </p>
                        <div className={styles.buttonRow}>
                            <button className={styles.secondaryBtn} onClick={() => navigate('/about')} type="button">
                                Learn More
                            </button>
                        </div>
                    </article>

                    <div className={styles.bannerPlaceholder}>
                        <span className={styles.placeholderLabel}>Clinic Lifestyle Image Placeholder</span>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <p className={styles.eyebrow}>What We Do</p>
                    <h2 className={styles.sectionTitle}>Care designed for real smile needs</h2>
                </div>
                <div className={styles.gridFour}>
                    {serviceHighlights.map((service) => (
                        <article key={service.category} className={styles.serviceCard}>
                            <div className={styles.squarePlaceholder}>
                                <span className={styles.placeholderLabel}>{service.category} Image Placeholder</span>
                            </div>
                            <span className={styles.serviceTag}>{service.category}</span>
                            <h3 className={styles.cardTitle}>{service.category}</h3>
                            <p>{service.description}</p>
                        </article>
                    ))}
                </div>
            </section>
        </WebsiteShell>
    );
}
