import React, { useState, useEffect, useCallback } from 'react';
import { FaTooth, FaSearch, FaUserInjured } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../../components/common/UserAvatar';
import Odontogram from './Odontogram';
import styles from '../../styles/dentist/Odontogram.module.css';

const normalizeName = (p) => {
    if (p.name?.first) return `${p.name.first} ${p.name.last || ''}`.trim();
    if (p.firstName)   return `${p.firstName} ${p.lastName || ''}`.trim();
    if (typeof p.name === 'string') return p.name;
    return 'Unknown Patient';
};

export default function DentistOdontogramPage() {
    const { addToast } = useToast();

    const [patients, setPatients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);

    // Support direct linking via ?patientId=xxx
    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/patients?limit=200');
            if (!res.ok) throw new Error('Failed to load patients.');
            const data = await res.json();
            const raw = Array.isArray(data) ? data : (data.patients || []);
            const normalized = raw.map(p => ({
                id: p._id,
                name: normalizeName(p),
                sex: p.sex || p.gender || '',
                profileImage: p.profileImage || '',
                raw: p,
            }));
            setPatients(normalized);

            // Auto-select if patientId is in URL — read once from searchParams,
            // NOT as a dependency so we don't loop on setSearchParams calls
            const urlPatientId = new URLSearchParams(window.location.search).get('patientId');
            if (urlPatientId) {
                const found = normalized.find(p => p.id === urlPatientId);
                if (found) setSelectedPatient(found);
            }
        } catch (err) {
            addToast('Could not load patient list.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]); // ← removed initialPatientId from deps to prevent infinite loop

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    const handleSelectPatient = (patient) => {
        setSelectedPatient(patient);
        window.history.replaceState({}, '', `?patientId=${patient.id}`);
    };

    const handleClearPatient = () => {
        setSelectedPatient(null);
        window.history.replaceState({}, '', window.location.pathname);
    };

    const filtered = patients.filter(p =>
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main className={styles.odontogramPageWrapper}>
            <header className={styles.odontogramPageHeader}>
                <div>
                    <h1 className={styles.odontogramPageTitle}>
                        <FaTooth style={{ marginRight: '10px', color: '#2dccf6' }} />
                        Digital Odontogram
                    </h1>
                    <p className={styles.odontogramPageSubtitle}>
                        {selectedPatient
                            ? `Viewing chart for ${selectedPatient.name}`
                            : 'Select a patient to view or update their dental chart.'}
                    </p>
                </div>
                {selectedPatient && (
                    <button className={styles.changePatientBtn} onClick={handleClearPatient}>
                        ← Change Patient
                    </button>
                )}
            </header>

            {!selectedPatient ? (
                /* ── PATIENT SELECTOR ── */
                <div className={styles.patientSelectorCard}>
                    <div className={styles.selectorSearchWrapper}>
                        <FaSearch className={styles.selectorSearchIcon} />
                        <input
                            type="text"
                            placeholder="Search patient by name..."
                            className={styles.selectorSearchInput}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {isLoading ? (
                        <div className={styles.selectorEmpty}>Loading patients...</div>
                    ) : filtered.length === 0 ? (
                        <div className={styles.selectorEmpty}>
                            <FaUserInjured style={{ fontSize: '32px', color: '#cbd5e1', marginBottom: '10px' }} />
                            <p>{patients.length === 0 ? 'No patients found.' : 'No patients match your search.'}</p>
                        </div>
                    ) : (
                        <div className={styles.selectorList}>
                            {filtered.map(p => (
                                <div
                                    key={p.id}
                                    className={styles.selectorItem}
                                    onClick={() => handleSelectPatient(p)}
                                >
                                    <UserAvatar user={p.raw} size={40} />
                                    <div className={styles.selectorItemInfo}>
                                        <span className={styles.selectorName}>{p.name}</span>
                                        {p.sex && <span className={styles.selectorMeta}>{p.sex}</span>}
                                    </div>
                                    <FaTooth className={styles.selectorChevron} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                /* ── ODONTOGRAM VIEWER ── */
                <div className={styles.odontogramViewCard}>
                    <div className={styles.selectedPatientBanner}>
                        <UserAvatar user={selectedPatient.raw} size={44} />
                        <div>
                            <p className={styles.selectedPatientName}>{selectedPatient.name}</p>
                            {selectedPatient.sex && (
                                <p className={styles.selectedPatientMeta}>{selectedPatient.sex}</p>
                            )}
                        </div>
                    </div>
                    <Odontogram patientId={selectedPatient.id} />
                </div>
            )}
        </main>
    );
}
