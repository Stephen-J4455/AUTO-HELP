import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

type Route = {
  key: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
};

export default function BottomNav({ routes, navigation }: { routes: Route[]; navigation?: any }) {
  const [active, setActive] = useState(routes[0]?.key || '');
  const [tabsWidth, setTabsWidth] = useState(0);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const indicatorX = React.useRef(new Animated.Value(0)).current;

  const activeIndex = React.useMemo(
    () => Math.max(0, routes.findIndex((item) => item.key === active)),
    [active, routes]
  );
  const segmentWidth = tabsWidth && routes.length ? tabsWidth / routes.length : 0;
  const indicatorWidth = Math.max(0, segmentWidth - 8);

  React.useEffect(() => {
    if (!segmentWidth) return;
    Animated.timing(indicatorX, {
      toValue: activeIndex * segmentWidth + 4,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, segmentWidth, indicatorX]);

  React.useEffect(() => {
    const targetTab = route?.params?.tab;
    if (typeof targetTab === 'string' && routes.some((route) => route.key === targetTab)) {
      setActive(targetTab);
      navigation?.setParams?.({ tab: undefined });
    }
  }, [navigation, route?.params?.tab, routes]);

  const navigateTo = (name: string, params?: any) => {
    if (name === 'Main' || routes.find(r=>r.key===name)) {
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
            style={{ flex: 1, display: active === r.key ? "flex" : "none" }}
          >
            {React.createElement(r.component, { navigateTo })}
          </View>
        ))}
      </View>

      <View
        style={[
          styles.bar,
          {
            bottom: 10 + insets.bottom,
            backgroundColor: colors.surface,
            borderColor: colors.background,
          },
        ]}
      >
        <View style={styles.tabsRow} onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
              width: indicatorWidth,
                backgroundColor: colors.primary,
              paddingVertical: 20,
              transform: [{ translateX: indicatorX }],
              },
            ]}
          />
          {routes.map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => setActive(r.key)}
              activeOpacity={0.8}
              style={styles.tab}
            >
              {r.icon ? (
              <View style={styles.tabInner}>
                <Ionicons
                  name={r.icon as any}
                  size={18}
                  color={active === r.key ? '#fff' : colors.muted}
                />
                <Text style={[styles.tabLabel, { color: active === r.key ? '#fff' : colors.muted }]}>
                  {r.label}
                </Text>
              </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 64,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 7,
    bottom: 7,
    borderRadius: 26,
    
  },
  tab: {
    flex: 1,
    height: 50,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  tabInner: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '800' },
});
