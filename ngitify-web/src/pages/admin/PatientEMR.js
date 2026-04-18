// ngitify-web/src/pages/admin/PatientEMR.js
// Admin's full-access EMR — connected to real backend APIs
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort, formatDateLong } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import styles from '../../styles/admin/PatientEMR.module.css';

import {
    FaArrowLeft, FaNotesMedical, FaSyringe, FaTooth, FaImage,
    FaPlus, FaTrash, FaSearch, FaUpload, FaSpinner, FaChevronDown, FaChevronUp
} from 'react-icons/fa';

const CATEGORIES = ['All', 'Restoration', 'Extraction', 'Prophylaxis', 'Orthodontics', 'Endodontics', 'Prosthodontics', 'Oral Surgery', 'Consultation', 'Other'];
const LOG_CATEGORIES = ['Restoration', 'Extraction', 'Prophylaxis', 'Orthodontics', 'Endodontics', 'Prosthodontics', 'Oral Surgery', 'Consultation', 'Other'];

export default function AdminPatientEMR() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const xrayInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Medical History
    const [medHistory, setMedHistory] = useState(null);
    const [isEditingMed, setIsEditingMed] = useState(false);
    const [medForm, setMedForm] = useState({});
    const [isSavingMed, setIsSavingMed] = useState(false);

    // Treatment Logs
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsSearch, setLogsSearch] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [newLog, setNewLog] = useState({ date: '', procedure: '', category: 'Restoration', tooth: '', notes: '', branch: '' });
    const [isSavingLog, setIsSavingLog] = useState(false);

    // Radiographs
    const [radiographs, setRadiographs] = useState([]);
    const [radLoading, setRadLoading] = useState(false);
    const [isSavingRad, setIsSavingRad] = useState(false);
    const [newRad, setNewRad] = useState({ label: '', date: '', notes: '', url: '' });
    const [isAddRadOpen, setIsAddRadOpen] = useState(false);
    const [selectedRad, setSelectedRad] = useState(null);

    // ─── Fetch patient data ───────────────────────────────────────────────────
    useEffect(() => {
        const fetch = async () => {
            try {
                setIsLoading(true);
                const res = await authFetch(`/patients/${patientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setPatient(data);
                    // Populate medical history form from patient data
                    const mh = {
                        allergies: (data.medicalHistory?.allergies || []).join(', '),
                        conditions: (data.medicalHistory?.conditions || []).join(', '),
                        medications: (data.medicalHistory?.medications || []).join(', '),
                        notes: data.medicalHistory?.notes || '',
                        bloodType: data.bloodType || '',
                        lastExam: data.dentalHistory?.lastExamDate ? data.dentalHistory.lastExamDate.split('T')[0] : ''
                    };
                    setMedHistory(mh);
                    setMedForm(mh);
                } else {
                    addToast('Failed to load patient data.', 'error');
                    navigate(-1);
                }
            } catch (e) {
                addToast('Cannot connect to server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        if (patientId) fetch();
    }, [patientId]); // eslint-disable-line

    // ─── Fetch treatment logs ─────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'logs') return;
        const fetchLogs = async () => {
            setLogsLoading(true);
            try {
                const res = await authFetch(`/patients/${patientId}/treatment-logs`);
                if (res.ok) setLogs(await res.json());
            } catch (e) { console.error(e); }
            finally { setLogsLoading(false); }
        };
        fetchLogs();
    }, [activeTab, patientId]);

    // ─── Fetch radiographs ────────────────────────────────────────────────────
    useEffect(() => {
        if (activeTab !== 'radiographs') return;
        const fetchRads = async () => {
            setRadLoading(true);
            try {
                const res = await authFetch(`/patients/${patientId}/radiographs`);
                if (res.ok) setRadiographs(await res.json());
            } catch (e) { console.error(e); }
            finally { setRadLoading(false); }
        };
        fetchRads();
    }, [activeTab, patientId]);

    // ─── Medical history save ─────────────────────────────────────────────────
    const handleSaveMedical = async (e) => {
        e.preventDefault();
        setIsSavingMed(true);
        try {
            const payload = {
                medicalHistory: {
                    allergies: medForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
                    conditions: medForm.conditions.split(',').map(s => s.trim()).filter(Boolean),
                    medications: medForm.medications.split(',').map(s => s.trim()).filter(Boolean),
                    notes: medForm.notes
                },
                bloodType: medForm.bloodType,
                dentalHistory: { lastExamDate: medForm.lastExam || null }
            };
            const res = await authFetch(`/patients/${patientId}`, { method: 'PUT', body: JSON.stringify(payload) });
            if (res.ok) {
                setMedHistory(medForm);
                setIsEditingMed(false);
                addToast('Medical history updated successfully.', 'success');
            } else {
                addToast('Failed to save medical history.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSavingMed(false);
        }
    };

    // ─── Add treatment log ────────────────────────────────────────────────────
    const handleAddLog = async (e) => {
        e.preventDefault();
        if (!newLog.date || !newLog.procedure) { addToast('Date and procedure are required.', 'error'); return; }
        setIsSavingLog(true);
        try {
            const res = await authFetch(`/patients/${patientId}/treatment-logs`, {
                method: 'POST',
                body: JSON.stringify(newLog)
            });
            if (res.ok) {
                const added = await res.json();
                setLogs(prev => [added, ...prev]);
                setNewLog({ date: '', procedure: '', category: 'Restoration', tooth: '', notes: '', branch: '' });
                setIsAddLogOpen(false);
                addToast('Treatment log added successfully.', 'success');
            } else {
                addToast('Failed to add treatment log.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSavingLog(false);
        }
    };

    // ─── Delete treatment log ─────────────────────────────────────────────────
    const handleDeleteLog = async (logId) => {
        if (!window.confirm('Are you sure you want to delete this treatment log?')) return;
        try {
            const res = await authFetch(`/patients/${patientId}/treatment-logs/${logId}`, { method: 'DELETE' });
            if (res.ok) {
                setLogs(prev => prev.filter(l => l._id !== logId));
                addToast('Treatment log deleted.', 'success');
            } else {
                addToast('Failed to delete log.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        }
    };

    // ─── Upload radiograph image ──────────────────────────────────────────────
    const handleRadImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setNewRad(prev => ({ ...prev, url: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleAddRadiograph = async (e) => {
        e.preventDefault();
        if (!newRad.label || !newRad.date) { addToast('Label and date are required.', 'error'); return; }
        setIsSavingRad(true);
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs`, {
                method: 'POST',
                body: JSON.stringify(newRad)
            });
            if (res.ok) {
                const added = await res.json();
                setRadiographs(prev => [added, ...prev]);
                setNewRad({ label: '', date: '', notes: '', url: '' });
                setIsAddRadOpen(false);
                addToast('Radiograph added successfully.', 'success');
            } else {
                addToast('Failed to add radiograph.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsSavingRad(false);
        }
    };

    const handleDeleteRadiograph = async (radId) => {
        if (!window.confirm('Are you sure you want to delete this radiograph?')) return;
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs/${radId}`, { method: 'DELETE' });
            if (res.ok) {
                setRadiographs(prev => prev.filter(r => r._id !== radId));
                if (selectedRad?._id === radId) setSelectedRad(null);
                addToast('Radiograph deleted.', 'success');
            } else {
                addToast('Failed to delete radiograph.', 'error');
            }
        } catch (e) {
            addToast('Cannot connect to server.', 'error');
        }
    };

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const renderTags = (csvStr, isWarning = false) => {
        if (!csvStr || csvStr.trim() === '') return <p className={styles.infoValue}>None reported.</p>;
        return (
            <div className={styles.tagList}>
                {csvStr.split(',').map(i => i.trim()).filter(Boolean).map((item, idx) => (
                    <span key={idx} className={`${styles.tag} ${isWarning ? styles.warning : ''}`}>{item}</span>
                ))}
            </div>
        );
    };

    const filteredLogs = logs.filter(log => {
        const matchSearch = log.procedure?.toLowerCase().includes(logsSearch.toLowerCase()) ||
                            log.dentistName?.toLowerCase().includes(logsSearch.toLowerCase()) ||
                            log.tooth?.toLowerCase().includes(logsSearch.toLowerCase());
        const matchCat = logsCategory === 'All' || log.category === logsCategory;
        return matchSearch && matchCat;
    });

    const patientName = patient ? `${patient.name?.first || ''} ${patient.name?.last || ''}`.trim() : 'Patient';

    if (isLoading) {
        return (
            <div className={styles.loadingWrapper}>
                <FaSpinner className={styles.spinner} />
                <p>Loading patient records...</p>
            </div>
        );
    }

    if (!patient) {
        return <div className={styles.errorWrapper}>Patient not found.</div>;
    }

    return (
        <div className={styles.emrContainer}>

            {/* ── Header ── */}
            <div className={styles.emrHeader}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                </button>
                <div className={styles.patientHeaderInfo}>
                    <UserAvatar user={{ name: patientName, profileImage: patient.profileImage }} size={54} />
                    <div>
                        <h1 className={styles.patientName}>{patientName}</h1>
                        <p className={styles.patientMeta}>
                            {patient.gender || 'N/A'} &bull;&nbsp;
                            {patient.birthdate ? `${Math.floor((new Date() - new Date(patient.birthdate)) / (365.25 * 24 * 60 * 60 * 1000))} yrs old` : 'Age N/A'} &bull;&nbsp;
                            {patient.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className={styles.tabBar}>
                {[
                    { key: 'overview', label: 'Medical History', icon: <FaNotesMedical /> },
                    { key: 'logs', label: 'Treatment Logs', icon: <FaSyringe /> },
                    { key: 'radiographs', label: 'Radiograph Images', icon: <FaImage /> },
                    { key: 'odontogram', label: 'Odontogram', icon: <FaTooth /> }
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tabBtn} ${activeTab === tab.key ? styles.activeTabBtn : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className={styles.tabContent}>

                {/* ── TAB: MEDICAL HISTORY ── */}
                {activeTab === 'overview' && medHistory && (
                    <div className={styles.contentCard}>
                        <div className={styles.cardHeader}>
                            <h3>Medical History & Alerts</h3>
                            {!isEditingMed && (
                                <button className={styles.actionBtn} onClick={() => setIsEditingMed(true)}>Edit Medical History</button>
                            )}
                        </div>

                        {isEditingMed ? (
                            <form onSubmit={handleSaveMedical}>
                                <div className={styles.infoGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Allergies <span style={{fontSize:'12px',color:'#94a3b8'}}>(comma separated)</span></label>
                                        <input className={styles.inputField} value={medForm.allergies} onChange={e => setMedForm(p => ({...p, allergies: e.target.value}))} placeholder="e.g. Penicillin, Latex" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Pre-existing Conditions</label>
                                        <input className={styles.inputField} value={medForm.conditions} onChange={e => setMedForm(p => ({...p, conditions: e.target.value}))} placeholder="e.g. Asthma, Diabetes" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Current Medications</label>
                                        <input className={styles.inputField} value={medForm.medications} onChange={e => setMedForm(p => ({...p, medications: e.target.value}))} placeholder="e.g. Albuterol" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Blood Type</label>
                                        <select className={styles.inputField} value={medForm.bloodType} onChange={e => setMedForm(p => ({...p, bloodType: e.target.value}))}>
                                            <option value="">Select</option>
                                            {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Last Dental Exam</label>
                                        <input type="date" className={styles.inputField} value={medForm.lastExam} onChange={e => setMedForm(p => ({...p, lastExam: e.target.value}))} />
                                    </div>
                                </div>
                                <div className={styles.formGroup} style={{marginTop: '10px'}}>
                                    <label>Clinical Notes</label>
                                    <textarea className={styles.textareaField} value={medForm.notes} onChange={e => setMedForm(p => ({...p, notes: e.target.value}))} placeholder="Special instructions or warnings..." rows={4} />
                                </div>
                                <div className={styles.formActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => { setMedForm(medHistory); setIsEditingMed(false); }} disabled={isSavingMed}>Cancel</button>
                                    <button type="submit" className={styles.saveBtn} disabled={isSavingMed}>{isSavingMed ? 'Saving...' : 'Save Updates'}</button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className={styles.alertBanner}>
                                    {medHistory.allergies && medHistory.allergies.trim() ? (
                                        <>⚠️ <strong>Allergies:</strong> {medHistory.allergies}</>
                                    ) : (
                                        <span style={{color: '#64748b'}}>No known allergies on record.</span>
                                    )}
                                </div>
                                <div className={styles.infoGrid} style={{marginTop: '20px'}}>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>Blood Type</span>
                                        <p className={styles.infoValue}>{medHistory.bloodType || 'Not recorded'}</p>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>Last Dental Exam</span>
                                        <p className={styles.infoValue}>{medHistory.lastExam ? formatDateShort(new Date(medHistory.lastExam)) : 'Not recorded'}</p>
                                    </div>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>Pre-existing Conditions</span>
                                        {renderTags(medHistory.conditions)}
                                    </div>
                                    <div className={styles.infoBox}>
                                        <span className={styles.infoLabel}>Current Medications</span>
                                        {renderTags(medHistory.medications)}
                                    </div>
                                </div>
                                {medHistory.notes && (
                                    <div className={styles.notesBox}>
                                        <span className={styles.infoLabel}>Clinical Notes</span>
                                        <p className={styles.notesText}>{medHistory.notes}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── TAB: TREATMENT LOGS ── */}
                {activeTab === 'logs' && (
                    <div className={styles.contentCard}>
                        <div className={styles.cardHeader}>
                            <h3>Treatment History</h3>
                            <button className={styles.actionBtn} onClick={() => setIsAddLogOpen(true)}>
                                <FaPlus /> Add Entry
                            </button>
                        </div>

                        {/* Add Log Form */}
                        {isAddLogOpen && (
                            <form onSubmit={handleAddLog} className={styles.addLogForm}>
                                <h4 style={{marginBottom: '15px', color: '#01538b'}}>New Treatment Entry</h4>
                                <div className={styles.infoGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Date <span style={{color:'red'}}>*</span></label>
                                        <input type="date" className={styles.inputField} value={newLog.date} onChange={e => setNewLog(p => ({...p, date: e.target.value}))} max={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Category</label>
                                        <select className={styles.inputField} value={newLog.category} onChange={e => setNewLog(p => ({...p, category: e.target.value}))}>
                                            {LOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Procedure <span style={{color:'red'}}>*</span></label>
                                        <input className={styles.inputField} value={newLog.procedure} onChange={e => setNewLog(p => ({...p, procedure: e.target.value}))} placeholder="e.g. Composite Filling" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Tooth / Area</label>
                                        <input className={styles.inputField} value={newLog.tooth} onChange={e => setNewLog(p => ({...p, tooth: e.target.value}))} placeholder="e.g. 45, All" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Branch</label>
                                        <input className={styles.inputField} value={newLog.branch} onChange={e => setNewLog(p => ({...p, branch: e.target.value}))} placeholder="e.g. Marikina Branch" />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Notes</label>
                                    <textarea className={styles.textareaField} value={newLog.notes} onChange={e => setNewLog(p => ({...p, notes: e.target.value}))} rows={3} placeholder="Procedure notes..." />
                                </div>
                                <div className={styles.formActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setIsAddLogOpen(false)} disabled={isSavingLog}>Cancel</button>
                                    <button type="submit" className={styles.saveBtn} disabled={isSavingLog}>{isSavingLog ? 'Saving...' : 'Save Entry'}</button>
                                </div>
                            </form>
                        )}

                        {/* Filters */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                            <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                                <FaSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    className={styles.inputField}
                                    style={{ paddingLeft: '32px' }}
                                    placeholder="Search logs..."
                                    value={logsSearch}
                                    onChange={e => setLogsSearch(e.target.value)}
                                />
                            </div>
                            <select className={styles.inputField} style={{width: '180px'}} value={logsCategory} onChange={e => setLogsCategory(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {logsLoading ? (
                            <p style={{color:'#64748b', textAlign:'center', padding:'30px'}}>Loading treatment logs...</p>
                        ) : filteredLogs.length === 0 ? (
                            <p style={{color:'#64748b', textAlign:'center', padding:'30px'}}>No treatment logs found.</p>
                        ) : (
                            filteredLogs.map(log => (
                                <div key={log._id} className={styles.logCard}>
                                    <div className={styles.logHeader} onClick={() => setExpandedLogs(p => ({...p, [log._id]: !p[log._id]}))}>
                                        <div>
                                            <span className={styles.logProcedure}>{log.procedure}</span>
                                            <span className={styles.logMeta}>{log.category} &bull; Tooth: {log.tooth || 'N/A'} &bull; {log.branch || 'N/A'}</span>
                                        </div>
                                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                            <span className={styles.logDate}>{log.date ? formatDateShort(new Date(log.date)) : 'N/A'}</span>
                                            <button className={styles.iconBtnSm} onClick={(e) => { e.stopPropagation(); handleDeleteLog(log._id); }} title="Delete log"><FaTrash /></button>
                                            {expandedLogs[log._id] ? <FaChevronUp /> : <FaChevronDown />}
                                        </div>
                                    </div>
                                    {expandedLogs[log._id] && (
                                        <div className={styles.logBody}>
                                            <p><strong>Dentist:</strong> {log.dentistName || 'Not recorded'}</p>
                                            <p><strong>Notes:</strong> {log.notes || 'No notes.'}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* ── TAB: RADIOGRAPH IMAGES ── */}
                {activeTab === 'radiographs' && (
                    <div className={styles.contentCard}>
                        <div className={styles.cardHeader}>
                            <h3>Radiograph Images</h3>
                            <button className={styles.actionBtn} onClick={() => setIsAddRadOpen(true)}>
                                <FaUpload /> Upload X-Ray
                            </button>
                        </div>

                        {isAddRadOpen && (
                            <form onSubmit={handleAddRadiograph} className={styles.addLogForm}>
                                <h4 style={{marginBottom: '15px', color: '#01538b'}}>Upload New Radiograph</h4>
                                <div className={styles.infoGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Label <span style={{color:'red'}}>*</span></label>
                                        <input className={styles.inputField} value={newRad.label} onChange={e => setNewRad(p => ({...p, label: e.target.value}))} placeholder="e.g. Panoramic X-Ray" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Date Taken <span style={{color:'red'}}>*</span></label>
                                        <input type="date" className={styles.inputField} value={newRad.date} onChange={e => setNewRad(p => ({...p, date: e.target.value}))} max={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Notes</label>
                                        <input className={styles.inputField} value={newRad.notes} onChange={e => setNewRad(p => ({...p, notes: e.target.value}))} placeholder="Optional notes" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Image File</label>
                                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                            <input type="file" accept="image/*" ref={xrayInputRef} onChange={handleRadImageChange} style={{display:'none'}} />
                                            <button type="button" className={styles.uploadBtn} onClick={() => xrayInputRef.current.click()}>
                                                <FaUpload /> Choose Image
                                            </button>
                                            {newRad.url && <span style={{color:'#22c55e', fontSize:'13px'}}>✓ Image selected</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => { setIsAddRadOpen(false); setNewRad({ label: '', date: '', notes: '', url: '' }); }} disabled={isSavingRad}>Cancel</button>
                                    <button type="submit" className={styles.saveBtn} disabled={isSavingRad}>{isSavingRad ? 'Uploading...' : 'Upload Radiograph'}</button>
                                </div>
                            </form>
                        )}

                        {radLoading ? (
                            <p style={{color:'#64748b', textAlign:'center', padding:'30px'}}>Loading radiographs...</p>
                        ) : radiographs.length === 0 ? (
                            <div style={{textAlign:'center', padding:'40px', color:'#94a3b8'}}>
                                <FaImage size={40} style={{marginBottom:'10px', opacity:0.4}} />
                                <p>No radiograph images on record.</p>
                            </div>
                        ) : (
                            <div style={{display:'flex', gap:'16px', flexWrap:'wrap'}}>
                                {radiographs.map(rad => (
                                    <div key={rad._id} className={styles.radCard} onClick={() => setSelectedRad(rad)}>
                                        {rad.url ? (
                                            <img src={rad.url} alt={rad.label} className={styles.radThumb} />
                                        ) : (
                                            <div className={styles.radPlaceholder}><FaImage /></div>
                                        )}
                                        <div className={styles.radInfo}>
                                            <p className={styles.radLabel}>{rad.label}</p>
                                            <p className={styles.radDate}>{rad.date ? formatDateShort(new Date(rad.date)) : 'N/A'}</p>
                                        </div>
                                        <button
                                            className={styles.deleteRadBtn}
                                            onClick={(e) => { e.stopPropagation(); handleDeleteRadiograph(rad._id); }}
                                            title="Delete radiograph"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Lightbox */}
                        {selectedRad && (
                            <div className={styles.lightboxOverlay} onClick={() => setSelectedRad(null)}>
                                <div className={styles.lightboxContent} onClick={e => e.stopPropagation()}>
                                    <button className={styles.lightboxClose} onClick={() => setSelectedRad(null)}>✕</button>
                                    <img src={selectedRad.url} alt={selectedRad.label} className={styles.lightboxImage} />
                                    <div className={styles.lightboxMeta}>
                                        <p><strong>{selectedRad.label}</strong></p>
                                        <p>{selectedRad.date ? formatDateLong(new Date(selectedRad.date)) : 'N/A'}</p>
                                        {selectedRad.notes && <p style={{color:'#64748b'}}>{selectedRad.notes}</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB: ODONTOGRAM (read-only view for admin) ── */}
                {activeTab === 'odontogram' && (
                    <div className={styles.contentCard}>
                        <div className={styles.cardHeader}>
                            <h3>Odontogram</h3>
                        </div>
                        <div style={{textAlign:'center', padding:'40px', color:'#64748b'}}>
                            <FaTooth size={40} style={{marginBottom:'12px', color:'#01538b', opacity:0.5}} />
                            <p>The interactive odontogram is managed by the attending dentist.</p>
                            <p style={{fontSize:'13px', marginTop:'8px'}}>View treatment logs above for tooth-specific procedure history.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}