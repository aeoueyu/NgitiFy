import React, { useEffect, useState } from 'react';

import CustomModal from './CustomModal';

let presentModal = null;
const pendingModals = [];

const inferType = (title = '') => {
    if (/success|sent|signed|updated|rescheduled|cancelled|canceled/i.test(title)) {
        return 'success';
    }
    if (/failed|error|unable|could not|not saved/i.test(title)) {
        return 'error';
    }
    return 'warning';
};

/**
 * Alert.alert-compatible entry point backed by the app's branded React Native
 * modal. Keeping the same arguments makes it easy for every screen to use one
 * consistent presentation without owning duplicate modal state.
 */
export const showAppModal = (title, message, buttons, options = {}) => {
    const modal = {
        title: title || 'Notice',
        message: message || '',
        buttons: Array.isArray(buttons) && buttons.length
            ? buttons
            : [{ text: 'OK' }],
        cancelable: options.cancelable !== false,
        type: options.type || inferType(title),
    };

    if (presentModal) {
        presentModal(modal);
    } else {
        pendingModals.push(modal);
    }
};

export default function AppModalProvider({ children }) {
    const [modal, setModal] = useState(null);

    useEffect(() => {
        presentModal = (nextModal) => {
            setModal((currentModal) => {
                if (currentModal) {
                    pendingModals.push(nextModal);
                    return currentModal;
                }
                return nextModal;
            });
        };
        if (pendingModals.length) {
            setModal(pendingModals.shift());
        }

        return () => {
            presentModal = null;
        };
    }, []);

    const closeModal = (onPress) => {
        setModal(null);
        onPress?.();

        if (pendingModals.length) {
            setTimeout(() => setModal(pendingModals.shift()), 0);
        }
    };

    const modalButtons = modal?.buttons.map((button) => ({
        ...button,
        onPress: () => closeModal(button.onPress),
    }));

    return (
        <>
            {children}
            <CustomModal
                visible={Boolean(modal)}
                title={modal?.title}
                message={modal?.message}
                type={modal?.type}
                buttons={modalButtons}
                cancelable={modal?.cancelable}
                onClose={() => closeModal()}
            />
        </>
    );
}
