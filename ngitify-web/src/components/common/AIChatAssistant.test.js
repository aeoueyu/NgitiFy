import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIChatAssistant from './AIChatAssistant';
import { authFetch } from '../../utils/api';

jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'secretary' } }) }));
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/secretary/schedule' }) }), { virtual: true });
jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), BASE_URL: 'http://localhost:5000' }));

const okJson = (payload) => Promise.resolve({ ok: true, json: async () => payload });

beforeEach(() => {
    authFetch.mockImplementation(() => okJson({ conversations: [] }));
});

test('opens and closes the partial conversation history without closing chat', async () => {
    const onClose = jest.fn();
    render(<AIChatAssistant isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Open conversation history'));
    expect(await screen.findByLabelText('Conversation history')).not.toBeNull();
    fireEvent.click(screen.getByLabelText('Close history'));
    expect(screen.queryByLabelText('Conversation history')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
});

test('close X closes the assistant', async () => {
    const onClose = jest.fn();
    render(<AIChatAssistant isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close AI assistant'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(authFetch).toHaveBeenCalled());
});

test('secretary receives role-specific prompt suggestions', async () => {
    render(<AIChatAssistant isOpen onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: 'How do I register a new patient?' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'How do I update the tooth chart?' })).toBeNull();
});
