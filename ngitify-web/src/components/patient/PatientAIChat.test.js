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
        document.querySelectorAll('[data-ngitibot-avoid]').forEach((element) => element.remove());
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
            name: 'Open NgitiBot',
        }));

        expect(screen.getByTestId('patient-ai-window').getAttribute('data-open')).toBe('true');

        fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));

        act(() => {
            jest.advanceTimersByTime(180);
        });

        expect(screen.getByRole('button', {
            name: 'Open NgitiBot',
        })).not.toBeNull();
    });

    test('closes with Escape while preserving the mounted conversation window', () => {
        renderChat();

        fireEvent.click(screen.getByRole('button', {
            name: 'Open NgitiBot',
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

    test('moves the launcher above a marked lower-right action bar', () => {
        const actionBar = document.createElement('div');
        actionBar.setAttribute('data-ngitibot-avoid', '');
        actionBar.getBoundingClientRect = () => ({
            left: window.innerWidth - 200,
            right: window.innerWidth - 20,
            top: window.innerHeight - 80,
            bottom: window.innerHeight - 20,
            width: 180,
            height: 60,
        });
        document.body.appendChild(actionBar);

        renderChat();

        expect(screen.getByRole('button', { name: 'Open NgitiBot' }).style.getPropertyValue('--ngitibot-launcher-bottom'))
            .toBe('92px');
    });
});
