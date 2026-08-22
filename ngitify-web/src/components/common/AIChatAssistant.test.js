import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AIChatAssistant from './AIChatAssistant';
import { authFetch } from '../../utils/api';
import { TextDecoder } from 'util';

jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'secretary' } }) }));
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/secretary/schedule' }) }), { virtual: true });
jest.mock('../../utils/api', () => ({ authFetch: jest.fn(), BASE_URL: 'http://localhost:5000' }));

const okJson = (payload) => Promise.resolve({ ok: true, json: async () => payload });

beforeEach(() => {
    global.TextDecoder = TextDecoder;
    authFetch.mockImplementation(() => okJson({ conversations: [] }));
});

test('opens and closes the partial conversation history without closing chat', async () => {
    const onClose = jest.fn();
    render(<AIChatAssistant isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Open conversation history'));
    expect((await screen.findByLabelText('Conversation history')).className).toContain('patientAiConversationSidebarOpen');
    fireEvent.click(screen.getByLabelText('Close history'));
    expect(screen.getByLabelText('Conversation history').className).not.toContain('patientAiConversationSidebarOpen');
    expect(onClose).not.toHaveBeenCalled();
});

test('uses the patient NgitiBot close control', async () => {
    const onClose = jest.fn();
    render(<AIChatAssistant isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close NgitiBot'));
    expect(onClose).toHaveBeenCalledTimes(1);
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

test('sends staff messages through authenticated API streaming without crashing the UI', async () => {
    const streamChunks = [
        Buffer.from('data: {"text":"Role-safe reply"}\n\n'),
        Buffer.from('data: [DONE]\n\n'),
    ];
    authFetch.mockImplementation((endpoint, options = {}) => {
        if (endpoint === '/staff/ai/conversations' && options.method === 'POST') {
            return okJson({ conversation: { id: 'conversation-1' } });
        }
        if (endpoint === '/staff/ai/conversations/conversation-1/messages') {
            let index = 0;
            return Promise.resolve({
                ok: true,
                body: { getReader: () => ({ read: async () => index < streamChunks.length ? { done: false, value: streamChunks[index++] } : { done: true } }) },
                json: async () => ({}),
            });
        }
        return okJson({ conversations: [] });
    });
    render(<AIChatAssistant isOpen onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Message NgitiBot'), { target: { value: 'Help with scheduling' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Role-safe reply')).not.toBeNull();
    expect(authFetch).toHaveBeenCalledWith('/staff/ai/conversations/conversation-1/messages', expect.objectContaining({ method: 'POST' }));
});

test('does not treat the auto-scroll result as an effect cleanup function', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = jest.fn(() => ({ scrolled: true }));
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
        const { unmount } = render(<AIChatAssistant isOpen onClose={() => {}} />);
        expect(scrollIntoView).toHaveBeenCalled();
        expect(() => unmount()).not.toThrow();
    } finally {
        Element.prototype.scrollIntoView = originalScrollIntoView;
    }
});
