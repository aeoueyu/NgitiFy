import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlus, FaEdit, FaPowerOff, FaEye } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import ConfirmModal from '../../components/common/ConfirmModal';
import { regions, provinces, cities, barangays } from '../../utils/addressData';
import styles from '../../styles/admin/BranchManagement.module.css';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';

const EMPTY_ADDRESS = { region: '', province: '', city: '', barangay: '', street: '', houseNumber: '' };
const EMPTY_FORM = { name: '', phone: '', branchManagerId: '', addressDetails: { ...EMPTY_ADDRESS } };
const REQUIRED_MESSAGE = 'Required';

const toTitleCase = (value) => value
    .toLowerCase()
    .replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());

const formatBranchAddress = (addressDetails, fallback = '') => {
    if (!addressDetails) return fallback || '';

    const regionName = regions.find((item) => item.code === addressDetails.region)?.name || '';
    const provinceName = (provinces[addressDetails.region] || []).find((item) => item.code === addressDetails.province)?.name || '';
    const cityName = (cities[addressDetails.province] || []).find((item) => item.code === addressDetails.city)?.name || '';

    const pieces = [
        addressDetails.houseNumber,
        addressDetails.street,
        addressDetails.barangay,
        cityName,
        provinceName,
        regionName,
    ].filter(Boolean);

    return pieces.length > 0 ? pieces.join(', ') : fallback;
};

const normalizeBranchForEdit = (branch) => ({
    name: branch?.name || '',
    phone: (branch?.contactNumber || '').replace(/^\+63/, ''),
    branchManagerId: Array.isArray(branch?.managerIds) ? String(branch.managerIds[0] || '') : '',
    addressDetails: {
        ...EMPTY_ADDRESS,
        ...(branch?.addressDetails || {}),
    },
});

const getManagerLabel = (manager = {}) => {
    const fullName = `${manager.name?.first || ''} ${manager.name?.last || ''}`.trim();
    return fullName || manager.email || 'Unnamed Manager';
};

const getStatusClassName = (isActive) => (
    isActive ? wideTable.statusGreen : wideTable.statusGray
);

const normalizeBranchKey = (value = '') => String(value || '').trim().toLowerCase();

export default function BranchManagement() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';
    const assignedBranch = user?.assignedBranch || '';

    const [branches, setBranches] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [successMessage, setSuccessMessage] = useState('');
    const [confirmTarget, setConfirmTarget] = useState(null);
    const [analyticsTarget, setAnalyticsTarget] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch(isBranchManager ? '/branches' : '/branches?all=true');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setBranches(Array.isArray(data) ? data : []);
        } catch (error) {
            addToast('Failed to load branches.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, isBranchManager]);

    const fetchManagers = useCallback(async () => {
        try {
            const res = await authFetch('/users?role=branch-manager');
            if (!res.ok) return;
            const data = await res.json();
            setManagers(Array.isArray(data) ? data : []);
        } catch (error) {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchBranches();
        fetchManagers();
    }, [fetchBranches, fetchManagers]);

    const getManagerName = useCallback((branch) => {
        const managerIds = Array.isArray(branch?.managerIds) ? branch.managerIds : [];
        const branchKey = normalizeBranchKey(branch?.name);

        const linkedManagers = managers.filter((manager) => managerIds.map(String).includes(String(manager._id)));
        const assignedManagers = managers.filter((manager) => {
            const managerBranch = manager.assignedBranch || manager.assignedBranches?.[0] || '';
            return normalizeBranchKey(managerBranch) === branchKey;
        });

        const uniqueManagers = [...linkedManagers, ...assignedManagers].filter((manager, index, array) => (
            array.findIndex((candidate) => String(candidate._id) === String(manager._id)) === index
        ));

        if (!uniqueManagers.length) return 'No manager assigned';

        return uniqueManagers
            .map((manager) => `${manager.name?.first || ''} ${manager.name?.last || ''}`.trim() || manager.email || 'Unnamed Manager')
            .join(', ');
    }, [managers]);

    const activeBranches = branches.filter((branch) => branch.isActive);
    const inactiveBranches = branches.filter((branch) => !branch.isActive);

    const openAdd = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setErrors({});
        setTouched({});
        setShowModal(true);
    };

    const openEdit = (branch) => {
        setEditTarget(branch);
        setForm(normalizeBranchForEdit(branch));
        setErrors({});
        setTouched({});
        setShowModal(true);
    };

    const closeModal = () => {
        if (submitting) return;
        setShowModal(false);
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setErrors({});
        setTouched({});
    };

    const getValidationErrors = useCallback((nextForm = form) => {
        const nextErrors = {};

        if (!nextForm.name.trim()) nextErrors.name = REQUIRED_MESSAGE;
        if (!nextForm.phone) nextErrors.phone = REQUIRED_MESSAGE;
        else if (nextForm.phone.length !== 10 || nextForm.phone[0] !== '9') nextErrors.phone = 'Invalid contact number';

        ['region', 'province', 'city', 'barangay', 'street', 'houseNumber'].forEach((field) => {
            if (!nextForm.addressDetails[field]) {
                nextErrors[field] = REQUIRED_MESSAGE;
            }
        });

        return nextErrors;
    }, [form]);

    const syncErrors = useCallback((nextForm, nextTouched = touched) => {
        const nextValidationErrors = getValidationErrors(nextForm);
        setErrors(() => {
            const preserved = {};
            Object.keys(nextValidationErrors).forEach((field) => {
                if (nextTouched[field]) preserved[field] = nextValidationErrors[field];
            });
            return preserved;
        });
    }, [getValidationErrors, touched]);

    const touchField = (field) => {
        setTouched((prev) => {
            const nextTouched = { ...prev, [field]: true };
            syncErrors(form, nextTouched);
            return nextTouched;
        });
    };

    const shouldShowError = (field) => touched[field] && errors[field];

    const handleNameChange = (value) => {
        const nextForm = { ...form, name: toTitleCase(value) };
        setForm(nextForm);
        syncErrors(nextForm);
    };

    const handlePhoneChange = (value) => {
        const next = value.replace(/\D/g, '').slice(0, 10);
        const nextForm = { ...form, phone: next };
        setForm(nextForm);
        syncErrors(nextForm);
    };

    const handleAddressChange = (field, value) => {
        const nextAddress = { ...form.addressDetails, [field]: value };
        const nextTouched = { ...touched };
        if (field === 'region') {
            nextAddress.province = '';
            nextAddress.city = '';
            nextAddress.barangay = '';
            delete nextTouched.province;
            delete nextTouched.city;
            delete nextTouched.barangay;
        }
        if (field === 'province') {
            nextAddress.city = '';
            nextAddress.barangay = '';
            delete nextTouched.city;
            delete nextTouched.barangay;
        }
        if (field === 'city') {
            nextAddress.barangay = '';
            delete nextTouched.barangay;
        }
        const nextForm = { ...form, addressDetails: nextAddress };
        setForm(nextForm);
        setTouched(nextTouched);
        syncErrors(nextForm, nextTouched);
    };

    const handleManagerChange = (value) => {
        setForm((prev) => ({ ...prev, branchManagerId: value }));
    };

    const validateForm = () => {
        const nextErrors = getValidationErrors(form);
        setTouched({
            name: true,
            phone: true,
            region: true,
            province: true,
            city: true,
            barangay: true,
            street: true,
            houseNumber: true,
        });
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setSubmitting(true);

        const payload = {
            name: form.name.trim(),
            contactNumber: `+63${form.phone}`,
            addressDetails: form.addressDetails,
            address: formatBranchAddress(form.addressDetails),
            branchManagerId: form.branchManagerId || '',
            isActive: editTarget ? editTarget.isActive : true,
        };

        try {
            const res = await authFetch(
                editTarget ? `/branches/${editTarget._id}` : '/branches',
                {
                    method: editTarget ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrors((prev) => ({ ...prev, form: data.message || 'Failed to save branch.' }));
                return;
            }

            setSuccessMessage(`Branch ${editTarget ? 'updated' : 'created'} successfully.`);
            closeModal();
            fetchBranches();
        } catch (error) {
            setErrors((prev) => ({ ...prev, form: 'Network error. Please try again.' }));
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (branch) => {
        try {
            const res = await authFetch(`/branches/${branch._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: branch.name,
                    address: branch.address || formatBranchAddress(branch.addressDetails),
                    addressDetails: branch.addressDetails || EMPTY_ADDRESS,
                    contactNumber: branch.contactNumber || '',
                    isActive: !branch.isActive,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to update branch.');
            }

            addToast(`Branch ${branch.isActive ? 'deactivated' : 'activated'} successfully.`, 'success');
            setConfirmTarget(null);
            fetchBranches();
        } catch (error) {
            addToast(error.message || 'Failed to update branch.', 'error');
        }
    };

    const openAnalytics = async (branch) => {
        setAnalyticsTarget(branch);
        setAnalyticsLoading(true);
        setAnalyticsData(null);

        try {
            const res = await authFetch('/analytics/branches');
            if (!res.ok) throw new Error();
            const data = await res.json();

            const branchCounts = (data.branchCounts || []).find((entry) => entry._id === branch.name)?.total || 0;
            const procedures = (data.procedures || []).slice(0, 6);
            const statusBreakdown = (data.statusBreakdown || [])
                .filter((entry) => entry._id?.branch === branch.name)
                .map((entry) => ({
                    label: entry._id?.status || 'unknown',
                    count: entry.count,
                }));
            const monthly = (data.monthly || [])
                .filter((entry) => entry._id?.branch === branch.name)
                .map((entry) => ({
                    label: `${entry._id.month}/${entry._id.year}`,
                    count: entry.count,
                }));

            setAnalyticsData({
                totalAppointments: branchCounts,
                procedures,
                statusBreakdown,
                monthly,
            });
        } catch (error) {
            addToast('Failed to load branch analytics.', 'error');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const availableProvinces = useMemo(() => (
        form.addressDetails.region ? (provinces[form.addressDetails.region] || []) : []
    ), [form.addressDetails.region]);
    const availableCities = useMemo(() => (
        form.addressDetails.province ? (cities[form.addressDetails.province] || []) : []
    ), [form.addressDetails.province]);
    const availableBarangays = useMemo(() => (
        form.addressDetails.city ? (barangays[form.addressDetails.city] || []) : []
    ), [form.addressDetails.city]);

    if (loading) {
        return <div className={styles.container}><p className={styles.loading}>Loading branches...</p></div>;
    }

    const orderedBranches = [...activeBranches, ...inactiveBranches];

    return (
        <div className={scheduleStyles.page}>
            <div className={scheduleStyles.headerRow}>
                <div>
                    <h1 className={scheduleStyles.pageTitle}>Branch Management</h1>
                    <p className={scheduleStyles.pageSubtitle}>
                        {isBranchManager
                            ? `Viewing ${assignedBranch || 'your assigned branch'} only`
                            : `${activeBranches.length} active branch${activeBranches.length === 1 ? '' : 'es'} and ${inactiveBranches.length} inactive branch${inactiveBranches.length === 1 ? '' : 'es'}.`}
                    </p>
                </div>
                {!isBranchManager && (
                    <button className={scheduleStyles.primaryButton} onClick={openAdd} type="button">
                        <FaPlus /> Add Branch
                    </button>
                )}
            </div>

            <div className={scheduleStyles.tableContainer}>
                <table className={wideTable.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '20%' }}>Name</th>
                            <th style={{ width: '14%' }}>Contact</th>
                            <th style={{ width: '52%' }}>Manager</th>
                            <th style={{ width: '8%' }}>Status</th>
                            <th style={{ width: '16%', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orderedBranches.length === 0 ? (
                            <tr>
                                <td colSpan="6" className={scheduleStyles.emptyStateBox}>
                                    No branch records found.
                                </td>
                            </tr>
                        ) : (
                            orderedBranches.map((branch) => (
                                <tr key={branch._id}>
                                    <td>
                                        <div className={scheduleStyles.patientCell}>
                                            <strong>{branch.name}</strong>
                                            <span>{branch.isActive ? 'Active branch' : 'Inactive branch'}</span>
                                        </div>
                                    </td>
                                    <td>{branch.contactNumber || '-'}</td>
                                    <td>{getManagerName(branch)}</td>
                                    <td>
                                        <span className={`${wideTable.statusBadge} ${getStatusClassName(branch.isActive)}`}>
                                            {branch.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={wideTable.iconActions}>
                                            <button
                                                type="button"
                                                className={wideTable.iconAction}
                                                title="View Analytics"
                                                onClick={() => openAnalytics(branch)}
                                            >
                                                <FaEye />
                                            </button>
                                            {!isBranchManager && (
                                                <button
                                                    type="button"
                                                    className={wideTable.iconAction}
                                                    title="Edit Branch"
                                                    onClick={() => openEdit(branch)}
                                                >
                                                    <FaEdit />
                                                </button>
                                            )}
                                            {!isBranchManager && (
                                                <button
                                                    type="button"
                                                    className={wideTable.iconAction}
                                                    title={branch.isActive ? 'Deactivate Branch' : 'Activate Branch'}
                                                    onClick={() => setConfirmTarget(branch)}
                                                >
                                                    <FaPowerOff />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!isBranchManager && showModal && (
                <div className={styles.overlay}>
                    <div className={`${styles.modal} ${styles.largeModal}`}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>{editTarget ? 'Edit Branch' : 'Add New Branch'}</h2>
                        </div>

                        <div className={styles.modalBody}>
                            {errors.form && <p className={styles.formError}>{errors.form}</p>}

                            <div className={styles.addressGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Branch Name <span className={styles.required}>*</span></label>
                                    <input
                                        className={`${styles.input} ${shouldShowError('name') ? styles.inputError : ''}`}
                                        value={form.name}
                                        onChange={(event) => handleNameChange(event.target.value)}
                                        onBlur={() => touchField('name')}
                                        placeholder="e.g. Main Branch - Makati"
                                    />
                                    {shouldShowError('name') && <span className={styles.errorText}>{errors.name}</span>}
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Contact Number <span className={styles.required}>*</span></label>
                                    <div className={`${styles.phoneInputWrap} ${shouldShowError('phone') ? styles.inputError : ''}`}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input
                                            className={styles.input}
                                            value={form.phone}
                                            onChange={(event) => handlePhoneChange(event.target.value)}
                                            onBlur={() => touchField('phone')}
                                            placeholder="9xxxxxxxxx"
                                        />
                                    </div>
                                    {shouldShowError('phone') && <span className={styles.errorText}>{errors.phone}</span>}
                                </div>

                                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                                    <label className={styles.label}>Branch Manager</label>
                                    <select
                                        className={styles.input}
                                        value={form.branchManagerId}
                                        onChange={(event) => handleManagerChange(event.target.value)}
                                    >
                                        <option value="">No branch manager assigned</option>
                                        {managers.map((manager) => (
                                            <option key={manager._id} value={manager._id}>
                                                {getManagerLabel(manager)}
                                                {manager.assignedBranch ? ` - ${manager.assignedBranch}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span className={styles.helperText}>Optional. You can create a branch first and assign a manager later.</span>
                                </div>
                            </div>

                            <div className={styles.addressGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Region <span className={styles.required}>*</span></label>
                                <select
                                    className={`${styles.input} ${shouldShowError('region') ? styles.inputError : ''}`}
                                    value={form.addressDetails.region}
                                    onChange={(event) => handleAddressChange('region', event.target.value)}
                                    onBlur={() => touchField('region')}
                                >
                                    <option value="">Select Region</option>
                                    {regions.map((region) => (
                                        <option key={region.code} value={region.code}>{region.name}</option>
                                    ))}
                                </select>
                                {shouldShowError('region') && <span className={styles.errorText}>{errors.region}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Province <span className={styles.required}>*</span></label>
                                <select
                                    className={`${styles.input} ${shouldShowError('province') ? styles.inputError : ''}`}
                                    value={form.addressDetails.province}
                                    onChange={(event) => handleAddressChange('province', event.target.value)}
                                    onBlur={() => touchField('province')}
                                    disabled={!form.addressDetails.region}
                                >
                                    <option value="">Select Province</option>
                                    {availableProvinces.map((province) => (
                                        <option key={province.code} value={province.code}>{province.name}</option>
                                    ))}
                                </select>
                                {shouldShowError('province') && <span className={styles.errorText}>{errors.province}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>City / Municipality <span className={styles.required}>*</span></label>
                                <select
                                    className={`${styles.input} ${shouldShowError('city') ? styles.inputError : ''}`}
                                    value={form.addressDetails.city}
                                    onChange={(event) => handleAddressChange('city', event.target.value)}
                                    onBlur={() => touchField('city')}
                                    disabled={!form.addressDetails.province}
                                >
                                    <option value="">Select City</option>
                                    {availableCities.map((city) => (
                                        <option key={city.code} value={city.code}>{city.name}</option>
                                    ))}
                                </select>
                                {shouldShowError('city') && <span className={styles.errorText}>{errors.city}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Barangay <span className={styles.required}>*</span></label>
                                <select
                                    className={`${styles.input} ${shouldShowError('barangay') ? styles.inputError : ''}`}
                                    value={form.addressDetails.barangay}
                                    onChange={(event) => handleAddressChange('barangay', event.target.value)}
                                    onBlur={() => touchField('barangay')}
                                    disabled={!form.addressDetails.city}
                                >
                                    <option value="">Select Barangay</option>
                                    {availableBarangays.map((barangay) => (
                                        <option key={barangay} value={barangay}>{barangay}</option>
                                    ))}
                                </select>
                                {shouldShowError('barangay') && <span className={styles.errorText}>{errors.barangay}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Street <span className={styles.required}>*</span></label>
                                <input
                                    className={`${styles.input} ${shouldShowError('street') ? styles.inputError : ''}`}
                                    value={form.addressDetails.street}
                                    onChange={(event) => handleAddressChange('street', event.target.value)}
                                    onBlur={() => touchField('street')}
                                    placeholder="e.g. Mabini St."
                                />
                                {shouldShowError('street') && <span className={styles.errorText}>{errors.street}</span>}
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>House No. <span className={styles.required}>*</span></label>
                                <input
                                    className={`${styles.input} ${shouldShowError('houseNumber') ? styles.inputError : ''}`}
                                    value={form.addressDetails.houseNumber}
                                    onChange={(event) => handleAddressChange('houseNumber', event.target.value)}
                                    onBlur={() => touchField('houseNumber')}
                                    placeholder="e.g. Unit 12"
                                />
                                {shouldShowError('houseNumber') && <span className={styles.errorText}>{errors.houseNumber}</span>}
                            </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button className={styles.cancelBtn} onClick={closeModal} disabled={submitting} type="button">
                                    Cancel
                                </button>
                                <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting} type="button">
                                    {submitting ? 'Saving...' : (editTarget ? 'Save Changes' : 'Add Branch')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {successMessage && (
                <div className={styles.overlay}>
                    <div className={styles.successModalCard}>
                        <div className={styles.successIcon} />
                        <h2 className={styles.successTitle}>Success!</h2>
                        <p className={styles.successMessage}>{successMessage}</p>
                        <button className={styles.submitBtn} type="button" onClick={() => setSuccessMessage('')}>
                            DONE
                        </button>
                    </div>
                </div>
            )}

            {analyticsTarget && (
                <div className={styles.overlay}>
                    <div className={`${styles.modal} ${styles.analyticsModal}`}>
                        <div className={styles.analyticsHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>{analyticsTarget.name}</h2>
                                <p className={styles.analyticsSubtitle}>Branch information followed by analytics</p>
                            </div>
                            <button className={styles.cancelBtn} onClick={() => setAnalyticsTarget(null)} type="button">
                                Close
                            </button>
                        </div>

                        {analyticsLoading ? (
                            <div className={styles.emptyState}>Loading analytics...</div>
                        ) : analyticsData ? (
                            <>
                                <div className={styles.analyticsSection}>
                                    <h3 className={styles.analyticsSectionTitle}>Branch Information</h3>
                                    <div className={styles.analyticsList}>
                                        <div className={styles.analyticsListItem}>
                                            <span>Contact Number</span>
                                            <strong>{analyticsTarget.contactNumber || '-'}</strong>
                                        </div>
                                        <div className={styles.analyticsListItem}>
                                            <span>Address</span>
                                            <strong>{formatBranchAddress(analyticsTarget.addressDetails, analyticsTarget.address || '-') || '-'}</strong>
                                        </div>
                                        <div className={styles.analyticsListItem}>
                                            <span>Manager</span>
                                            <strong>{getManagerName(analyticsTarget)}</strong>
                                        </div>
                                        <div className={styles.analyticsListItem}>
                                            <span>Status</span>
                                            <strong>{analyticsTarget.isActive ? 'Active' : 'Inactive'}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.analyticsStats}>
                                    <div className={styles.analyticsStatCard}>
                                        <span className={styles.analyticsStatLabel}>Appointments</span>
                                        <strong className={styles.analyticsStatValue}>{analyticsData.totalAppointments}</strong>
                                    </div>
                                    <div className={styles.analyticsStatCard}>
                                        <span className={styles.analyticsStatLabel}>Status Types</span>
                                        <strong className={styles.analyticsStatValue}>{analyticsData.statusBreakdown.length}</strong>
                                    </div>
                                    <div className={styles.analyticsStatCard}>
                                        <span className={styles.analyticsStatLabel}>Monthly Entries</span>
                                        <strong className={styles.analyticsStatValue}>{analyticsData.monthly.length}</strong>
                                    </div>
                                </div>

                                <div className={styles.analyticsSection}>
                                    <h3 className={styles.analyticsSectionTitle}>Status Breakdown</h3>
                                    {analyticsData.statusBreakdown.length > 0 ? (
                                        <div className={styles.analyticsList}>
                                            {analyticsData.statusBreakdown.map((item) => (
                                                <div key={item.label} className={styles.analyticsListItem}>
                                                    <span>{item.label}</span>
                                                    <strong>{item.count}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles.analyticsEmpty}>No status data yet.</p>
                                    )}
                                </div>

                                <div className={styles.analyticsSection}>
                                    <h3 className={styles.analyticsSectionTitle}>Monthly Activity</h3>
                                    {analyticsData.monthly.length > 0 ? (
                                        <div className={styles.analyticsList}>
                                            {analyticsData.monthly.map((item) => (
                                                <div key={item.label} className={styles.analyticsListItem}>
                                                    <span>{item.label}</span>
                                                    <strong>{item.count}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles.analyticsEmpty}>No monthly activity yet.</p>
                                    )}
                                </div>

                                <div className={styles.analyticsSection}>
                                    <h3 className={styles.analyticsSectionTitle}>Top Procedures</h3>
                                    {analyticsData.procedures.length > 0 ? (
                                        <div className={styles.analyticsList}>
                                            {analyticsData.procedures.map((item) => (
                                                <div key={item._id} className={styles.analyticsListItem}>
                                                    <span>{item._id}</span>
                                                    <strong>{item.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={styles.analyticsEmpty}>No procedure data yet.</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className={styles.emptyState}>Analytics unavailable for this branch right now.</div>
                        )}
                    </div>
                </div>
            )}

            {!isBranchManager && (
                <ConfirmModal
                    isOpen={!!confirmTarget}
                    title={confirmTarget?.isActive ? 'Deactivate Branch' : 'Activate Branch'}
                    message={confirmTarget?.isActive
                        ? `Are you sure you want to deactivate "${confirmTarget?.name}"?`
                        : `Reactivate "${confirmTarget?.name}"?`}
                    confirmText={confirmTarget?.isActive ? 'Deactivate' : 'Activate'}
                    isDestructive={confirmTarget?.isActive}
                    onConfirm={() => handleToggleActive(confirmTarget)}
                    onCancel={() => setConfirmTarget(null)}
                />
            )}
        </div>
    );
}
