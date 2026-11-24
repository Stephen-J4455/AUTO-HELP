import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';

export default function LoadingScreen({ message }: { message?: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const logoSize = Math.min(224, width * 0.65);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.logo, { width: logoSize, height: logoSize }]}>
        <Image
          source={require('../../assets/splash_icon.png')}
          // Frame the 1,200 × 1,200 region around the logo in the source image.
          style={[styles.logoImage, { width: logoSize * 5 / 3, height: logoSize * 5 / 3, left: -logoSize * 0.31, top: -logoSize * 0.33 }]}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>AUTO HELP GH</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {message || 'Home of genuine parts'}
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
    borderRadius: 24,
    overflow: 'hidden',
  },
  logoImage: {
    position: 'absolute',
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
