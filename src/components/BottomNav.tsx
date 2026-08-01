import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useCart } from '../context/Cart';
import { StickyAdFooter, ScreenAds } from '../utils/remoteContent';

type Route = {
  key: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
};

export default function BottomNav({ routes, navigation }: { routes: Route[]; navigation?: any }) {
  const [active, setActive] = useState(routes[0]?.key || '');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum, it) => sum + (it.quantity || 0), 0);

  // One animated value per tab drives the active/inactive transition. Created
  // once (keyed on the stable set of route keys) so animation state persists.
  const routeKeys = routes.map((r) => r.key).join('|');
  const anims = React.useMemo(() => {
    const map: Record<string, Animated.Value> = {};
    const initial = active || routes[0]?.key;
    routes.forEach((r) => {
      map[r.key] = new Animated.Value(r.key === initial ? 1 : 0);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKeys]);

  React.useEffect(() => {
    routes.forEach((r) => {
      const v = anims[r.key];
      if (!v) return;
      Animated.timing(v, {
        toValue: r.key === active ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [active, routes, anims]);

  React.useEffect(() => {
    const targetTab = route?.params?.tab;
    if (typeof targetTab === 'string' && routes.some((route) => route.key === targetTab)) {
      setActive(targetTab);
      navigation?.setParams?.({ tab: undefined });
    }
  }, [navigation, route?.params?.tab, routes]);

  const navigateTo = (name: string, params?: any) => {
    if (name === 'Main' || routes.find((r) => r.key === name)) {
      // internal tab switch
      setActive(name);
      return;
    }
    navigation?.navigate(name, params);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {routes.map((r) => (
          <View
            key={r.key}
            style={{ flex: 1, display: active === r.key ? 'flex' : 'none' }}
          >
            {React.createElement(r.component, { navigateTo })}
          </View>
        ))}
      </View>

      <ScreenAds screen={active} />
      <StickyAdFooter />

      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.background,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View style={styles.tabsRow}>
          {routes.map((r) => {
            const isActive = active === r.key;
            const showBadge = r.key === 'cart' && cartCount > 0;
            const v = anims[r.key] || new Animated.Value(0);
            // Animate opacity + scale for the fill (avoids color interpolation,
            // which can throw on some RN versions).
            const chipOpacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
            const chipScale = v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
            const labelScale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => setActive(r.key)}
                activeOpacity={0.7}
                style={styles.tab}
              >
                <View style={styles.iconWrap}>
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: colors.primary,
                        opacity: chipOpacity,
                        transform: [{ scale: chipScale }],
                        borderRadius: 16,
                      },
                    ]}
                  />
                  <Animated.View style={{ transform: [{ scale: chipScale }] }}>
                    <Ionicons
                      name={r.icon as any}
                      size={20}
                      color={isActive ? '#fff' : colors.muted}
                    />
                  </Animated.View>
                  {showBadge ? (
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isActive ? '#fff' : colors.primary,
                          borderColor: isActive ? colors.primary : colors.background,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: isActive ? colors.primary : '#fff' },
                        ]}
                      >
                        {cartCount > 99 ? '99+' : String(cartCount)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Animated.Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? colors.primary : colors.muted,
                      fontWeight: isActive ? '900' : '700',
                      transform: [{ scale: labelScale }],
                    },
                  ]}
                >
                  {r.label}
                </Animated.Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  bar: {
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  // Pill-shaped (fully rounded) chip behind the icon; fills with the primary
  // color when active and animates in/out on tab change.
  iconWrap: {
    position: 'relative',
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  badgeText: { fontSize: 10, fontWeight: '900' },
  tabLabel: {
    fontSize: 11,
  },
});