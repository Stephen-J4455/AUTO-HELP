import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export default function PageHeader({ title, subtitle, onBack, children }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.65 : 1 }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 23, fontWeight: '800', letterSpacing: -0.55 },
  subtitle: { marginTop: 2, fontSize: 13, lineHeight: 18 },
});
