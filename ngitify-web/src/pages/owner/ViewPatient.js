import React, { useState, useEffect, useCallback } from 'react';
import { FaEdit } from 'react-icons/fa';
import formStyles from '../../styles/owner/AddPatient.module.css';
import styles from '../../styles/owner/ViewPatient.module.css';
import { regions, provinces, cities } from '../../utils/addressData';
import BackIcon from '../../assets/icons/Back.svg';

function resolveRegionName(code) {
    if (!code) return '—';
    return regions.find((r) => r.code === code)?.name || code;
}

function resolveProvinceName(regionCode, provCode) {
    if (!provCode) return '—';
    const list = provinces[regionCode] || [];
    return list.find((p) => p.code === provCode)?.name || provCode;
}

function resolveCityName(provCode, cityCode) {
    if (!cityCode) return '—';
    const list = cities[provCode] || [];
    return list.find((c) => c.code === cityCode)?.name || cityCode;
}

function formatDisplayDate(isoOrDate) {
    if (!isoOrDate) return '—';
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPhoneDisplay(raw) {
    if (!raw) return '—';
    const s = String(raw).trim();
    if (s.startsWith('+63')) return s;
    if (/^\d{10}$/.test(s.replace(/\s/g, ''))) return `+63${s.replace(/\s/g, '')}`;
    return s;
}

function getAgeFromBirth(birth) {
    if (!birth) return null;
    const today = new Date();
    const b = new Date(birth);
    if (Number.isNaN(b.getTime())) return null;
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return age;
}

function getFullNameParts(data) {
    if (!data) return { fullName: '—' };
    const fName = data.name?.first || data.firstName || '';
    const mName = data.name?.middle || data.middleName || '';
    const lName = data.name?.last || data.lastName || '';
    const fullName = [fName, mName, lName].filter(Boolean).join(' ') || data.email || '—';
    return { fullName };
}

function getBirthRaw(data) {
    return data?.birthdate || data?.dob || data?.dateOfBirth;
}

function getStatusLabel(data) {
    if (!data) return '—';
    return data.status === 'active'
        ? 'Active'
        : data.status === 'inactive'
          ? 'Inactive'
          : data.status || '—';
}

export default function ViewPatient({ patientId, onClose, onEdit }) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState(null);

    const fetchUser = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/user/${patientId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                alert('Failed to load user data.');
                onClose();
                return;
            }
            setData(await response.json());
        } catch (e) {
            console.error(e);
            alert('Cannot connect to server.');
            onClose();
        } finally {
            setIsLoading(false);
        }
    }, [patientId, onClose]);

    useEffect(() => {
        if (patientId) fetchUser();
    }, [patientId, fetchUser]);

    const { fullName } = getFullNameParts(data);
    const birthRaw = getBirthRaw(data);
    const statusLabel = getStatusLabel(data);
    const age = getAgeFromBirth(birthRaw);
    const isMinor = data != null && age !== null && age < 18;

    const renderAddress = (title, addr) => {
        if (!addr || typeof addr !== 'object') {
            return (
                <div className={formStyles.addressSection}>
                    <h3 className={formStyles.sectionTitle}>{title}</h3>
                    <p className={styles.viewValueMuted}>No address on file.</p>
                </div>
            );
        }
        const regionName = resolveRegionName(addr.region);
        const provinceName = resolveProvinceName(addr.region, addr.province);
        const cityName = resolveCityName(addr.province, addr.city);
        return (
            <div className={formStyles.addressSection}>
                <h3 className={formStyles.sectionTitle}>{title}</h3>
                <div className={styles.viewRow}>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>REGION</div>
                        <div className={styles.viewValue}>{regionName}</div>
                    </div>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>PROVINCE</div>
                        <div className={styles.viewValue}>{provinceName}</div>
                    </div>
                </div>
                <div className={styles.viewRow}>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>CITY / MUNICIPALITY</div>
                        <div className={styles.viewValue}>{cityName}</div>
                    </div>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>BARANGAY</div>
                        <div className={styles.viewValue}>{addr.barangay || '—'}</div>
                    </div>
                </div>
                <div className={styles.viewRow}>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>STREET</div>
                        <div className={styles.viewValue}>{addr.street || '—'}</div>
                    </div>
                    <div className={styles.viewField}>
                        <div className={styles.viewLabel}>HOUSE NO.</div>
                        <div className={styles.viewValue}>{addr.houseNumber || '—'}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={formStyles.mainOverlay}>
            <div className={formStyles.overlayBackground} onClick={onClose} />
            <div className={formStyles.formCard}>
                {isLoading ? (
                    <div className={styles.loadingState}>Loading profile...</div>
                ) : !data ? null : (
                    <>
                        <div className={formStyles.headerWrapper}>
                            <button className={formStyles.backIconButton} onClick={onClose} type="button">
                                <img src={BackIcon} alt="Back" />
                            </button>
                            <div className={formStyles.header}>
                                <h2>
                                    View <span className={formStyles.highlight}>Patient</span> Profile
                                </h2>
                                <p>This patient&apos;s records (read-only).</p>
                            </div>
                        </div>

                        <div className={formStyles.uploadSection}>
                            <div className={formStyles.imageWrapper} style={{ cursor: 'default' }}>
                                {data.profileImage ? (
                                    <img
                                        src={data.profileImage}
                                        alt={fullName}
                                        className={formStyles.previewImage}
                                    />
                                ) : (
                                    <div className={formStyles.uploadPlaceholder}>
                                        <span>No photo</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <h3 className={formStyles.mainSectionTitle}>Personal information</h3>
                        <div className={styles.viewRow}>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>FULL NAME</div>
                                <div className={styles.viewValue}>{fullName}</div>
                            </div>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>EMAIL</div>
                                <div className={styles.viewValue}>{data.email || '—'}</div>
                            </div>
                        </div>
                        <div className={styles.viewRow}>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>PHONE</div>
                                <div className={styles.viewValue}>
                                    {formatPhoneDisplay(data.contactNumber || data.phoneNumber)}
                                </div>
                            </div>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>DATE OF BIRTH</div>
                                <div className={styles.viewValue}>{formatDisplayDate(birthRaw)}</div>
                            </div>
                        </div>
                        <div className={styles.viewRow}>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>EMAIL VERIFIED</div>
                                <div className={styles.viewValue}>
                                    <span
                                        className={`${styles.statusBadge} ${
                                            data.isVerified ? styles.verifiedYes : styles.verifiedNo
                                        }`}
                                    >
                                        {data.isVerified ? 'Yes' : 'No'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.viewField}>
                                <div className={styles.viewLabel}>ACCOUNT STATUS</div>
                                <div className={styles.viewValue}>
                                    <span className={styles.accountStatus}>
                                        <span
                                            className={`${styles.dot} ${
                                                data.status === 'active' ? styles.dotActive : styles.dotInactive
                                            }`}
                                        />
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {isMinor && (
                            <>
                                <hr className={formStyles.divider} />
                                <h3 className={formStyles.mainSectionTitle}>Guardian information</h3>
                                {data.guardian ? (
                                    <>
                                        <div className={styles.viewRow}>
                                            <div className={styles.viewField}>
                                                <div className={styles.viewLabel}>GUARDIAN NAME</div>
                                                <div className={styles.viewValue}>{data.guardian.name || '—'}</div>
                                            </div>
                                            <div className={styles.viewField}>
                                                <div className={styles.viewLabel}>RELATIONSHIP</div>
                                                <div className={styles.viewValue}>
                                                    {data.guardian.relationship || '—'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.viewRow}>
                                            <div className={styles.viewField}>
                                                <div className={styles.viewLabel}>GUARDIAN PHONE</div>
                                                <div className={styles.viewValue}>
                                                    {formatPhoneDisplay(data.guardian.contactNumber)}
                                                </div>
                                            </div>
                                            <div className={styles.viewField} />
                                        </div>
                                    </>
                                ) : (
                                    <p className={styles.viewValueMuted}>No guardian on file.</p>
                                )}
                            </>
                        )}

                        <hr className={formStyles.divider} />
                        {renderAddress('Current address', data.currentAddress)}
                        {renderAddress('Permanent address', data.permanentAddress)}

                        <div className={styles.footer}>
                            <button type="button" className={styles.closeBtn} onClick={onClose}>
                                Close
                            </button>
                            <button type="button" className={styles.editBtn} onClick={onEdit}>
                                <FaEdit aria-hidden />
                                Edit
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
