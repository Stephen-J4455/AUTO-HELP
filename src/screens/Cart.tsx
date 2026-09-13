import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useCart } from '../context/Cart';
import { useAppAlert } from '../components/AppAlert';
import { Ionicons } from '@expo/vector-icons';
import { formatCedis } from '../utils/currency';

export default function Cart({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { items, loading, updateQuantity, removeItem, clear, total } = useCart();
  const { show: showAlert } = useAppAlert();

  const subtotal = total;
  const deliveryFee = items.length ? 6.5 : 0;
  const grandTotal = subtotal + deliveryFee;

  async function handleClear() {
    try {
      await clear();
    } catch (error) {
      showAlert({ title: 'Cart error', message: error instanceof Error ? error.message : 'Could not clear cart.' });
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>My Cart</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity onPress={() => void handleClear()} activeOpacity={0.7}>
              <Text style={[styles.clearText, { color: colors.muted }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <Ionicons name="cart-outline" size={42} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Your cart is empty</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Browse parts and add them to get started.
            </Text>
            <TouchableOpacity
              style={[styles.shopBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => navigateTo?.('home')}
            >
              <Text style={styles.shopBtnText}>Start shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={`${item.product_id}-${item.sku}`}
                style={[styles.row, { backgroundColor: colors.surface }]}
                activeOpacity={0.9}
                onPress={() => navigateTo?.('ProductDetails', { productId: item.product_id })}
              >
                <View style={styles.thumbWrap}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.background }]}>
                      <Ionicons name="image-outline" size={26} color={colors.muted} />
                    </View>
                  )}
                </View>

                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.sku, { color: colors.muted }]}>SKU: {item.sku || 'N/A'}</Text>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    {formatCedis(item.price * item.quantity)}
                  </Text>

                  <View style={styles.qtyRow}>
                    <View style={[styles.stepper, { backgroundColor: colors.background }]}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity - 1)}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.qty, { color: colors.text }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      activeOpacity={0.7}
                      onPress={() => void removeItem(item.product_id, item.sku)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff5d5d" />
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={[styles.footer, { backgroundColor: colors.surface }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }] }>Delivery</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(deliveryFee)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>{formatCedis(grandTotal)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => navigateTo?.('Checkout')}
              >
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutText}>Proceed to checkout</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  clearText: { fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  row: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  thumbWrap: { marginRight: 12 },
  thumb: { width: 88, height: 88, borderRadius: 14 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  sku: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  price: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 15, fontWeight: '800', minWidth: 26, textAlign: 'center' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeText: { color: '#ff5d5d', fontWeight: '700', fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 19, fontWeight: '900' },
  emptySub: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  shopBtn: {
    marginTop: 22,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
  },
  shopBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footer: {
    marginTop: 4,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingTop: 10, marginTop: 2, marginBottom: 12 },
  totalLabel: { fontSize: 16, fontWeight: '900' },
  totalValue: { fontSize: 18, fontWeight: '900' },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
  },
  checkoutText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});