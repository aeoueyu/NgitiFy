import React, { useEffect, useState } from 'react';

export default function RowsPerPageInput({
    value,
    onChange,
    min = 1,
    className = '',
    style,
}) {
    const [draftValue, setDraftValue] = useState(String(value));
    const minimum = Math.max(1, Number(min) || 1);

    useEffect(() => {
        setDraftValue(String(value));
    }, [value]);

    const commitValue = () => {
        const numericValue = Number(draftValue);
        if (!Number.isInteger(numericValue) || numericValue < minimum) {
            setDraftValue(String(value));
            return;
        }

        const normalizedValue = String(numericValue);
        setDraftValue(normalizedValue);
        onChange?.({ target: { value: normalizedValue } });
    };

    const handleKeyDown = (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        event.currentTarget.blur();
    };

    return (
        <input
            type="number"
            min={minimum}
            step="1"
            inputMode="numeric"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitValue}
            onKeyDown={handleKeyDown}
            onWheel={(event) => event.currentTarget.blur()}
            className={className}
            style={style}
        />
    );
}
