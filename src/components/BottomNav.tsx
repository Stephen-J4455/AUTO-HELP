import React, { useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
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
  getComponent: () => React.ComponentType<any>;
};

export default function BottomNav({
  routes,
  navigation,
  active: activeProp,
  onActiveChange,
  onHomeReady,
  reducedMotion,
}: {
  routes: Route[];
  navigation?: any;
  active?: string;
  onActiveChange?: (key: string) => void;
  onHomeReady?: () => void;
  reducedMotion: boolean;
}) {
  const [internalActive, setInternalActive] = useState(routes[0]?.key || '');
  const active = activeProp ?? internalActive;
  const [loadedTabs, setLoadedTabs] = useState(() => new Set([active]));
  const setActive = React.useCallback((key: string) => {
    if (onActiveChange) onActiveChange(key);
    else setInternalActive(key);
  }, [onActiveChange]);
  const pageOpacity = React.useRef(new Animated.Value(1)).current;
  const previousActive = React.useRef(active);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum, it) => sum + (it.quantity || 0), 0);

  React.useLayoutEffect(() => {
    setLoadedTabs((previous) => previous.has(active) ? previous : new Set(previous).add(active));
    const changed = previousActive.current !== active;
    previousActive.current = active;
    if (reducedMotion || !changed) {
      pageOpacity.setValue(1);
      return;
    }
    pageOpacity.setValue(0.5);
    const transition = Animated.timing(pageOpacity, {
      toValue: 1,
      duration: 145,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    transition.start();
    return () => transition.stop();
  }, [active, pageOpacity, reducedMotion]);

  React.useEffect(() => {
    const targetTab = route?.params?.tab;
    if (typeof targetTab === 'string' && routes.some((entry) => entry.key === targetTab)) {
      setActive(targetTab);
      navigation?.setParams?.({ tab: undefined });
    }
  }, [navigation, route?.params?.tab, routes, setActive]);

  const navigateTo = React.useCallback((name: string, params?: any) => {
    if (routes.some((entry) => entry.key === name)) setActive(name);
    else navigation?.navigate(name, params);
  }, [navigation, routes, setActive]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.content, { opacity: pageOpacity }]}>
        {routes.map((entry) => (
          (active === entry.key || loadedTabs.has(entry.key)) ? (
            <TabPane key={entry.key} route={entry} visible={active === entry.key} navigateTo={navigateTo}
              onReady={entry.key === 'home' ? onHomeReady : undefined} />
          ) : null
        ))}
      </Animated.View>

      <ScreenAds screen={active} />
      <StickyAdFooter />

      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 4),
            paddingLeft: Math.max(insets.left, 4),
            paddingRight: Math.max(insets.right, 4),
          },
        ]}
      >
        <View style={styles.tabsRow}>
          {routes.map((r) => {
            const isActive = active === r.key;
            const showBadge = r.key === 'cart' && cartCount > 0;
            return (
              <Pressable
                key={r.key}
                accessibilityRole="tab"
                aria-selected={isActive}
                accessibilityLabel={showBadge ? `${r.label}, ${cartCount} items` : r.label}
                onPress={() => setActive(r.key)}
                style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.68 : 1 }]}
              >
                <View style={styles.iconWrap}>
                  {isActive && <View pointerEvents="none" style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
                  <Ionicons name={r.icon as any} size={20} color={isActive ? '#fff' : colors.muted} />
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
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? colors.primary : colors.muted,
                      fontWeight: isActive ? '900' : '700',
                    },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const TabPane = React.memo(function TabPane({ route, visible, navigateTo, onReady }: {
  route: Route;
  visible: boolean;
  navigateTo: (name: string, params?: any) => void;
  onReady?: () => void;
}) {
  const Screen = route.getComponent();
  return (
    <View style={visible ? styles.content : styles.hidden}>
      <Screen navigateTo={navigateTo} onReady={onReady} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  hidden: { display: 'none' },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
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
  iconWrap: {
    position: 'relative',
    width: 48,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
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
