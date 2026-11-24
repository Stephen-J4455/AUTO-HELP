import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';

export default function StartupSplash() {
  const { width } = useWindowDimensions();
  const logoSize = Math.min(224, width * 0.65);

  return (
    <View accessible accessibilityLabel="Loading AUTO-HELP" style={styles.container}>
      <View style={[styles.logo, { width: logoSize, height: logoSize }]}>
        <Image
          source={require('../../assets/splash_icon.png')}
          // Frame the 1,200 × 1,200 region around the logo in the source image.
          style={[styles.logoImage, { width: logoSize * 5 / 3, height: logoSize * 5 / 3, left: -logoSize * 0.31, top: -logoSize * 0.33 }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    overflow: 'hidden',
  },
  logoImage: {
    position: 'absolute',
  },
});
