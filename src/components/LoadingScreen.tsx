import React from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export default function LoadingScreen() {
  const { colors } = useTheme();
  const spin = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const scale = pulse.interpolate({
    inputRange: [0.4, 1],
    outputRange: [0.96, 1.04],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.brandRow, { backgroundColor: colors.surface }]}>
        <Text style={[styles.brand, { color: colors.text }]}>AUTO HELP</Text>
        <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.brandBadgeText}>GH</Text>
        </View>
      </View>

      <View style={styles.logoWrap}>
        <Animated.View
          style={[
            styles.ring,
            { borderColor: `${colors.primary}33`, borderTopColor: colors.primary, transform: [{ rotate }] },
          ]}
        />
        <Animated.View
          style={[
            styles.innerGlow,
            { backgroundColor: `${colors.primary}20`, transform: [{ scale }] },
          ]}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>AUTO HELP GH</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        Trusted auto parts marketplace
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: `${colors.primary}1F` }]}>
        <Animated.View
          style={[styles.progressBar, { backgroundColor: colors.primary, transform: [{ scaleX: pulse }] }]}
        />
      </View>
      <Text style={[styles.loadingText, { color: colors.muted }]}>Loading app…</Text>
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
  brandRow: {
    position: 'absolute',
    top: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  brandBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 4,
  },
  innerGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 50,
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
  progressTrack: {
    width: '70%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    borderRadius: 3,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});