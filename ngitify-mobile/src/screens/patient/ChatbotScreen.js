import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import BackIcon from '../../assets/icons/Back.svg';

const INITIAL_MESSAGES = [
    { id: '1', text: 'Hello! I am NgitiBot. How can I help you today?', sender: 'bot' },
    { id: '2', text: 'Hi! I want to know the clinic hours.', sender: 'user' },
    { id: '3', text: 'Our clinic is open from Monday to Saturday, 9:00 AM to 5:00 PM. Would you like to schedule an appointment?', sender: 'bot' }
];

export default function ChatbotScreen({ navigation }) {
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [inputText, setInputText] = useState('');

    const handleSend = () => {
        if (inputText.trim() === '') return;

        const newUserMsg = { id: Date.now().toString(), text: inputText, sender: 'user' };
        setMessages(prev => [...prev, newUserMsg]);
        setInputText('');

        setTimeout(() => {
            const newBotMsg = { 
                id: (Date.now() + 1).toString(), 
                text: "I'm a sample bot! I can't fully answer that right now, but our secretary will get back to you.", 
                sender: 'bot' 
            };
            setMessages(prev => [...prev, newBotMsg]);
        }, 1000);
    };

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.botText]}>
                    {item.text}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { flexDirection: 'row', alignItems: 'center' }]}>
                    <BackIcon width={16} height={16} style={{ color: '#01538b', marginRight: 5 }} />
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Chat with NgitiBot</Text>
                <View style={{width: 60}} />
            </View>

            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.chatContainer}
                showsVerticalScrollIndicator={false}
            />

            <View style={styles.inputContainer}>
                <TextInput 
                    style={styles.inputBox}
                    placeholder="Type a message..."
                    value={inputText}
                    onChangeText={setInputText}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                    <Text style={styles.sendBtnText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f7f9' },
    header: { backgroundColor: 'white', padding: 20, paddingTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 3, zIndex: 10 },
    backBtn: { padding: 5, width: 60 },
    backText: { color: '#01538b', fontWeight: 'bold', fontSize: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#01538b' },
    
    chatContainer: { padding: 20, paddingBottom: 10 },
    
    messageBubble: { maxWidth: '80%', padding: 15, borderRadius: 20, marginBottom: 15 },
    userBubble: { backgroundColor: '#01538b', alignSelf: 'flex-end', borderBottomRightRadius: 5 },
    botBubble: { backgroundColor: 'white', alignSelf: 'flex-start', borderBottomLeftRadius: 5, elevation: 1 },
    
    userText: { color: 'white', fontSize: 14 },
    botText: { color: '#333', fontSize: 14 },

    inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee', alignItems: 'center' },
    inputBox: { flex: 1, backgroundColor: '#f9f9f9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: '#ddd', fontSize: 14, marginRight: 10 },
    sendBtn: { backgroundColor: '#01538b', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25 },
    sendBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 }
});