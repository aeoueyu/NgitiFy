import React, { useState } from 'react';
import styles from '../../styles/owner/OwnerDashboard.module.css';

// STRICT IMPORTS: Only using icons verified to exist in src/assets/icons/
import PatientVolumeIcon from '../../assets/icons/Patient.svg';
import UtilizationIcon from '../../assets/icons/MyPatients.svg'; // Placeholder for Utilization
import InventoryIcon from '../../assets/icons/InventoryTracker.svg';
import CalendarIcon from '../../assets/icons/Calendar.svg';

const OwnerDashboard = () => {
  // Mock data utilizing the Inventory model's logic (needsReorder threshold)
  const [inventory] = useState([
    { id: 1, itemName: 'Lidocaine 2%', currentStock: 4, threshold: 10 },
    { id: 2, itemName: 'Composite Resin A2', currentStock: 2, threshold: 5 },
    { id: 3, itemName: 'Sterilization Pouches', currentStock: 150, threshold: 100 },
    { id: 4, itemName: 'Saliva Ejectors', currentStock: 15, threshold: 50 },
  ]);

  // Mock data for the Clinic Calendar widget
  const [appointments] = useState([
    { id: 1, time: '09:00 AM', patientName: 'Sarah Jenkins', type: 'Consultation', chair: 'Operatory 1' },
    { id: 2, time: '10:30 AM', patientName: 'Michael Chang', type: 'Root Canal', chair: 'Operatory 2' },
    { id: 3, time: '01:00 PM', patientName: 'Emily Davis', type: 'Crown Prep', chair: 'Operatory 1' },
  ]);

  // Derived state: Only items that require reordering
  const lowStockAlerts = inventory.filter(item => item.currentStock <= item.threshold);

  return (
    <div className={styles['owner-dashboard']}>
      <header className={styles['owner-dashboard__header']}>
        <h1 className={styles['owner-dashboard__title']}>Expansion Analytics</h1>
        <p className={styles['owner-dashboard__subtitle']}>Real-time patient volume and resource utilization tracking.</p>
      </header>

      {/* Analytics Section (No Financials) */}
      <section className={styles['owner-dashboard__metrics']}>
        <div className={styles['metric-card']}>
          <div className={styles['metric-card__header']}>
            <img src={PatientVolumeIcon} alt="Patient Volume" className={styles['metric-card__icon']} />
            <h2 className={styles['metric-card__title']}>Weekly Patient Volume</h2>
          </div>
          <div className={styles['metric-card__data']}>
            <span className={styles['metric-card__value']}>184</span>
            <span className={styles['metric-card__trend--positive']}>+14% vs last week</span>
          </div>
        </div>

        <div className={styles['metric-card']}>
          <div className={styles['metric-card__header']}>
            <img src={UtilizationIcon} alt="Clinic Utilization" className={styles['metric-card__icon']} />
            <h2 className={styles['metric-card__title']}>Chair Utilization Rate</h2>
          </div>
          <div className={styles['metric-card__data']}>
            <span className={styles['metric-card__value']}>88%</span>
            <span className={styles['metric-card__trend--neutral']}>Optimal Capacity</span>
          </div>
        </div>
      </section>

      {/* Live Widgets Section */}
      <section className={styles['owner-dashboard__widgets']}>
        
        {/* Widget: Low Stock Alerts */}
        <div className={styles['widget']}>
          <div className={styles['widget__header']}>
            <img src={InventoryIcon} alt="Inventory Alerts" className={styles['widget__icon']} />
            <h3 className={styles['widget__title']}>Low Stock Alerts</h3>
          </div>
          <ul className={styles['widget__list']}>
            {lowStockAlerts.length > 0 ? (
              lowStockAlerts.map(item => (
                <li key={item.id} className={styles['widget__list-item']}>
                  <span className={styles['widget__item-name']}>{item.itemName}</span>
                  <span className={styles['widget__item-stock']}>
                    {item.currentStock} / {item.threshold}
                  </span>
                </li>
              ))
            ) : (
              <li className={styles['widget__list-item']}>All inventory levels are optimal.</li>
            )}
          </ul>
        </div>

        {/* Widget: Clinic Calendar */}
        <div className={styles['widget']}>
          <div className={styles['widget__header']}>
            <img src={CalendarIcon} alt="Calendar" className={styles['widget__icon']} />
            <h3 className={styles['widget__title']}>Today's Schedule</h3>
          </div>
          <ul className={styles['widget__list']}>
            {appointments.length > 0 ? (
              appointments.map(appt => (
                <li key={appt.id} className={styles['widget__list-item']}>
                  <div className={styles['widget__appt-time']}>{appt.time}</div>
                  <div className={styles['widget__appt-details']}>
                    <p className={styles['widget__appt-patient']}>{appt.patientName}</p>
                    <p className={styles['widget__appt-type']}>{appt.type} • {appt.chair}</p>
                  </div>
                </li>
              ))
            ) : (
              <li className={styles['widget__list-item']}>No appointments scheduled for today.</li>
            )}
          </ul>
        </div>

      </section>
    </div>
  );
};

export default OwnerDashboard;