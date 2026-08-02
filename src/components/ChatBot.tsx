import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { sendChatMessage, ChatMessage } from '../utils/chatbot';

type Props = {
  visible: boolean;
  onClose: () => void;
  model?: string | null;
  systemPrompt?: string | null;
  storeName?: string | null;
};

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi! 👋 I'm the Auto Help GH assistant. Ask me about parts, categories, vehicle fitment or how to order.",
};

export default function ChatBot({ visible, onClose, model, systemPrompt, storeName }: Props) {
  const { colors } = useTheme();
  const [messages, setMessages] = React.useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<any>(null);

  // History is preserved across open/close — only a tap on the "new chat"
  // icon resets the conversation. We just make sure the list scrolls down.
  React.useEffect(() => {
    if (visible) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [visible]);

  const clearChat = () => {
    setMessages([GREETING]);
    setError(null);
    setInput('');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const reply = await sendChatMessage(
        next.filter((m) => m.role === 'user' || m.role === 'assistant') as ChatMessage[],
        { model, systemPrompt, storeName },
      );
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.background }]}>
          <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Assistant</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={clearChat} hitSlop={8} style={styles.headerActionBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={[styles.bubbleRow, isUser ? styles.rowUser : styles.rowBot]}>
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: isUser ? colors.primary : colors.surface,
                      borderColor: isUser ? colors.primary : colors.background,
                    },
                  ]}
                >
                  <Text style={[styles.bubbleText, { color: isUser ? colors.surface : colors.text }]}>
                    {item.content}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: `${colors.danger || '#B91C1C'}14` }]}>
            <Text style={[styles.errorText, { color: colors.danger || '#B91C1C' }]}>{error}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={10}
        >
          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.background }]}>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              multiline
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
              onPress={send}
              disabled={sending}
              hitSlop={6}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', marginLeft: 12, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionBtn: { padding: 4, marginRight: 4 },
  closeBtn: { padding: 4 },
  list: { padding: 16, gap: 10 },
  bubbleRow: { flexDirection: 'row' },
  rowUser: { justifyContent: 'flex-end' },
  rowBot: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  errorBox: { marginHorizontal: 16, padding: 10, borderRadius: 10, marginBottom: 8 },
  errorText: { fontSize: 13, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});