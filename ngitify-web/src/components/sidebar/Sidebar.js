import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

// --- IMPORTS MULA SA IYONG ASSETS FOLDER ---
import DentimeLogo from '../../assets/images/logo-dentime.svg';
import DashboardIcon from '../../assets/icons/FinancialReports.svg'; 
import StaffIcon from '../../assets/icons/ViewStaffRecords.svg';
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import AuditIcon from '../../assets/icons/SystemAuditLogs.svg';

// Dentist Tools Icons
import DentistIcon from '../../assets/icons/Dentist.svg';
import ScheduleIcon from '../../assets/icons/MySchedule.svg';
import RecordIcon from '../../assets/icons/MedicalRecords.svg';
import AIPredictIcon from '../../assets/icons/AIPredict.svg';
import PrescriptionIcon from '../../assets/icons/EPrescription.svg';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isDentistToolsOpen, setIsDentistToolsOpen] = useState(false);

    // Helper para ibigay yung tamang class kapag active yung page
    const getNavClass = (path) => {
        return location.pathname === path ? `${styles['nav-item']} ${styles.active}` : styles['nav-item'];
    };

    const getDropdownClass = (path) => {
        return location.pathname === path ? `${styles['dropdown-item']} ${styles.active}` : styles['dropdown-item'];
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles['logo-container']}>
                <img src={DentimeLogo} alt="Dentime Logo" className={styles['sidebar-logo']} />
            </div>

            <div className={styles['nav-menu']}>
                {/* Main Menus */}
                <div className={getNavClass('/owner/dashboard')} onClick={() => navigate('/owner/dashboard')}>
                    <img src={DashboardIcon} alt="Dashboard" className={styles['nav-icon']} /> <span>Dashboard</span>
                </div>
                <div className={getNavClass('/owner/manage-staff')} onClick={() => navigate('/owner/manage-staff')}>
                    <img src={StaffIcon} alt="Manage Staff" className={styles['nav-icon']} /> <span>Manage Staff</span>
                </div>
                <div className={getNavClass('/owner/inventory')} onClick={() => navigate('/owner/inventory')}>
                    <img src={InventoryIcon} alt="Inventory" className={styles['nav-icon']} /> <span>Inventory</span>
                </div>
                <div className={getNavClass('/owner/financial-reports')} onClick={() => navigate('/owner/financial-reports')}>
                    <img src={DashboardIcon} alt="Finance" className={styles['nav-icon']} /> <span>Financial Reports</span>
                </div>
                <div className={getNavClass('/owner/audit-logs')} onClick={() => navigate('/owner/audit-logs')}>
                    <img src={AuditIcon} alt="Audit" className={styles['nav-icon']} /> <span>Audit Logs</span>
                </div>

                {/* Dentist Tools Dropdown Trigger */}
                <div 
                    className={styles['nav-item']} 
                    onClick={() => setIsDentistToolsOpen(!isDentistToolsOpen)} 
                    style={{ marginTop: '10px', borderTop: '1px solid rgba(1, 83, 139, 0.08)', paddingTop: '15px' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src={DentistIcon} alt="Dentist" className={styles['nav-icon']} /> 
                        <span>Dentist Tools</span>
                    </div>
                    <span style={{ fontSize: '12px' }}>{isDentistToolsOpen ? '▲' : '▼'}</span>
                </div>

                {/* Dropdown Items */}
                {isDentistToolsOpen && (
                    <div className={styles['dropdown-menu']}>
                        <div className={getDropdownClass('/owner/appointments')} onClick={() => navigate('/owner/appointments')}>
                            <img src={ScheduleIcon} alt="Appointments" className={styles['nav-icon']} /> Appointments
                        </div>
                        <div className={getDropdownClass('/owner/patient-records')} onClick={() => navigate('/owner/patient-records')}>
                            <img src={RecordIcon} alt="Records" className={styles['nav-icon']} /> Patient Records
                        </div>
                        <div className={getDropdownClass('/owner/surgeries')} onClick={() => navigate('/owner/surgeries')}>
                            <img src={AIPredictIcon} alt="Simulation" className={styles['nav-icon']} /> Simulation Tool
                        </div>
                        <div className={getDropdownClass('/owner/prescriptions')} onClick={() => navigate('/owner/prescriptions')}>
                            <img src={PrescriptionIcon} alt="Prescriptions" className={styles['nav-icon']} /> Prescriptions
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}