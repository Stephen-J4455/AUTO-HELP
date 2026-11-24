import React, { useRef, useState } from 'react';
import { FlatList, ImageBackground, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useReduceMotion } from '../utils/useReduceMotion';

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
  const [heroHeight, setHeroHeight] = useState(1);
  const list = useRef<FlatList<(typeof slides)[number]>>(null);
  const { width } = useWindowDimensions();
  const reducedMotion = useReduceMotion();
  const last = index === slides.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.hero} onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}>
        <FlatList
          ref={list}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialNumToRender={2}
          windowSize={3}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          keyExtractor={(slide) => slide.title}
          onMomentumScrollEnd={({ nativeEvent }) => setIndex(Math.min(slides.length - 1, Math.max(0, Math.round(nativeEvent.contentOffset.x / width))))}
          renderItem={({ item }) => (
            <ImageBackground source={item.image} style={[styles.slide, { width, height: heroHeight }]} resizeMode="cover">
              <View style={styles.overlay} />
              <View style={styles.copy}>
                <Text accessibilityRole="header" style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </View>
            </ImageBackground>
          )}
        />
      </View>
      <View style={styles.footer}>
        <View style={styles.pagination} accessible accessibilityLabel={`Page ${index + 1} of ${slides.length}`}>
          {slides.map((slide, itemIndex) => (
            <View key={slide.title} style={[styles.dot, index === itemIndex && styles.activeDot]} />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}
          onPress={() => {
            if (last) onFinish?.();
            else {
              list.current?.scrollToOffset({ offset: (index + 1) * width, animated: !reducedMotion });
              setIndex(index + 1);
            }
          }}
        >
          <Text style={styles.buttonText}>{last ? 'Get started' : 'Next'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#20151b' },
  hero: { flex: 1 },
  slide: { justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(22,13,18,0.42)' },
  copy: { paddingHorizontal: 24, paddingBottom: 28, gap: 8 },
  title: { fontSize: 34, color: '#fff7f8', fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { fontSize: 16, lineHeight: 22, color: '#fff0f4' },
  footer: { padding: 18, gap: 14 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 6, backgroundColor: '#755b69' },
  activeDot: { width: 21, backgroundColor: '#ffd2de' },
  button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16, backgroundColor: '#a32a4a', alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '800', fontSize: 16, color: '#fff' },
});
