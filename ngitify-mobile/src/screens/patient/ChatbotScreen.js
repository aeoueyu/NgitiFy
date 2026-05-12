import React, { useState, useRef, useContext, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import BackIcon from '../../assets/icons/Back.svg';
import { mobilePageTopInset } from '../../components/mobile/MobileUI';

const INITIAL_MESSAGES = [
    {
        id: '1',
        text: 'Hello! I\'m NgitiBot, your AI dental assistant 🦷\n\nI can help you with:\n• Dental care tips & advice\n• Procedure information\n• Clinic FAQs (hours, location, pricing)\n• Pre- and post-op guidance\n\nWhat can I help you with today?',
        sender: 'bot'
    },
];

// ← REMOVED: const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000'
//   This was a hardcoded IP that bypassed AuthContext entirely. Any device not on
//   that exact local network would silently fail. Now uses API_BASE_URL from AuthContext.

export default function ChatbotScreen({ navigation }) {
    const { userToken, API_BASE_URL } = useContext(AuthContext); // ← API_BASE_URL added
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [visitPrediction, setVisitPrediction] = useState(null);
    const listRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const fetchVisitPrediction = async () => {
            if (!userToken) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/my/visit-prediction`, {
                    headers: { Authorization: `Bearer ${userToken}` }
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

    const buildConversationHistory = (conversation) => conversation
        .filter(message => message.sender === 'user' || (message.sender === 'bot' && message.id !== '1'))
        .slice(-10)
        .map(message => ({
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: message.text
        }));

    const handleSend = async () => {
        const text = inputText.trim();
        if (!text) return;

        const userMsg = { id: Date.now().toString(), text, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsTyping(true);
        scrollToBottom();

        try {
            const history = buildConversationHistory([...messages, userMsg]);

            // ← was: `${API_URL}/api/chatbot/message`
            const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    messages: history,
                    assistantContext: visitPrediction
                        ? {
                            patientVisitWindow: {
                                status: visitPrediction.label,
                                daysUntilWindow: visitPrediction.daysUntilWindowStart,
                                nextDate: visitPrediction.recommendedDateLabel || visitPrediction.nextDate,
                                windowStart: visitPrediction.windowStartLabel,
                                windowEnd: visitPrediction.windowEndLabel,
                                historyCount: visitPrediction.historyCount,
                                lastVisitDate: visitPrediction.lastVisitDate,
                                lastProcedure: visitPrediction.lastProcedure,
                                recommendationReason: visitPrediction.recommendationReason,
                            }
                        }
                        : null
                })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const botMsg = {
                id: (Date.now() + 1).toString(),
                text: data.reply,
                sender: 'bot'
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (err) {
            const fallbackMsg = {
                id: (Date.now() + 1).toString(),
                text: "I'm having trouble connecting right now. Please try again in a moment, or contact us directly at the clinic. 😊",
                sender: 'bot'
            };
            setMessages(prev => [...prev, fallbackMsg]);
        } finally {
            setIsTyping(false);
            scrollToBottom();
        }
    };

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                {!isUser && (
                    <View style={styles.botAvatar}>
                        <Text style={styles.botAvatarText}>N</Text>
                    </View>
                )}
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
                <Text style={styles.typingText}>NgitiBot is typing…</Text>
            </View>
        </View>
    );

    const SUGGESTIONS = [
        'What are your clinic hours?',
        'How do I prepare for tooth extraction?',
        'How often should I visit the dentist?',
    ];

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {/* Header */}
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

            {/* Chat List */}
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatContainer}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={scrollToBottom}
                ListFooterComponent={isTyping ? renderTypingIndicator : null}
            />

            {/* Suggestion Chips */}
            {messages.length === 1 && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>Quick questions:</Text>
                    <View style={styles.suggestionsRow}>
                        {SUGGESTIONS.map((s, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.suggestionChip}
                                onPress={() => setInputText(s)}
                            >
                                <Text style={styles.suggestionText}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Input Bar */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.inputBox}
                    placeholder="Message NgitiBot..."
                    placeholderTextColor="#aaa"
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    editable={!isTyping}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isTyping}
                >
                    <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },

    header: {
        backgroundColor: 'white', padding: 20, paddingTop: mobilePageTopInset,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        elevation: 3, zIndex: 10
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
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: '#01538b', alignItems: 'center', justifyContent: 'center',
        marginRight: 8, marginBottom: 2
    },
    botAvatarText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

    bubbleContent: { maxWidth: '75%', padding: 13, borderRadius: 18 },
    userContent: { backgroundColor: '#01538b', borderBottomRightRadius: 4 },
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
        backgroundColor: 'white', borderWidth: 1, borderColor: '#01538b',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
        marginRight: 8, marginBottom: 6
    },
    suggestionText: { color: '#01538b', fontSize: 12, fontWeight: '600' },

    inputContainer: {
        flexDirection: 'row', padding: 12, backgroundColor: 'white',
        borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center'
    },
    inputBox: {
        flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 16,
        paddingVertical: 11, borderRadius: 25, borderWidth: 1,
        borderColor: '#e0e0e0', fontSize: 14, marginRight: 10, color: '#333'
    },
    sendBtn: { backgroundColor: '#01538b', paddingVertical: 11, paddingHorizontal: 20, borderRadius: 25 },
    sendBtnDisabled: { backgroundColor: '#b0bec5' },
    sendBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
});
