import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar as RNStatusBar } from 'react-native';
import { dark } from '../theme';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    image: require("../../assets/onboarding/bmw1.jpg"),
    title: "Auto Parts, Simplified",
    subtitle: "Find parts fast, shop with confidence.",
  },
  {
    image: require("../../assets/onboarding/bmw2.jpg"),
    title: "OEM & Aftermarket",
    subtitle: "Compare genuine and compatible parts side-by-side.",
  },
  {
    image: require("../../assets/onboarding/bmw3.jpg"),
    title: "Detailed Fitment",
    subtitle: "Match parts to your exact vehicle model and year.",
  },
  {
    image: require("../../assets/onboarding/bmw4.jpg"),
    title: "Fast Delivery",
    subtitle: "Multiple shipping options to get you back on the road.",
  },
  {
    image: require("../../assets/onboarding/bmw5.jpg"),
    title: "Secure Checkout",
    subtitle: "Safe payments and a satisfaction guarantee.",
  },
];

type Props = {
  onFinish?: () => void;
};

export default function Onboarding({ onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const insets = useSafeAreaInsets();
  const colors = dark; // Force onboarding to always use dark theme (semantic keys)

  const handleScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / width);
    setIndex(i);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} >
      <RNStatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <View style={[styles.statusBarOverlay, { height: insets.top, backgroundColor: colors.surface }]} />
      <ScrollView
        ref={(r) => { scrollRef.current = r }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {slides.map((s, i) => (
          <ImageBackground key={i} source={s.image} style={styles.slide} resizeMode="cover">
            <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
            <View style={styles.content} pointerEvents="none">
              <Text style={[styles.title, { color: colors.text }]}>{s.title}</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>{s.subtitle}</Text>
            </View>
          </ImageBackground>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, index === i && { backgroundColor: colors.primary, width: 18, borderRadius: 9 }]} />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={() => {
            if (index === slides.length - 1) {
              onFinish ? onFinish() : null;
            } else {
              scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
            }
          }}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>{index === slides.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // This will be set dynamically
  },
  slide: {
    width,
    height,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 160,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  statusBarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 6,
  },
  button: {
    paddingHorizontal: 34,
    paddingVertical: 12,
    borderRadius: 28,
    elevation: 2,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
