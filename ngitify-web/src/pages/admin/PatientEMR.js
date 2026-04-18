import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/admin/PatientEMR.module.css';

const TABS = ['Treatment Notes', 'Odontogram', 'Patient History', 'Radiograph Images'];

const PatientEMR = () => {
    const { patientId } = useParams();
    const { authFetch } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('Treatment Notes');
    const [patient, setPatient] = useState(null);
    const [treatmentNotes, setTreatmentNotes] = useState([]);
    const [patientHistory, setPatientHistory] = useState(null);
    const [radiographs, setRadiographs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [uploadNote, setUploadNote] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState('');

    // Fetch patient info
    const fetchPatient = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}`);
            if (res.ok) setPatient(await res.json());
        } catch (e) { console.error('Error fetching patient:', e); }
    }, [authFetch, patientId]);

    // Fetch treatment notes (surgeries/appointments for this patient)
    const fetchTreatmentNotes = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}/treatments`);
            if (res.ok) setTreatmentNotes(await res.json());
        } catch (e) { console.error('Error fetching treatment notes:', e); }
    }, [authFetch, patientId]);

    // Fetch patient history
    const fetchPatientHistory = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}/history`);
            if (res.ok) setPatientHistory(await res.json());
        } catch (e) { console.error('Error fetching history:', e); }
    }, [authFetch, patientId]);

    // Fetch radiographs
    const fetchRadiographs = useCallback(async () => {
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs`);
            if (res.ok) setRadiographs(await res.json());
        } catch (e) { console.error('Error fetching radiographs:', e); }
    }, [authFetch, patientId]);

    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            setError('');
            await Promise.all([fetchPatient(), fetchTreatmentNotes(), fetchPatientHistory(), fetchRadiographs()]);
            setIsLoading(false);
        };
        loadAll();
    }, [fetchPatient, fetchTreatmentNotes, fetchPatientHistory, fetchRadiographs]);

    // Radiograph upload handler
    const handleRadiographUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        setUploadSuccess('');
        setError('');

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const res = await authFetch(`/patients/${patientId}/radiographs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: reader.result, notes: uploadNote })
                });
                if (res.ok) {
                    setUploadSuccess('Radiograph uploaded successfully.');
                    setUploadNote('');
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

    // Delete radiograph
    const handleDeleteRadiograph = async (imageId) => {
        if (!window.confirm('Delete this radiograph image?')) return;
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs/${imageId}`, { method: 'DELETE' });
            if (res.ok) fetchRadiographs();
            else setError('Failed to delete radiograph.');
        } catch (e) {
            setError('Network error during delete.');
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

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
                            <span>{patient?.phone || 'No phone'}</span>
                            <span className={styles.metaDot}>·</span>
                            <span>DOB: {formatDate(patient?.dateOfBirth)}</span>
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
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
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
                                        <div className={styles.noteDate}>{formatDate(note.date || note.createdAt)}</div>
                                        <div className={styles.noteProcedure}>
                                            <strong>{note.procedure || note.title || 'Treatment'}</strong>
                                        </div>
                                        {note.dentist && (
                                            <div className={styles.noteDentist}>
                                                Dr. {note.dentist?.name?.first} {note.dentist?.name?.last}
                                            </div>
                                        )}
                                        {note.branch && <div className={styles.noteBranch}>Branch: {note.branch}</div>}
                                        {note.notes && <p className={styles.noteText}>{note.notes}</p>}
                                        <div className={styles.noteStatus}>
                                            <span className={styles[`status_${(note.status || 'pending').replace(/\s/g, '_')}`]}>
                                                {note.status || 'Pending'}
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
                                Tooth chart display — detailed odontogram managed by the dentist's EMR.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── PATIENT HISTORY ── */}
                {activeTab === 'Patient History' && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Patient History</h3>
                        <div className={styles.historyGrid}>
                            <div className={styles.historyCard}>
                                <h4>Medical History</h4>
                                <p>{patientHistory?.medicalHistory || patient?.medicalHistory || 'No medical history recorded.'}</p>
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Allergies</h4>
                                {(patientHistory?.allergies || patient?.allergies || []).length > 0 ? (
                                    <ul>
                                        {(patientHistory?.allergies || patient?.allergies).map((a, i) => (
                                            <li key={i}>{a}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>No known allergies.</p>
                                )}
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Emergency Contact</h4>
                                {patient?.emergencyContact?.name ? (
                                    <>
                                        <p><strong>{patient.emergencyContact.name}</strong></p>
                                        <p>{patient.emergencyContact.relationship}</p>
                                        <p>{patient.emergencyContact.phone}</p>
                                    </>
                                ) : (
                                    <p>No emergency contact on file.</p>
                                )}
                            </div>
                            <div className={styles.historyCard}>
                                <h4>Personal Info</h4>
                                <p><strong>Gender:</strong> {patient?.gender || '—'}</p>
                                <p><strong>Address:</strong> {patient?.address || '—'}</p>
                                <p><strong>Date of Birth:</strong> {formatDate(patient?.dateOfBirth)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RADIOGRAPH IMAGES ── */}
                {activeTab === 'Radiograph Images' && (
                    <div className={styles.section}>
                        <div className={styles.radiographHeader}>
                            <h3 className={styles.sectionTitle}>Radiograph Images</h3>
                            <div className={styles.uploadArea}>
                                <input
                                    type="text"
                                    placeholder="Image note (optional)"
                                    value={uploadNote}
                                    onChange={e => setUploadNote(e.target.value)}
                                    className={styles.uploadNoteInput}
                                    disabled={isUploading}
                                />
                                <label className={styles.uploadBtn}>
                                    {isUploading ? 'Uploading...' : '+ Upload Radiograph'}
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
                                    Upload X-rays or other dental images above.
                                </p>
                            </div>
                        ) : (
                            <div className={styles.radiographGallery}>
                                {radiographs.map((r, i) => (
                                    <div key={r._id || i} className={styles.radiographCard}>
                                        <div className={styles.radiographImageWrapper}>
                                            <img
                                                src={r.imageUrl}
                                                alt={r.notes || `Radiograph ${i + 1}`}
                                                className={styles.radiographImage}
                                            />
                                        </div>
                                        <div className={styles.radiographMeta}>
                                            <p className={styles.radiographNote}>{r.notes || 'No note'}</p>
                                            <p className={styles.radiographDate}>{formatDate(r.uploadedAt || r.createdAt)}</p>
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