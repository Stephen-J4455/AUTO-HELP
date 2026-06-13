import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Route = {
  key: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
};

export default function BottomNav({ routes }: { routes: Route[] }) {
  const [active, setActive] = useState(routes[0]?.key || '');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const ActiveComponent = routes.find(r => r.key === active)?.component || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingBottom: 96 + insets.bottom }]}>
        {ActiveComponent ? <ActiveComponent /> : null}
      </View>

      <View style={[styles.bar, { bottom: 16 + insets.bottom }]}>
        {routes.map((r) => (
          <TouchableOpacity
            key={r.key}
            style={styles.tab}
            onPress={() => setActive(r.key)}
            activeOpacity={0.8}
          >
            {r.icon ? (
              <Ionicons
                name={r.icon as any}
                size={22}
                color={active === r.key ? colors.surface : colors.muted}
              />
            ) : null}
            <Text
              style={[
                styles.tabLabel,
                { color: active === r.key ? colors.surface : colors.muted },
              ]}
            >
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 64,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '700', marginTop: 4, color: '#fff' },
});
