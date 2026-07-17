import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { supabase } from '../supabase/supabase';
import { formatCedis } from '../utils/currency';

type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  currency: string | null;
  created_at: string;
};

export default function Orders() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [orders, setOrders] = React.useState<OrderRow[]>([]);

  React.useEffect(() => {
    let mounted = true;
    async function loadOrders() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, currency, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Orders load failed', error.message);
      } else if (mounted) {
        setOrders((data as OrderRow[]) || []);
      }

      if (mounted) setLoading(false);
    }

    void loadOrders();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Text style={[styles.orderId, { color: colors.text }]}>#{item.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={[styles.status, { color: colors.primary }]}>{item.status.toUpperCase()}</Text>
            </View>
            <Text style={[styles.amount, { color: colors.text }]}>{formatCedis(Number(item.total_amount || 0))}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={46} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>Your completed purchases will appear here.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 24, gap: 10 },
  card: { borderRadius: 14, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 13, fontWeight: '800' },
  status: { fontSize: 11, fontWeight: '900' },
  amount: { marginTop: 8, fontSize: 18, fontWeight: '900' },
  date: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  emptyWrap: { marginTop: 80, alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 17, fontWeight: '800' },
  emptySub: { marginTop: 4, fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
