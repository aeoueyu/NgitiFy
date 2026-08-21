import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PatientAIChat from './PatientAIChat';
import { openPatientAiChat } from '../../utils/patientAiChat';

jest.mock('react-router-dom', () => ({
    useLocation: () => ({ key: 'test', state: null }),
}), { virtual: true });

jest.mock('../../pages/patient/PatientAiCompanion', () => function MockPatientAiCompanion({
    isOpen,
    onClose,
}) {
    return (
        <div data-testid="patient-ai-window" data-open={String(isOpen)}>
            <button type="button" onClick={onClose}>Close assistant</button>
        </div>
    );
});

describe('PatientAIChat', () => {
    const renderChat = () => render(<PatientAIChat />);

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        act(() => {
            jest.runOnlyPendingTimers();
        });
        jest.useRealTimers();
    });

    test('opens from the launcher and closes back to the launcher', () => {
        renderChat();

        fireEvent.click(screen.getByRole('button', {
            name: 'Open NgitiFy AI Care Companion',
        }));

        expect(screen.getByTestId('patient-ai-window').getAttribute('data-open')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));

        act(() => {
            jest.advanceTimersByTime(180);
        });

        expect(screen.getByRole('button', {
            name: 'Open NgitiFy AI Care Companion',
        })).not.toBeNull();
    });

    test('closes with Escape while preserving the mounted conversation window', () => {
        renderChat();

        fireEvent.click(screen.getByRole('button', {
            name: 'Open NgitiFy AI Care Companion',
        }));
        fireEvent.keyDown(window, { key: 'Escape' });

        expect(screen.getByTestId('patient-ai-window').getAttribute('data-open')).toBe('false');

        act(() => {
            jest.advanceTimersByTime(180);
        });

        expect(screen.getByTestId('patient-ai-window')).not.toBeNull();
    });

    test('opens in place when another patient control requests the assistant', () => {
        renderChat();

        act(() => {
            openPatientAiChat();
        });

        expect(screen.getByTestId('patient-ai-window').getAttribute('data-open')).toBe('true');
    });
});
