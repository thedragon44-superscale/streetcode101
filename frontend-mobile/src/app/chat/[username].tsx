import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE = "https://streetcode101.com/api";
const WS_BASE = "wss://streetcode101.com/api/ws/chat";

export default function ChatScreen() {
  const { username } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout;

    const initializeChat = async () => {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      // Decode JWT safely in React Native to get own username
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setMyUsername(payload.sub);
      } catch (e) {
        console.error("Failed to parse token payload");
      }

      // 1. Fetch History
      try {
        const res = await fetch(`${API_BASE}/messages/${username}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setMessages(data);
        }
      } catch (err) {
        console.error("Failed to fetch message history", err);
      } finally {
        if (isMounted) setLoading(false);
      }

      // 2. Connect WebSocket
      const connectWebSocket = () => {
        if (!isMounted) return;
        const socket = new WebSocket(`${WS_BASE}/${token}`);
        ws.current = socket;

        socket.onmessage = (event) => {
          const newMsg = JSON.parse(event.data);
          if (newMsg.sender === username || newMsg.receiver === username) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        };

        socket.onclose = () => {
          if (isMounted) {
            console.warn('WebSocket disconnected. Attempting reconnect...');
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
          }
        };
      };

      connectWebSocket();
    };

    initializeChat();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.onclose = null;
        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.close();
        }
      }
    };
  }, [username]);

  const sendMessage = () => {
    if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    ws.current.send(JSON.stringify({
      receiver: username,
      text: input
    }));
    setInput('');
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === myUsername;
    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{item.text}</Text>
          <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextThem]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Custom Chat Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        {/* Explicitly route back to the inbox instead of relying on stack history */}
        <TouchableOpacity onPress={() => router.push('/inbox')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{String(username).charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.headerUsername}>@{username}</Text>
            <View style={styles.secureTag}>
              <Ionicons name="lock-closed" size={10} color="#06b6d4" />
              <Text style={styles.secureText}>E2EE SECURED</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat History */}
      {loading ? (
        <ActivityIndicator size="large" color="#06b6d4" style={styles.loader} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id?.toString() || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No secure history with @{username}. Start the transmission.</Text>
          }
        />
      )}

      {/* Input Area */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Transmit secure payload..."
          placeholderTextColor="#64748b"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Ionicons name="send" size={18} color="white" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', paddingHorizontal: 10, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { padding: 5, marginRight: 10 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  avatarMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: '#334155' },
  avatarMiniText: { color: '#94a3b8', fontWeight: '900', fontSize: 16 },
  headerUsername: { color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  secureTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secureText: { color: '#06b6d4', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatList: { padding: 15, paddingBottom: 20 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 40, fontWeight: '500', fontSize: 13 },
  messageWrapper: { marginBottom: 15, flexDirection: 'row' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  messageBubbleMe: { backgroundColor: '#0891b2', borderBottomRightRadius: 4 },
  messageBubbleThem: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#334155' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextMe: { color: 'white' },
  messageTextThem: { color: '#e2e8f0' },
  timeText: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  timeTextMe: { color: '#cffafe' },
  timeTextThem: { color: '#64748b' },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: '#020617', borderTopWidth: 1, borderTopColor: '#1e293b', alignItems: 'center' },
  textInput: { flex: 1, backgroundColor: '#1e293b', color: 'white', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 24, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0891b2', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendButtonDisabled: { backgroundColor: '#334155' }
});
