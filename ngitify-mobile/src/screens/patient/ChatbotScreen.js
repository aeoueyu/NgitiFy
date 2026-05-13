import React, { useContext, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

const INITIAL_MESSAGES = [
    {
        id: '1',
        text:
            "Hello! I'm NgitiBot, your AI dental assistant.\n\n" +
            "I can help you with:\n" +
            "- Dental care tips and advice\n" +
            "- Procedure information\n" +
            "- Preventive care guidance\n" +
            "- General post-op support\n" +
            "- Your current appointment details\n" +
            "- Available booking slots for your branch\n" +
            "- Dentime-approved routine dental information\n\n" +
            'You can also ask in English, Filipino, Tagalog, or Cebuano/Bisaya.\n\n' +
            'What can I help you with today?',
        sender: 'bot',
    },
];

const SUGGESTIONS = [
    'Do I have an active appointment?',
    'What slots are available tomorrow?',
    'When should I visit again?',
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeChatErrorMessage(error) {
    const rawMessage = String(error?.message || '').trim();

    if (rawMessage === 'AI features are not enabled.') {
        return 'NgitiBot is not enabled on the server right now. Please contact the clinic for help.';
    }

    if (rawMessage === 'Too many AI requests. Please wait before trying again.') {
        return 'NgitiBot is handling many requests right now. Please wait a bit, then try again.';
    }

    if (
        rawMessage === 'Token expired. Please log in again.' ||
        rawMessage === 'Invalid token.' ||
        rawMessage === 'Access denied. No token provided.'
    ) {
        return 'Your session expired. Please log in again, then try NgitiBot once more.';
    }

    return 'I am having trouble connecting right now. Please try again in a moment, or contact the clinic directly.';
}

export default function ChatbotScreen({ navigation }) {
    const { userToken, API_BASE_URL } = useContext(AuthContext);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isWaitingForReply, setIsWaitingForReply] = useState(false);
    const [isRevealingReply, setIsRevealingReply] = useState(false);
    const [visitPrediction, setVisitPrediction] = useState(null);
    const listRef = useRef(null);

    const isBusy = isWaitingForReply || isRevealingReply;

    useEffect(() => {
        let isMounted = true;

        const fetchVisitPrediction = async () => {
            if (!userToken) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/my/visit-prediction`, {
                    headers: { Authorization: `Bearer ${userToken}` },
                });

                if (!response.ok) return;

                const payload = await response.json();
                if (!isMounted) return;

                setVisitPrediction(payload?.prediction || null);
            } catch {
                if (isMounted) {
                    setVisitPrediction(null);
                }
            }
        };

        fetchVisitPrediction();

        return () => {
            isMounted = false;
        };
    }, [API_BASE_URL, userToken]);

    const scrollToBottom = () => {
        setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const buildConversationHistory = (conversation) =>
        conversation
            .filter((message) => message.sender === 'user' || (message.sender === 'bot' && message.id !== '1'))
            .slice(-10)
            .map((message) => ({
                role: message.sender === 'user' ? 'user' : 'assistant',
                content: message.text,
            }));

    const revealBotReply = async (fullText) => {
        const botId = `${Date.now()}-bot`;
        const replyText = String(fullText || '').trim() || 'Please contact the clinic for help.';

        setMessages((prev) => [...prev, { id: botId, text: '', sender: 'bot' }]);
        setIsRevealingReply(true);
        scrollToBottom();

        let visibleLength = 0;
        while (visibleLength < replyText.length) {
            const currentChar = replyText[visibleLength];
            let step = 1;
            let waitMs = 16;

            if (replyText.length > 220 && visibleLength > 120) {
                step = 2;
                waitMs = 10;
            }

            if (currentChar === ' ' && replyText.length - visibleLength > 40) {
                step = Math.max(step, 2);
                waitMs = 8;
            }

            if (currentChar === '\n') {
                waitMs = 22;
            } else if ('.!?'.includes(currentChar)) {
                waitMs = 42;
            } else if (',;:'.includes(currentChar)) {
                waitMs = 26;
            }

            visibleLength = Math.min(replyText.length, visibleLength + step);
            const nextText = replyText.slice(0, visibleLength);

            setMessages((prev) =>
                prev.map((message) =>
                    message.id === botId ? { ...message, text: nextText } : message
                )
            );

            scrollToBottom();

            if (visibleLength < replyText.length) {
                await delay(waitMs);
            }
        }

        setIsRevealingReply(false);
    };

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text || isBusy) return;

        const userMsg = { id: Date.now().toString(), text, sender: 'user' };
        const nextConversation = [...messages, userMsg];

        setMessages(nextConversation);
        setInputText('');
        setIsWaitingForReply(true);
        scrollToBottom();

        try {
            const history = buildConversationHistory(nextConversation);
            const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                body: JSON.stringify({
                    messages: history,
                    assistantContext: visitPrediction
                        ? {
                              patientVisitWindow: {
                                  status: visitPrediction.label,
                                  daysUntilWindow: visitPrediction.daysUntilWindowStart,
                                  nextDate:
                                      visitPrediction.recommendedDateLabel || visitPrediction.nextDate,
                                  windowStart: visitPrediction.windowStartLabel,
                                  windowEnd: visitPrediction.windowEndLabel,
                                  historyCount: visitPrediction.historyCount,
                                  lastVisitDate: visitPrediction.lastVisitDate,
                                  lastProcedure: visitPrediction.lastProcedure,
                                  recommendationReason: visitPrediction.recommendationReason,
                              },
                          }
                        : null,
                }),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data?.message || 'Network response was not ok');
            }

            setIsWaitingForReply(false);
            await revealBotReply(data?.reply);
        } catch (error) {
            setIsWaitingForReply(false);
            await revealBotReply(normalizeChatErrorMessage(error));
        } finally {
            setIsWaitingForReply(false);
            scrollToBottom();
        }
    };

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';

        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                {!isUser ? (
                    <View style={styles.botAvatar}>
                        <Text style={styles.botAvatarText}>N</Text>
                    </View>
                ) : null}
                <View style={[styles.bubbleContent, isUser ? styles.userContent : styles.botContent]}>
                    <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
                        {item.text}
                    </Text>
                </View>
            </View>
        );
    };

    const renderTypingIndicator = () => (
        <View style={[styles.messageBubble, styles.botBubble]}>
            <View style={styles.botAvatar}>
                <Text style={styles.botAvatarText}>N</Text>
            </View>
            <View style={[styles.bubbleContent, styles.botContent, styles.typingBubble]}>
                <ActivityIndicator size="small" color="#01538b" />
                <Text style={styles.typingText}>NgitiBot is typing...</Text>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}
                >
                    <BackIcon width={16} height={16} fill="#01538b" style={{ marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>NgitiBot</Text>
                    <View style={styles.onlineDot} />
                </View>
                <View style={{ width: 60 }} />
            </View>

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatContainer}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={scrollToBottom}
                ListFooterComponent={isWaitingForReply ? renderTypingIndicator : null}
            />

            {messages.length === 1 ? (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>Quick questions:</Text>
                    <View style={styles.suggestionsRow}>
                        {SUGGESTIONS.map((suggestion) => (
                            <TouchableOpacity
                                key={suggestion}
                                style={styles.suggestionChip}
                                onPress={() => setInputText(suggestion)}
                            >
                                <Text style={styles.suggestionText}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : null}

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.inputBox}
                    placeholder="Message NgitiBot..."
                    placeholderTextColor="#aaa"
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    editable={!isBusy}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!inputText.trim() || isBusy) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isBusy}
                >
                    <Text style={styles.sendBtnText}>
                        {isBusy ? 'Wait' : 'Send'}
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    header: {
        backgroundColor: 'white',
        padding: 20,
        paddingTop: mobilePageTopInset,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 3,
        zIndex: 10,
    },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerCenter: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b', marginRight: 6 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4caf50' },

    chatContainer: { padding: 15, paddingBottom: 24 },

    messageBubble: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
    userBubble: { justifyContent: 'flex-end' },
    botBubble: { justifyContent: 'flex-start' },

    botAvatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#01538b',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginBottom: 2,
    },
    botAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

    bubbleContent: { maxWidth: '75%', padding: 13, borderRadius: 18 },
    userContent: { backgroundColor: '#01538b', borderBottomRightRadius: 4, marginLeft: 'auto' },
    botContent: { backgroundColor: 'white', borderBottomLeftRadius: 4, elevation: 1 },
    typingBubble: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },

    messageText: { fontSize: 14, lineHeight: 20 },
    userText: { color: 'white' },
    botText: { color: '#333' },
    typingText: { color: '#888', marginLeft: 8, fontStyle: 'italic', fontSize: 13 },

    suggestionsContainer: { paddingHorizontal: 15, paddingBottom: 10 },
    suggestionsLabel: { fontSize: 11, color: '#aaa', marginBottom: 6 },
    suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    suggestionChip: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#01538b',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
        marginRight: 8,
        marginBottom: 6,
    },
    suggestionText: { color: '#01538b', fontSize: 12, fontWeight: '600' },

    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#eee',
        alignItems: 'center',
    },
    inputBox: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        fontSize: 14,
        marginRight: 10,
        color: '#333',
    },
    sendBtn: {
        backgroundColor: '#01538b',
        paddingVertical: 11,
        paddingHorizontal: 20,
        borderRadius: 25,
        minWidth: 82,
        alignItems: 'center',
    },
    sendBtnDisabled: { backgroundColor: '#b0bec5' },
    sendBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
