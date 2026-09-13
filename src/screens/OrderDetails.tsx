import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { supabase } from '../supabase/supabase';
import { useAppAlert } from '../components/AppAlert';
import { formatCedis } from '../utils/currency';
import { getProductImageUri } from '../utils/productImages';

type OrderItem = {
  id: string;
  product_id: string | null;
  variant_sku: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  title?: string | null;
  image_url?: string | null;
};

type OrderDetail = {
  id: string;
  status: string;
  total_amount: number;
  currency: string | null;
  shipping_cost: number;
  created_at: string;
  placed_at: string | null;
  paid_at: string | null;
  payment_method?: string | null;
  shipping_address: {
    full_name?: string;
    phone?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
  } | null;
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

function firstImage(images: unknown): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === 'string') return first;
  }
  return getProductImageUri(images);
}

export default function OrderDetails({ route, navigation }: { route: any; navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { show: showAlert } = useAppAlert();
  const orderId = route.params?.orderId;
  const [loading, setLoading] = React.useState(true);
  const [order, setOrder] = React.useState<OrderDetail | null>(null);
  const [items, setItems] = React.useState<OrderItem[]>([]);
  const [notFound, setNotFound] = React.useState(false);
  const [cancelling, setCancelling] = React.useState(false);
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user?.id || !orderId) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, status, total_amount, currency, shipping_cost, created_at, placed_at, paid_at, payment_method, shipping_address')
        .eq('id', orderId)
        .eq('user_id', user.id)
        .single();

      if (orderError || !orderData) {
        if (mounted) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from('order_items')
        .select('id, product_id, variant_sku, quantity, unit_price, subtotal')
        .eq('order_id', orderId);

      const rawItems = (itemData as OrderItem[]) || [];

      // Fetch product titles + images for display.
      const productIds = rawItems.map((i) => i.product_id).filter(Boolean) as string[];
      let titleMap: Record<string, { title: string | null; images: unknown }> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, title, images')
          .in('id', productIds);
        for (const p of products || []) {
          titleMap[String(p.id)] = { title: p.title, images: (p as any).images };
        }
      }

      const enriched: OrderItem[] = rawItems.map((it) => {
        const meta = titleMap[String(it.product_id)];
        return {
          ...it,
          title: meta?.title || null,
          image_url: meta ? firstImage(meta.images) : null,
        };
      });

      if (mounted) {
        setOrder(orderData as OrderDetail);
        setItems(enriched);
        setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [user?.id, orderId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notFound || !order) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
        <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>Order not found</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const meta = statusMeta(order.status);
  const subtotal = items.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);
  const shipping = Number(order.shipping_cost || 0);
  const addr = order.shipping_address;

  // Customers may cancel a pay-on-delivery order within 1 hour of placement,
  // while it is still pending.
  const isPod = (order.payment_method || 'paystack') === 'pay_on_delivery';
  const placedMs = order.placed_at ? new Date(order.placed_at).getTime() : new Date(order.created_at).getTime();
  const withinCancelWindow = Date.now() - placedMs <= 60 * 60 * 1000;
  const canCancel = isPod && order.status === 'pending' && withinCancelWindow;

  async function handleConfirmCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: order.id,
        p_reason: reason,
      });
      if (error) throw new Error(error.message);
      const result = (data || {}) as { ok?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || 'Could not cancel order.');
      setOrder({ ...order, status: 'cancelled', payment_method: order.payment_method });
      if (navigation?.setParams) navigation.setParams({ refresh: Date.now() });
      setConfirmVisible(false);
      setReason('');
      showAlert({ title: 'Order cancelled', message: 'Your pay-on-delivery order has been cancelled.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not cancel order.';
      showAlert({ title: 'Cancel failed', message });
    } finally {
      setCancelling(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Order Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: colors.surface }]}>
          <View style={[styles.heroIcon, { backgroundColor: `${meta.color}1A` }]}>
            <Ionicons name={meta.icon as any} size={26} color={meta.color} />
          </View>
          <Text style={[styles.heroId, { color: colors.text }]}>
            #{order.id.slice(0, 8).toUpperCase()}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: `${meta.color}1A` }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={[styles.heroDate, { color: colors.muted }]}>
            Placed {new Date(order.created_at).toLocaleString()}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Items</Text>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.itemRow, { borderColor: colors.background }]}>
                <View style={[styles.itemThumb, { backgroundColor: colors.background }]}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.itemThumbImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="cube-outline" size={22} color={colors.muted} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {item.title || 'Product'}
                  </Text>
                  {item.variant_sku ? (
                    <Text style={[styles.itemSku, { color: colors.muted }]}>SKU: {item.variant_sku}</Text>
                  ) : null}
                  <Text style={[styles.itemQty, { color: colors.muted }]}>Qty: {item.quantity}</Text>
                </View>
                <Text style={[styles.itemPrice, { color: colors.text }]}>
                  {formatCedis(Number(item.subtotal || 0))}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.itemSku, { color: colors.muted }]}>No items found.</Text>
            }
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Delivery</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(shipping)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.background }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryTotal, { color: colors.text }]}>Total</Text>
            <Text style={[styles.summaryTotalValue, { color: colors.primary }]}>
              {formatCedis(Number(order.total_amount || 0))}
            </Text>
          </View>
        </View>

        {addr ? (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Shipping address</Text>
            <Text style={[styles.addrName, { color: colors.text }]}>{addr.full_name}</Text>
            <Text style={[styles.addrLine, { color: colors.muted }]}>{addr.phone}</Text>
            <Text style={[styles.addrLine, { color: colors.muted }]}>
              {[addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        ) : null}

        {order.paid_at ? (
          <Text style={[styles.paidNote, { color: colors.muted }]}>
            Paid on {new Date(order.paid_at).toLocaleString()}
          </Text>
        ) : null}

        {canCancel ? (
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: '#B91C1C' }]}
            onPress={() => setConfirmVisible(true)}
            disabled={cancelling}
          >
            <Ionicons name="close-circle-outline" size={18} color="#B91C1C" />
            <Text style={[styles.cancelText, { color: '#B91C1C' }]}>Cancel order (within 1 hour)</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Cancel this order?</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              You can only cancel a pay-on-delivery order within 1 hour of placing it. This action cannot be undone.
            </Text>
            <Text style={[styles.label, { color: colors.muted }]}>Reason (optional)</Text>
            <TextInput
              placeholder="Why are you cancelling?"
              placeholderTextColor={colors.muted}
              value={reason}
              onChangeText={setReason}
              style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.background }]}
                onPress={() => { setConfirmVisible(false); setReason(''); }}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Keep order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#B91C1C' }]}
                onPress={() => void handleConfirmCancel()}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Cancel order</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backIcon: { padding: 2 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  scroll: { padding: 16, paddingBottom: 28, gap: 12 },
  hero: {
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  heroId: { fontSize: 18, fontWeight: '900' },
  heroDate: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 8,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  section: {
    borderRadius: 18,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  itemThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemThumbImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  itemSku: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  itemQty: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '900', marginLeft: 8 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  summaryLabel: { fontSize: 14, fontWeight: '600' },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  summaryDivider: { height: 1, marginVertical: 6 },
  summaryTotal: { fontSize: 16, fontWeight: '900' },
  summaryTotalValue: { fontSize: 16, fontWeight: '900' },
  addrName: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  addrLine: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  paidNote: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  cancelBtn: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
  },
  cancelText: { fontSize: 15, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    padding: 20,
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  modalSub: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: '#e5e5e5',
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '800' },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  backBtn: {
    marginTop: 18,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 12,
  },
  backBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});