import React, { useState } from 'react';
import styles from './OwnerDashboard.module.css';

// STRICT PLACEHOLDER: Re-using a single existing icon to avoid import errors.
import PlaceholderIcon from '../../assets/icons/User.svg';

const OwnerDashboard = () => {
  // Mock data utilizing the needsReorder logic concept
  const [inventory] = useState([
    { id: 1, item: 'Lidocaine 2%', stock: 4, threshold: 10 },
    { id: 2, item: 'Composite Resin A2', stock: 2, threshold: 5 },
    { id: 3, item: 'Sterilization Pouches', stock: 150, threshold: 100 },
  ]);

  const [appointments] = useState([
    { id: 1, time: '09:00 AM', patient: 'Sarah Jenkins', type: 'Consultation', room: 'Op 1' },
    { id: 2, time: '10:30 AM', patient: 'Michael Chang', type: 'Root Canal', room: 'Op 2' },
    { id: 3, time: '01:00 PM', patient: 'Emily Davis', type: 'Crown Prep', room: 'Op 1' },
  ]);

  // Derived state for the alert widget
  const lowStockItems = inventory.filter(item => item.stock <= item.threshold);

  return (
    <div className={styles['owner-dashboard']}>
      <header className={styles['owner-dashboard__header']}>
        <h1 className={styles['owner-dashboard__title']}>Expansion Analytics</h1>
        <p className={styles['owner-dashboard__subtitle']}>Real-time patient volume and resource utilization tracking.</p>
      </header>

      <div className={styles['owner-dashboard__metrics']}>
        {/* Metric: Patient Volume */}
        <div className={styles['metric-card']}>
          <div className={styles['metric-card__header']}>
            <img src={PlaceholderIcon} alt="Icon" className={styles['metric-card__icon']} />
            <h2 className={styles['metric-card__title']}>Weekly Patient Volume</h2>
          </div>
          <div className={styles['metric-card__data']}>
            <span className={styles['metric-card__value']}>184</span>
            <span className={styles['metric-card__trend--up']}>+14% vs last week</span>
          </div>
        </div>

        {/* Metric: Clinic Utilization */}
        <div className={styles['metric-card']}>
          <div className={styles['metric-card__header']}>
            <img src={PlaceholderIcon} alt="Icon" className={styles['metric-card__icon']} />
            <h2 className={styles['metric-card__title']}>Chair Utilization</h2>
          </div>
          <div className={styles['metric-card__data']}>
            <span className={styles['metric-card__value']}>88%</span>
            <span className={styles['metric-card__trend--neutral']}>Optimal Capacity</span>
          </div>
        </div>
      </div>

      <div className={styles['owner-dashboard__widgets']}>
        {/* Live Widget: Low Stock Alerts */}
        <div className={styles['widget']}>
          <div className={styles['widget__header']}>
            <img src={PlaceholderIcon} alt="Icon" className={styles['widget__icon']} />
            <h3 className={styles['widget__title']}>Low Stock Alerts</h3>
          </div>
          <ul className={styles['widget__list']}>
            {lowStockItems.map(item => (
              <li key={item.id} className={styles['widget__list-item']}>
                <span className={styles['widget__item-name']}>{item.item}</span>
                <span className={styles['widget__item-stock']}>
                  {item.stock} / {item.threshold}
                </span>
              </li>
            ))}
            {lowStockItems.length === 0 && (
              <li className={styles['widget__list-item']}>All inventory levels optimal.</li>
            )}
          </ul>
        </div>

        {/* Live Widget: Clinic Calendar */}
        <div className={styles['widget']}>
          <div className={styles['widget__header']}>
            <img src={PlaceholderIcon} alt="Icon" className={styles['widget__icon']} />
            <h3 className={styles['widget__title']}>Today's Schedule</h3>
          </div>
          <ul className={styles['widget__list']}>
            {appointments.map(appt => (
              <li key={appt.id} className={styles['widget__list-item']}>
                <div className={styles['widget__appt-time']}>{appt.time}</div>
                <div className={styles['widget__appt-details']}>
                  <p className={styles['widget__appt-patient']}>{appt.patient}</p>
                  <p className={styles['widget__appt-type']}>{appt.type} • {appt.room}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;