import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/**
 * Shared app-loading / splash screen. This is the exact same visual used when
 * the app starts up (see App.tsx), so tapping "version" on the account screen
 * shows an identical animation rather than a different one.
 */
export default function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require('../../assets/icon.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.title, { color: colors.text }]}>AUTO HELP GH</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Home of genuine parts
      </Text>
      <ActivityIndicator style={styles.spinner} color={colors.primary} size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 18,
  },
  spinner: {
    marginTop: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
});