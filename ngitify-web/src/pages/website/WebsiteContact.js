import React from 'react';
import { useNavigate } from 'react-router-dom';
import WebsiteShell from '../../components/website/WebsiteShell';
import styles from '../../styles/website/WebsitePages.module.css';
import { usePublicClinicConfig } from '../../hooks/usePublicClinicConfig';

export default function WebsiteContact() {
    const navigate = useNavigate();
    const { clinicInfo, locationCards, websiteContent } = usePublicClinicConfig();
    const contactContent = websiteContent.contactPage;
    const media = websiteContent.media;
    const primaryLocation = locationCards[0] || { name: 'Dentime Branch', status: 'Now Open', address: clinicInfo.address || '' };
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(primaryLocation.address)}`;

    return (
        <WebsiteShell>
            <section className={`${styles.section} ${styles.pageHeroSection}`}>
                <div className={styles.splitSection}>
                    <article className={`${styles.infoCard} ${styles.pageHeroCard}`}>
                        <p className={styles.eyebrow}>{contactContent.eyebrow}</p>
                        <h1 className={styles.sectionTitle}>{contactContent.title}</h1>
                        <p className={styles.bodyText}>{contactContent.description}</p>
                        <div className={styles.buttonRow}>
                            <button className={styles.primaryBtn} onClick={() => navigate('/appointment')} type="button">
                                {contactContent.primaryCtaLabel}
                            </button>
                            <a href={`tel:${clinicInfo.contactNumber}`} className={styles.secondaryBtn}>
                                {contactContent.secondaryCtaLabel}
                            </a>
                        </div>
                    </article>

                    <div className={`${styles.portraitPlaceholder} ${styles.pageHeroMedia}`}>
                        <img src={media.contactHeroImageUrl} alt={`${clinicInfo.name} contact`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.gridThree}>
                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <img src={media.contactPhoneImageUrl} alt="Phone contact" className={styles.placeholderImage} />
                        </div>
                        <h2 className={styles.cardTitle}>{contactContent.phoneCardTitle}</h2>
                        <span className={styles.contactValue}>{clinicInfo.contactNumber}</span>
                        <a href={`tel:${clinicInfo.contactNumber}`} className={styles.socialBtn}>
                            {contactContent.phoneCardCtaLabel}
                        </a>
                    </article>

                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <img src={media.contactFacebookImageUrl} alt="Facebook contact" className={styles.placeholderImage} />
                        </div>
                        <h2 className={styles.cardTitle}>{contactContent.facebookCardTitle}</h2>
                        <p>{clinicInfo.facebookName}</p>
                        <a
                            href={clinicInfo.facebookUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.socialBtn}
                        >
                            {contactContent.facebookCardCtaLabel}
                        </a>
                    </article>

                    <article className={styles.contactCard}>
                        <div className={styles.squarePlaceholder}>
                            <img src={media.contactInstagramImageUrl} alt="Instagram contact" className={styles.placeholderImage} />
                        </div>
                        <h2 className={styles.cardTitle}>{contactContent.instagramCardTitle}</h2>
                        <span className={styles.contactValue}>@{clinicInfo.instagramHandle}</span>
                        <a
                            href={`https://www.instagram.com/${clinicInfo.instagramHandle}/`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.socialBtn}
                        >
                            {contactContent.instagramCardCtaLabel}
                        </a>
                    </article>
                </div>
            </section>

            <section className={styles.section}>
                <div className={styles.splitSection}>
                    <article className={styles.locationCard}>
                        <span className={styles.statusPill}>{primaryLocation.status}</span>
                        <h3 className={styles.cardTitle}>{primaryLocation.name}</h3>
                        <p>{primaryLocation.address}</p>
                        <div className={styles.contactActionRow}>
                            <a href={mapUrl} target="_blank" rel="noreferrer" className={styles.primaryBtn}>
                                {contactContent.locationPrimaryCtaLabel}
                            </a>
                            <button className={styles.secondaryBtn} onClick={() => navigate('/about#locations')} type="button">
                                {contactContent.locationSecondaryCtaLabel}
                            </button>
                        </div>
                    </article>

                    <div className={styles.bannerPlaceholder}>
                        <img src={media.contactMapImageUrl} alt={`${primaryLocation.name} map or clinic front`} className={styles.placeholderImage} />
                    </div>
                </div>
            </section>
        </WebsiteShell>
    );
}
