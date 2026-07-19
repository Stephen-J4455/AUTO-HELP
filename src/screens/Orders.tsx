import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
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
  order_items?: { count: number }[] | null;
};

const STATUS_META: Record<string, { label: string; icon: string; color: string }> = {
  pending: { label: 'Pending', icon: 'time-outline', color: '#B45309' },
  paid: { label: 'Paid', icon: 'checkmark-circle-outline', color: '#047857' },
  processing: { label: 'Processing', icon: 'construct-outline', color: '#1D4ED8' },
  shipped: { label: 'Shipped', icon: 'rocket-outline', color: '#7C3AED' },
  delivered: { label: 'Delivered', icon: 'home-outline', color: '#047857' },
  cancelled: { label: 'Cancelled', icon: 'close-circle-outline', color: '#B91C1C' },
  refunded: { label: 'Refunded', icon: 'return-up-back-outline', color: '#6B7280' },
};

function statusMeta(status: string) {
  return STATUS_META[status?.toLowerCase()] || { label: status || 'Unknown', icon: 'receipt-outline', color: '#666666' };
}

export default function Orders({ navigation }: { navigation: any }) {
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
        .select('id, status, total_amount, currency, created_at, order_items(count)')
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
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Orders</Text>
        <Text style={[styles.headerSub, { color: colors.muted }]}>Track and review your purchases</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const meta = statusMeta(item.status);
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}14` }]}>
                  <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.orderId, { color: colors.text }]}>
                    #{item.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={[styles.date, { color: colors.muted }]}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons name={meta.icon as any} size={13} color={meta.color} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.background }]} />

              <View style={styles.cardBottom}>
                <Text style={[styles.items, { color: colors.muted }]}>
                  {(() => {
                    const count = item.order_items?.[0]?.count ?? 0;
                    return count ? `${count} item${count > 1 ? 's' : ''}` : 'Items';
                  })()}
                </Text>
                <View style={styles.amountRow}>
                  <Text style={[styles.amount, { color: colors.text }]}>
                    {formatCedis(Number(item.total_amount || 0))}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIconWrap, { backgroundColor: `${colors.primary}14` }]}>
              <Ionicons name="receipt-outline" size={46} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No orders yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Your completed purchases will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900' },
  headerSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  list: { padding: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  card: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderId: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, marginVertical: 12 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  items: { fontSize: 13, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontSize: 17, fontWeight: '900' },
  emptyWrap: { marginTop: 70, alignItems: 'center', paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});