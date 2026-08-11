import React from 'react';
import styles from './PatientRegistrationFlow.module.css';

export function PatientRegistrationStepper({
    steps,
    currentIndex,
    onStepSelect,
    isStepLocked,
    summaryAction = null,
}) {
    const activeStep = steps[currentIndex] || steps[0];

    return (
        <div className={styles.stepper}>
            <div className={styles.steps}>
                {steps.map((step, index) => {
                    const isActive = index === currentIndex;
                    const isComplete = index < currentIndex;
                    const locked = typeof isStepLocked === 'function' ? isStepLocked(index) : false;

                    return (
                        <button
                            key={step.key}
                            type="button"
                            className={[
                                styles.stepButton,
                                isActive ? styles.stepButtonActive : '',
                                isComplete ? styles.stepButtonComplete : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => onStepSelect(index)}
                            disabled={locked}
                        >
                            <span className={styles.stepCount}>{index + 1}</span>
                            <span className={styles.stepText}>
                                <strong>{step.label}</strong>
                                {step.description ? <span>{step.description}</span> : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            {activeStep ? (
                <div className={styles.summaryCard}>
                    <div className={styles.summaryInfo}>
                        <span className={styles.summaryEyebrow}>
                            Step {currentIndex + 1} of {steps.length}
                        </span>
                        <strong className={styles.summaryTitle}>{activeStep.label}</strong>
                        {activeStep.description ? <span className={styles.summaryText}>{activeStep.description}</span> : null}
                    </div>
                    {summaryAction}
                </div>
            ) : null}
        </div>
    );
}

export function PatientRegistrationSectionCard({
    eyebrow,
    title,
    description,
    children,
}) {
    return (
        <div className={styles.sectionCard}>
            {eyebrow ? <p className={styles.sectionEyebrow}>{eyebrow}</p> : null}
            {title ? <h3 className={styles.sectionTitle}>{title}</h3> : null}
            {description ? <p className={styles.sectionDescription}>{description}</p> : null}
            <div className={styles.sectionBody}>{children}</div>
        </div>
    );
}
