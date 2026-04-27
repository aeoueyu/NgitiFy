import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistEMRList.module.css';
import { FaSearch, FaFileMedical, FaUserInjured, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../../components/common/UserAvatar';

const calculateAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
};

const normalizeName = (p) => {
    if (p.name?.first) return `${p.name.first} ${p.name.last || ''}`.trim();
    if (p.firstName)   return `${p.firstName} ${p.lastName || ''}`.trim();
    if (typeof p.name === 'string') return p.name;
    return 'Unknown Patient';
};

export default function DentistEMRList() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/patients?limit=200');
            if (!res.ok) throw new Error('Failed to load patients.');
            const data = await res.json();
            const raw = Array.isArray(data) ? data : (data.patients || []);
            setPatients(raw.map(p => ({
                id: p._id,
                name: normalizeName(p),
                email: p.email || '',
                phone: p.contactNumber || p.phone || '',
                sex: p.sex || p.gender || '',
                dob: p.dateOfBirth || p.dob || '',
                status: p.status || 'inactive',
                isVerified: p.isVerified,
                profileImage: p.profileImage || '',
                avatarUser: p,
            })));
        } catch (err) {
            console.error(err);
            addToast('Could not load patient list.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const filtered = patients.filter(p => {
        const q = searchQuery.toLowerCase();
        const matchSearch = !q ||
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.phone.includes(q);
        const matchStatus = statusFilter === 'All' || p.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const openEMR = (patientId) => navigate(`/dentist/patients/${patientId}/emr`);

    return (
        <main className={styles.pageWrapper}>

            {/* PAGE HEADER */}
            <header className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>
                        <FaFileMedical className={styles.pageTitleIcon} />
                        Patient EMR
                    </h1>
                    <p className={styles.pageSubtitle}>
                        Select a patient to view or edit their Electronic Medical Record.
                    </p>
                </div>
                <div className={styles.patientCount}>
                    <FaUserInjured className={styles.countIcon} />
                    <span>{patients.length} patient{patients.length !== 1 ? 's' : ''}</span>
                </div>
            </header>

            {/* FILTERS */}
            <div className={styles.filtersBar}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className={styles.filterGroup}>
                    {['All', 'active', 'inactive'].map(s => (
                        <button
                            key={s}
                            className={`${styles.filterPill} ${statusFilter === s ? styles.activePill : ''}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* PATIENT GRID */}
            {isLoading ? (
                <div className={styles.emptyState}>Loading patients...</div>
            ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                    <FaUserInjured style={{ fontSize: '40px', color: '#cbd5e1', marginBottom: '12px' }} />
                    <p>{patients.length === 0 ? 'No patients found in the system.' : 'No patients match your search.'}</p>
                </div>
            ) : (
                <div className={styles.patientGrid}>
                    {filtered.map(p => {
                        const age = calculateAge(p.dob);
                        return (
                            <div key={p.id} className={styles.patientCard}>
                                <div className={styles.cardTop}>
                                    <UserAvatar user={p.avatarUser} size={52} />
                                    <div className={styles.cardInfo}>
                                        <h3 className={styles.patientName}>{p.name}</h3>
                                        <div className={styles.metaRow}>
                                            {age !== null && (
                                                <span className={styles.metaTag}>
                                                    {age} yrs
                                                </span>
                                            )}
                                            {p.sex && (
                                                <span className={styles.metaTag}>
                                                    {p.sex}
                                                </span>
                                            )}
                                            <span className={`${styles.statusBadge} ${p.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                                                {p.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardContacts}>
                                    {p.email && (
                                        <p className={styles.contactRow}>
                                            <FaEnvelope className={styles.contactIcon} />
                                            <span>{p.email}</span>
                                        </p>
                                    )}
                                    {p.phone && (
                                        <p className={styles.contactRow}>
                                            <FaPhoneAlt className={styles.contactIcon} />
                                            <span>{p.phone}</span>
                                        </p>
                                    )}
                                </div>

                                <button
                                    className={styles.openEMRBtn}
                                    onClick={() => openEMR(p.id)}
                                >
                                    <FaFileMedical style={{ marginRight: '7px' }} />
                                    Open EMR
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </main>
    );
}