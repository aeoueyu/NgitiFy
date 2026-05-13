import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSystemConfig } from '../hooks/useSystemConfig';

export default function FeatureRoute({ featureKey, fallbackPath, children }) {
    const { config, loading } = useSystemConfig();

    if (loading) {
        return null;
    }

    if (config?.featureToggles?.[featureKey] === false) {
        return <Navigate to={fallbackPath} replace />;
    }

    return children;
}
