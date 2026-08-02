import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import ChatBot from './ChatBot';
import { useStoreSettings } from '../utils/remoteContent';

// Floating "AI assistant" button + chat modal for the main app. Visibility and
// model configuration come entirely from the admin `store_settings` table.
// The FAB sits fixed at the bottom-right, just above the bottom nav bar.
export default function ChatBotLauncher() {
  const { colors } = useTheme();
  const { settings } = useStoreSettings();
  const [open, setOpen] = React.useState(false);

  if (!settings.chatbot_enabled) return null;

  return (
    <>
      <View style={styles.fabWrap}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, shadowColor: '#000' }]}
          activeOpacity={0.85}
          onPress={() => setOpen(true)}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <ChatBot
        visible={open}
        onClose={() => setOpen(false)}
        model={settings.chatbot_model}
        systemPrompt={settings.chatbot_system_prompt}
        storeName="Auto Help GH"
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Fixed at the bottom-right, above the bottom navigation bar.
  fabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    zIndex: 60,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
