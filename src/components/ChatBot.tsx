import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { CANVAS_SECTIONS, Canvas, CanvasSection, ChatMessage, replyFlow, sendChatMessage } from '../utils/chatbot';
import AutobotCanvas from './AutobotCanvas';

const SUGGESTIONS = [
  { title: 'Find a part', detail: 'Part name, brand or SKU', icon: 'search-outline', prompt: 'Find this part: ' },
  { title: 'Check fitment', detail: 'Year, make and model', icon: 'car-sport-outline', prompt: 'Check fitment for my ' },
  { title: 'Delivery options', detail: 'Where Auto Help delivers', icon: 'bus-outline', prompt: 'Where do you deliver?' },
  { title: 'How to order', detail: 'From part selection to checkout', icon: 'bag-check-outline', prompt: 'How do I place an order?' },
] as const;

const EMPTY_CANVAS: Canvas = { order: [...CANVAS_SECTIONS], products: [] };
type ConversationMessage = ChatMessage & { canvas?: Canvas };

export default function ChatBot({ navigateTo }: { navigateTo: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [arranging, setArranging] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToQuestion = useRef(false);
  const inFlight = useRef(false);
  const canSend = !!input.trim() && !sending;
  const workspace = messages.filter(({ canvas }) => canvas).at(-1)?.canvas ?? EMPTY_CANVAS;
  const latest = messages.at(-1);
  const latestFlow = latest?.role === 'assistant' ? replyFlow(latest.content, latest.canvas) : [];
  const displayedProducts = new Set(latestFlow.flatMap(block => block.kind === 'text' ? [] : [block.productId]));
  const canArrange = latestFlow.length > 1 && displayedProducts.size === 1;
  const hasConversation = messages.length > 0;

  function clearChat() {
    setMessages([]);
    setSelected(null);
    setArranging(false);
    scrollToQuestion.current = false;
    setError('');
    setInput('');
  }

  async function send() {
    const text = input.trim();
    if (!text || inFlight.current) return;
    const next: ConversationMessage[] = [...messages, { role: 'user', content: text }];
    inFlight.current = true;
    scrollToQuestion.current = true;
    setMessages(next);
    setInput('');
    setError('');
    setSending(true);
    setArranging(false);
    try {
      const { reply, canvas } = await sendChatMessage(next, workspace, selected ?? workspace.products[0]?.id, webSearch);
      if (canvas && !canvas.products.some(({ id }) => id === selected)) {
        setSelected(null);
      }
      setMessages([...next, { role: 'assistant', content: reply, canvas }]);
    } catch (failure) {
      setMessages(messages);
      setInput(text);
      setError((failure as Error).message || 'Couldn’t complete the request.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function moveBlock(index: number, offset: -1 | 1) {
    setMessages((previous) => {
      const message = previous.at(-1);
      if (message?.role !== 'assistant' || !message.canvas) return previous;
      const flow = [...replyFlow(message.content, message.canvas)];
      const sibling = index + offset;
      if (!flow[index] || !flow[sibling]) return previous;
      [flow[index], flow[sibling]] = [flow[sibling], flow[index]];
      const order = [...new Set<CanvasSection>([
        ...flow.map(({ kind }) => kind === 'text' ? 'answer' as const : kind),
        ...message.canvas.order,
      ])];
      return [...previous.slice(0, -1), { ...message, canvas: { ...message.canvas, flow, order } }];
    });
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={10}>
        <View style={styles.header}>
          <View style={[styles.mark, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="construct-outline" size={19} color={colors.primary} />
          </View>
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.text }]}>Autobot</Text>
          {hasConversation && (
            <>
              {canArrange && (
                <Pressable accessibilityRole="button" accessibilityLabel="Arrange latest reply" aria-selected={arranging}
                  onPress={() => setArranging(!arranging)} disabled={sending}
                  style={[styles.headerAction, { borderColor: arranging ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
                  <Ionicons name="swap-vertical" size={19} color={arranging ? colors.primary : colors.text} />
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="New conversation" onPress={clearChat} disabled={sending}
                style={[styles.headerAction, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Ionicons name="create-outline" size={19} color={colors.text} />
              </Pressable>
            </>
          )}
        </View>

        <ScrollView ref={scrollRef} style={styles.flex} keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!scrollToQuestion.current) return;
            scrollToQuestion.current = false;
            scrollRef.current?.scrollToEnd({ animated: false });
          }}
          contentContainerStyle={[styles.body, !hasConversation && styles.welcomeBody]}>
          {!hasConversation ? (
            <View>
              <Text accessibilityRole="header" style={[styles.headline, { color: colors.text }]}>What are you{'\n'}<Text style={{ color: colors.primary }}>working on?</Text></Text>
              <View style={styles.suggestionGrid}>
                {SUGGESTIONS.map(({ title, detail, icon, prompt }, index) => {
                  const reverse = index % 2 === 1;
                  return (
                    <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail}
                      onPress={() => { setInput(prompt); inputRef.current?.focus(); }}
                      style={({ pressed }) => [styles.suggestion, { backgroundColor: colors.surface, opacity: pressed ? 0.72 : 1 }]}>
                      <View pointerEvents="none" style={[styles.cutout, styles.cutoutTop, reverse ? styles.cutoutLeft : styles.cutoutRight, { backgroundColor: colors.background }]} />
                      <View pointerEvents="none" style={[styles.cutout, styles.cutoutBottom, reverse ? styles.cutoutRight : styles.cutoutLeft, { backgroundColor: colors.background }]} />
                      <Ionicons name={icon} size={24} color={colors.primary} />
                      <View style={styles.suggestionCopy}>
                        <Text style={[styles.suggestionTitle, { color: colors.text }]}>{title}</Text>
                        <Text style={[styles.suggestionDetail, { color: colors.muted }]}>{detail}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              {messages.map(({ role, content, canvas }, index) => role === 'user' ? (
                <Text key={index} style={[styles.question, index > 0 && styles.followUp, { color: colors.text }]}>{content}</Text>
              ) : (
                <AutobotCanvas key={index} blocks={replyFlow(content, canvas)} products={canvas?.products ?? []}
                  onMove={arranging && index === messages.length - 1 ? moveBlock : undefined}
                  onOpenPart={(id) => { setSelected(id); navigateTo('ProductDetails', { productId: id }); }} />
              ))}
              {sending && <Text accessibilityLiveRegion="polite" style={[styles.progress, { color: colors.muted }]}>Working on your request…</Text>}
            </>
          )}
        </ScrollView>

        {!!error && <Text accessibilityLiveRegion="assertive" style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <View style={styles.inputBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search the web" accessibilityState={{ selected: webSearch }}
            onPress={() => setWebSearch(!webSearch)} disabled={sending}
            style={[styles.webButton, { backgroundColor: webSearch ? colors.primary : colors.surface, borderColor: webSearch ? colors.primary : colors.border }]}>
            <Ionicons name="globe-outline" size={22} color={webSearch ? '#fff' : colors.accentText} />
          </Pressable>
          <TextInput
            ref={inputRef}
            accessibilityLabel="Message the AI assistant"
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder={hasConversation ? 'Ask a follow-up or move a section…' : 'Ask about a part…'}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={1800}
            editable={!sending}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!canSend} onPress={() => void send()}
            style={[styles.send, { backgroundColor: canSend || sending ? colors.primary : colors.surface, borderColor: canSend || sending ? colors.primary : colors.border }]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={23} color={canSend ? '#fff' : colors.muted} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 60 },
  mark: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', flex: 1 },
  headerAction: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { width: '100%', paddingVertical: 16, gap: 12 },
  welcomeBody: { maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, flexGrow: 1, justifyContent: 'center' },
  headline: { fontSize: 35, lineHeight: 38, letterSpacing: -1.3, fontWeight: '900', marginBottom: 22 },
  suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  suggestion: { overflow: 'hidden', minWidth: 0, minHeight: 146, flexBasis: '46%', flexGrow: 1, padding: 17, gap: 10, borderRadius: 18, justifyContent: 'space-between' },
  cutout: { position: 'absolute', width: 46, height: 46, borderRadius: 23 },
  cutoutTop: { top: -18 },
  cutoutBottom: { bottom: -18 },
  cutoutLeft: { left: -18 },
  cutoutRight: { right: -18 },
  suggestionCopy: { paddingBottom: 4, paddingHorizontal: 4, gap: 5 },
  suggestionTitle: { fontSize: 16, fontWeight: '900' },
  suggestionDetail: { fontSize: 12, lineHeight: 17 },
  question: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3, marginBottom: 4, marginHorizontal: 16 },
  followUp: { marginTop: 18 },
  progress: { fontSize: 14, lineHeight: 20, marginHorizontal: 16 },
  error: { fontSize: 13, marginHorizontal: 16, paddingTop: 8 },
  webButton: { width: 44, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, borderWidth: 1, borderRadius: 16 },
  send: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
