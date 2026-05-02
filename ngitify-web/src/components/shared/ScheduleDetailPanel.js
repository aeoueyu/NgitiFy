import React from 'react';
import { FaClock, FaFileMedical, FaUserMd } from 'react-icons/fa';
import { formatDateShort } from '../../utils/dateUtils';
import styles from '../../styles/shared/SchedulePage.module.css';

const getBasePath = (role) => (role === 'administrator' ? '/admin' : `/${role}`);

export default function ScheduleDetailPanel({
    role,
    selectedAppointment,
    statusTone,
    onOpenEmr,
    to12h,
}) {
    if (!selectedAppointment) {
        return (
            <aside className={styles.detailPanel}>
                <div className={styles.emptyDetail}>Select an appointment to view its details.</div>
            </aside>
        );
    }

    const emrHref = selectedAppointment.patientId
        ? `${getBasePath(role)}/patients/${selectedAppointment.patientId}/emr`
        : '';

    return (
        <aside className={styles.detailPanel}>
            <div className={styles.detailHeader}>
                <span className={`${styles.statusBadge} ${statusTone}`}>
                    {selectedAppointment.status}
                </span>
                <h2 className={styles.detailTitle}>{selectedAppointment.patientName}</h2>
                <p className={styles.detailSubtitle}>{selectedAppointment.procedure}</p>
            </div>

            <div className={styles.detailList}>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Reservation ID</span>
                    <span className={styles.detailValue}>{selectedAppointment.id}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Date</span>
                    <span className={styles.detailValue}>{formatDateShort(selectedAppointment.date)}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Time</span>
                    <span className={styles.detailValue}><FaClock /> {to12h(selectedAppointment.time)}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Dentist</span>
                    <span className={styles.detailValue}><FaUserMd /> {selectedAppointment.dentistName}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Branch</span>
                    <span className={styles.detailValue}>{selectedAppointment.branch || 'Not assigned'}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Source</span>
                    <span className={styles.detailValue}>{selectedAppointment.source}</span>
                </div>
                <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Payment Status</span>
                    <span className={styles.detailValue}>Pending verification</span>
                </div>
            </div>

            {selectedAppointment.patientId && (
                <button type="button" className={styles.emrLink} onClick={() => onOpenEmr(emrHref)}>
                    <FaFileMedical /> Open Full Patient EMR
                </button>
            )}
        </aside>
    );
}
