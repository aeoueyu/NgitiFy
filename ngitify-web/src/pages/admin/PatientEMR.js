import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/PatientEMR.module.css';

const TABS = ['Treatment Notes', 'Odontogram', 'Patient History', 'Radiograph Images'];

const PatientEMR = () => {
    const { patientId } = useParams();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('Treatment Notes');
    const [patient, setPatient] = useState(null);
    const [treatmentNotes, setTreatmentNotes] = useState([]);
    const [radiographs, setRadiographs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    // Radiograph upload state
    const [uploadLabel, setUploadLabel] = useState('');
    const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
    const [uploadNotes, setUploadNotes] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState('');

    // ✅ FIX 1: Correct endpoint /treatment-logs (was /treatments — that doesn't exist)
    const fetchTreatmentNotes = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}/treatment-logs`);
            if (res.ok) setTreatmentNotes(await res.json());
        } catch (e) { console.error('Error fetching treatment notes:', e); }
    }, [patientId]);

    // ✅ FIX 2: No separate /history endpoint. Patient data already contains all history fields.
    const fetchPatient = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}`);
            if (res.ok) setPatient(await res.json());
        } catch (e) { console.error('Error fetching patient:', e); }
    }, [patientId]);

    const fetchRadiographs = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs`);
            if (res.ok) setRadiographs(await res.json());
        } catch (e) { console.error('Error fetching radiographs:', e); }
    }, [patientId]);

    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            setError('');
            await Promise.all([fetchPatient(), fetchTreatmentNotes(), fetchRadiographs()]);
            setIsLoading(false);
        };
        loadAll();
    }, [fetchPatient, fetchTreatmentNotes, fetchRadiographs]);

    // ✅ FIX 3: Server requires { label, date } — previously only sent { imageUrl, notes }
    const handleRadiographUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!uploadLabel.trim()) {
            setError('Please enter a label before uploading.');
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        setUploadSuccess('');
        setError('');

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const res = await authFetch(`/patients/${patientId}/radiographs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label: uploadLabel,
                        date: uploadDate,
                        url: reader.result,    // ✅ FIX 4: server field is `url`, not `imageUrl`
                        notes: uploadNotes
                    })
                });
                if (res.ok) {
                    setUploadSuccess('Radiograph uploaded successfully.');
                    setUploadLabel('');
                    setUploadNotes('');
                    setUploadDate(new Date().toISOString().split('T')[0]);
                    fetchRadiographs();
                } else {
                    const d = await res.json();
                    setError(d.message || 'Upload failed.');
                }
            } catch (err) {
                setError('Network error during upload.');
            } finally {
                setIsUploading(false);
                e.target.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteRadiograph = async (entryId) => {
        if (!window.confirm('Delete this radiograph image?')) return;
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs/${entryId}`, { method: 'DELETE' });
            if (res.ok) fetchRadiographs();
            else setError('Failed to delete radiograph.');
        } catch (e) {
            setError('Network error during delete.');
        }
    };

    const formatDate = (d) => d
        ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';

    if (isLoading) {
        return (
            <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <p>Loading patient EMR...</p>
            </div>
        );
    }

    return (
        <div className={styles.emrContainer}>
            {/* Header */}
            <div className={styles.emrHeader}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>← Back to Patients</button>
                <div className={styles.patientInfo}>
                    <div className={styles.patientAvatar}>
                        {patient?.name?.first?.[0]}{patient?.name?.last?.[0]}
                    </div>
                    <div>
                        <h1 className={styles.patientName}>
                            {patient?.name?.first} {patient?.name?.last}
                        </h1>
                        <div className={styles.patientMeta}>
                            <span>{patient?.email}</span>
                            <span className={styles.metaDot}>·</span>
                            <span>{patient?.contactNumber || 'No phone'}</span>
                            <span className={styles.metaDot}>·</span>
                            <span>DOB: {formatDate(patient?.birthdate)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className={styles.errorBanner}>{error}</div>}

            {/* Tabs */}
            <div className={styles.tabBar}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className={`${styles.tabBtn} ${activeTab === tab ? styles.tabActive : ''}`}
                        onClick={() => { setActiveTab(tab); setError(''); setUploadSuccess(''); }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className={styles.tabContent}>

                {/* ── TREATMENT NOTES ── */}
                {activeTab === 'Treatment Notes' && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Treatment Notes</h3>
                        {treatmentNotes.length === 0 ? (
                            <p className={styles.emptyText}>No treatment notes recorded yet.</p>
                        ) : (
                            <div className={styles.notesList}>
                                {treatmentNotes.map((note, i) => (
                                    <div key={note._id || i} className={styles.noteCard}>
                                        <div className={styles.noteDate}>{formatDate(note.date)}</div>
                                        <div className={styles.noteProcedure}>
                                            <strong>{note.procedure || 'Treatment'}</strong>
                                            {note.tooth && <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px' }}>Tooth {note.tooth}</span>}
                                        </div>
                                        {note.dentistName && (
                                            <div className={styles.noteDentist}>{note.dentistName}</div>
                                        )}
                                        {note.branch && <div className={styles.noteBranch}>Branch: {note.branch}</div>}
                                        {note.notes && <p className={styles.noteText}>{note.notes}</p>}
                                        <div className={styles.noteStatus}>
                                            <span className={styles[`status_${(note.category || 'Other').replace(/\s/g, '_')}`]}>
                                                {note.category || 'Other'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ODONTOGRAM ── */}
                {activeTab === 'Odontogram' && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Odontogram</h3>
                        <div className={styles.odontogramPlaceholder}>
                            <div className={styles.odontogramGrid}>
                                <div className={styles.quadrantLabel}>Upper Right</div>
                                <div className={styles.quadrantLabel}>Upper Left</div>
                                {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(tooth => (
                                    <div key={tooth} className={styles.toothBox} title={`Tooth ${tooth}`}>
                                        <span className={styles.toothNum}>{tooth}</span>
                                    </div>
                                ))}
                                <div className={styles.quadrantDivider}></div>
                                {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(tooth => (
                                    <div key={tooth} className={styles.toothBox} title={`Tooth ${tooth}`}>
                                        <span className={styles.toothNum}>{tooth}</span>
                                    </div>
                                ))}
                                <div className={styles.quadrantLabel}>Lower Right</div>
                                <div className={styles.quadrantLabel}>Lower Left</div>
                            </div>
                            <p className={styles.odontogramNote}>
                                Read-only view — detailed odontogram is managed by the dentist's EMR.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── PATIENT HISTORY ── */}
                {/* ✅ FIX 2: Uses `patient` state from GET /patients/:id — no separate /history endpoint */}
                {activeTab === 'Patient History' && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Patient History</h3>
                        <div className={styles.historyGrid}>
                            <div className={styles.historyCard}>
                                <h4>Medical History</h4>
                                <p>{patient?.medicalHistory?.conditions?.join(', ') || 'No medical conditions recorded.'}</p>
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Allergies</h4>
                                {(patient?.medicalHistory?.allergies || []).length > 0 ? (
                                    <ul>
                                        {patient.medicalHistory.allergies.map((a, i) => <li key={i}>{a}</li>)}
                                    </ul>
                                ) : <p>No known allergies.</p>}
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Personal Info</h4>
                                <p><strong>Gender:</strong> {patient?.gender || '—'}</p>
                                <p><strong>Date of Birth:</strong> {formatDate(patient?.birthdate)}</p>
                                <p><strong>Contact:</strong> {patient?.contactNumber || '—'}</p>
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Address</h4>
                                {patient?.currentAddress ? (
                                    <>
                                        <p>{patient.currentAddress.houseNumber} {patient.currentAddress.street}</p>
                                        <p>{patient.currentAddress.barangay}, {patient.currentAddress.city}</p>
                                        <p>{patient.currentAddress.province}, {patient.currentAddress.region}</p>
                                    </>
                                ) : <p>No address on file.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RADIOGRAPH IMAGES ── */}
                {activeTab === 'Radiograph Images' && (
                    <div className={styles.section}>
                        <div className={styles.radiographHeader}>
                            <h3 className={styles.sectionTitle}>Radiograph Images</h3>
                            {/* ✅ FIX 3 & 4: Upload form now includes required label + date fields */}
                            <div className={styles.uploadArea}>
                                <input
                                    type="text"
                                    placeholder="Label (e.g. Periapical X-ray) *"
                                    value={uploadLabel}
                                    onChange={e => setUploadLabel(e.target.value)}
                                    className={styles.uploadNoteInput}
                                    disabled={isUploading}
                                    style={{ width: '220px' }}
                                />
                                <input
                                    type="date"
                                    value={uploadDate}
                                    onChange={e => setUploadDate(e.target.value)}
                                    className={styles.uploadNoteInput}
                                    disabled={isUploading}
                                    style={{ width: '150px' }}
                                />
                                <input
                                    type="text"
                                    placeholder="Notes (optional)"
                                    value={uploadNotes}
                                    onChange={e => setUploadNotes(e.target.value)}
                                    className={styles.uploadNoteInput}
                                    disabled={isUploading}
                                    style={{ width: '180px' }}
                                />
                                <label className={styles.uploadBtn}>
                                    {isUploading ? 'Uploading...' : '+ Upload'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleRadiographUpload}
                                        disabled={isUploading}
                                    />
                                </label>
                            </div>
                        </div>

                        {uploadSuccess && <div className={styles.successBanner}>{uploadSuccess}</div>}

                        {radiographs.length === 0 ? (
                            <div className={styles.emptyRadiograph}>
                                <p>No radiograph images uploaded yet.</p>
                                <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                                    Enter a label and date above, then upload an X-ray or dental image.
                                </p>
                            </div>
                        ) : (
                            <div className={styles.radiographGallery}>
                                {radiographs.map((r, i) => (
                                    <div key={r._id || i} className={styles.radiographCard}>
                                        <div className={styles.radiographImageWrapper}>
                                            {/* ✅ FIX 4: server stores as `url`, not `imageUrl` */}
                                            <img
                                                src={r.url}
                                                alt={r.label || `Radiograph ${i + 1}`}
                                                className={styles.radiographImage}
                                            />
                                        </div>
                                        <div className={styles.radiographMeta}>
                                            <p className={styles.radiographNote}><strong>{r.label}</strong></p>
                                            {r.notes && <p className={styles.radiographNote} style={{ fontSize: '12px' }}>{r.notes}</p>}
                                            {/* ✅ FIX: server stores as `date`, not `uploadedAt` */}
                                            <p className={styles.radiographDate}>{formatDate(r.date)}</p>
                                            <button
                                                className={styles.deleteRadiographBtn}
                                                onClick={() => handleDeleteRadiograph(r._id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientEMR;