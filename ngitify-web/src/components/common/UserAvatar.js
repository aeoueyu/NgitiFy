import React from 'react';
import styles from './UserAvatar.module.css';

export default function UserAvatar({ user, size = 45, className = '', style = {} }) {
    // Handle both number (pixels) and string sizes (e.g., '100%')
    const imageSize = typeof size === 'number' ? `${size}px` : size;
    
    const defaultStyles = {
        width: imageSize,
        height: imageSize,
        fontSize: typeof size === 'number' ? `${Math.max(12, size * 0.35)}px` : '16px', // Auto-scale font
        ...style
    };

    // 1. If user has an uploaded profile picture, render the image
    if (user?.profileImage) {
        return (
            <img 
                src={user.profileImage} 
                alt="User Avatar" 
                className={`${styles.avatarImage} ${className}`} 
                style={defaultStyles}
            />
        );
    }

    // 2. If no image, safely extract initials regardless of how the user object is structured
    let initials = '?';
    
    if (user) {
        let first = '';
        let last = '';

        // Handle nested name object { name: { first: 'John', last: 'Doe' } }
        if (typeof user.name === 'object' && user.name !== null) {
            first = user.name.first || '';
            last = user.name.last || '';
        } 
        // Handle flat name properties { firstName: 'John', lastName: 'Doe' }
        else if (user.firstName || user.lastName) {
            first = user.firstName || '';
            last = user.lastName || '';
        } 
        // Handle single string name { name: 'John Doe' }
        else if (typeof user.name === 'string') {
            const parts = user.name.trim().split(/\s+/);
            first = parts[0] || '';
            last = parts.length > 1 ? parts[parts.length - 1] : '';
        }

        const firstInitial = first.charAt(0) || '';
        const lastInitial = last.charAt(0) || '';
        
        initials = (firstInitial + lastInitial).toUpperCase();
        if (!initials) initials = '?'; // Fallback if name was completely empty
    }

    return (
        <div 
            className={`${styles.avatarFallback} ${className}`} 
            style={defaultStyles}
            title={typeof user?.name === 'string' ? user.name : undefined}
        >
            {initials}
        </div>
    );
}