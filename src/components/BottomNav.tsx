import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

type Route = {
  key: string;
  label: string;
  icon?: string;
  component: React.ComponentType<any>;
};

export default function BottomNav({ routes }: { routes: Route[] }) {
  const [active, setActive] = useState(routes[0]?.key || '');
  const { colors } = useTheme();

  const ActiveComponent = routes.find(r => r.key === active)?.component || null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.content}>
        {ActiveComponent ? <ActiveComponent /> : null}
      </View>

      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: 'rgba(0,0,0,0.08)' }]}>
        {routes.map(r => (
          <TouchableOpacity key={r.key} style={styles.tab} onPress={() => setActive(r.key)} activeOpacity={0.8}>
            {r.icon ? (
              <Ionicons name={r.icon as any} size={22} color={active === r.key ? colors.primary : colors.muted} />
            ) : null}
            <Text style={[styles.tabLabel, { color: active === r.key ? colors.primary : colors.muted }]}>{r.label}</Text>
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
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
});
