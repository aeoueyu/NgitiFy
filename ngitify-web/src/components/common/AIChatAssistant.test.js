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

test('close and minimize controls close the floating inbox', async () => {
    const onClose = jest.fn();
    render(<AIChatAssistant isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Minimize NgitiBot'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByLabelText('Close NgitiBot'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(authFetch).toHaveBeenCalled());
});

test('secretary receives role-specific prompt suggestions', async () => {
    render(<AIChatAssistant isOpen onClose={() => {}} />);
    expect(await screen.findByRole('button', { name: 'How do I register a new patient?' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'How do I update the tooth chart?' })).toBeNull();
});

test('conversation history remains mounted across minimize and reopen', async () => {
    authFetch.mockImplementation((endpoint) => {
        if (endpoint === '/staff/ai/conversations/saved-1') {
            return okJson({ conversation: { id: 'saved-1', messages: [{ id: 'm-1', role: 'assistant', content: 'Saved role-safe context' }] } });
        }
        return okJson({ conversations: [{ id: 'saved-1', title: 'Saved chat', isPinned: false }] });
    });
    const { rerender } = render(<AIChatAssistant isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText('Open conversation history'));
    fireEvent.click(await screen.findByRole('button', { name: /saved chat/i }));
    expect(await screen.findByText('Saved role-safe context')).not.toBeNull();

    rerender(<AIChatAssistant isOpen={false} onClose={() => {}} />);
    rerender(<AIChatAssistant isOpen onClose={() => {}} />);
    expect(await screen.findByText('Saved role-safe context')).not.toBeNull();
});
