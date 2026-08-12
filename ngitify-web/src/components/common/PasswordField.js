import React, { forwardRef, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import styles from './PasswordField.module.css';

const PasswordField = forwardRef(function PasswordField(
    {
        className = '',
        wrapperClassName = '',
        buttonClassName = '',
        disabled = false,
        ...props
    },
    ref
) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={[styles.wrapper, wrapperClassName].filter(Boolean).join(' ')}>
            <input
                {...props}
                ref={ref}
                type={isVisible ? 'text' : 'password'}
                disabled={disabled}
                className={[className, styles.input].filter(Boolean).join(' ')}
            />
            <button
                type="button"
                className={[styles.toggle, buttonClassName].filter(Boolean).join(' ')}
                onClick={() => setIsVisible((current) => !current)}
                aria-label={isVisible ? 'Hide password' : 'Show password'}
                disabled={disabled}
                tabIndex={-1}
            >
                {isVisible ? <FaEyeSlash /> : <FaEye />}
            </button>
        </div>
    );
});

export default PasswordField;
