import React, { useEffect, useState } from 'react';

const normalizeImageSrc = (value) => String(value || '').trim();

export default function WebsiteImage({ src, fallbackSrc = '', alt, ...props }) {
    const normalizedFallback = normalizeImageSrc(fallbackSrc);
    const [currentSrc, setCurrentSrc] = useState(normalizeImageSrc(src) || normalizedFallback);

    useEffect(() => {
        setCurrentSrc(normalizeImageSrc(src) || normalizedFallback);
    }, [normalizedFallback, src]);

    if (!currentSrc) {
        return null;
    }

    return (
        <img
            {...props}
            src={currentSrc}
            alt={alt}
            onError={() => {
                if (normalizedFallback && currentSrc !== normalizedFallback) {
                    setCurrentSrc(normalizedFallback);
                    return;
                }
                setCurrentSrc('');
            }}
        />
    );
}
