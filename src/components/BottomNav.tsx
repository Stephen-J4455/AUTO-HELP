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

export default function BottomNav({ routes, navigation }: { routes: Route[]; navigation?: any }) {
  const [active, setActive] = useState(routes[0]?.key || '');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

      <View style={[styles.bar, { bottom: 8 + insets.bottom }]}>
        {routes.map((r) => (
          <TouchableOpacity
            key={r.key}
            onPress={() => setActive(r.key)}
            activeOpacity={0.8}
          >
              {r.icon ? (
            <View style={active === r.key ? { flexDirection: 'column', alignItems: 'center',justifyContent: 'center'} : { alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}>
                
              <Ionicons
                name={r.icon as any}
                size={24}
                color={active === r.key ? colors.surface : colors.muted}
                />
                 <Text
              style={[
                styles.tabLabel,
                { color: active === r.key ? colors.surface : colors.muted },
              ]}
            >
              {r.label}
            </Text>
           </View>
            ) : null}
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
    height: 55,
    borderRadius: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',

    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  tabLabel: { fontSize: 10, fontWeight: '700', marginTop: 0, color: '#fff' },
});
