import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChallengeVisibilityContext } from '../features/challenge/visibility';

export default function ChallengeLink({ onPress }: { onPress: () => void }) {
  const { enabled } = useContext(ChallengeVisibilityContext);
  if (!enabled) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.banner, { opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.icon}><Ionicons name="trophy-outline" size={22} color="#ffdc9d" /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>Daily challenge</Text>
        <Text style={styles.subtitle}>Complete daily tasks to unlock prize spins.</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#ffdc9d" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#541229', borderRadius: 20, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { backgroundColor: '#783550', width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: '#fff7f8', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#f1c9d6', fontSize: 12, lineHeight: 17, marginTop: 2 },
});
