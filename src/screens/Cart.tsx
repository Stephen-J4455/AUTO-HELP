import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}></Text>
        <Text style={{ color: colors.muted }}>{items.length} items</Text>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.product_id}-${i.sku}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: colors.surface }]}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.background }]}>
                  <Ionicons name="image-outline" size={22} color={colors.muted} />
                </View>
              )}
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>SKU: {item.sku || 'N/A'}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>
                  {formatCedis(item.price * item.quantity)}
                </Text>
                <View style={styles.qtyRow}>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: colors.background }]}
                    onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity - 1)}
                  >
                    <Ionicons name="remove" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={[styles.qtyBtn, { backgroundColor: colors.background }]}
                    onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity + 1)}
                  >
                    <Ionicons name="add" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => void removeItem(item.product_id, item.sku)}>
                    <Text style={{ color: '#ff5d5d', marginLeft: 12, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.muted }}>Your cart is empty.</Text>
            </View>
          }
        />
      )}

      <View style={[styles.footer, { backgroundColor: colors.surface }]}>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.muted }}>Subtotal</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCedis(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.muted }}>Delivery</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCedis(deliveryFee)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.total, { color: colors.text }]}>Total</Text>
          <Text style={[styles.total, { color: colors.primary }]}>{formatCedis(grandTotal)}</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.background }]} onPress={() => void handleClear()}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.checkoutBtn, { backgroundColor: colors.primary, opacity: items.length ? 1 : 0.6 }]}
            disabled={!items.length}
            onPress={() => navigateTo?.('Checkout')}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900' },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 220, gap: 10 },
  row: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  thumb: { width: 84, height: 84, borderRadius: 14 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 10 },
  name: { fontSize: 14, fontWeight: '800' },
  qtyRow: { marginTop: 8, alignItems: 'center', flexDirection: 'row' },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  empty: { alignItems: 'center', marginTop: 32 },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    borderRadius: 20,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.09,
    shadowRadius: 6,
    elevation: 3,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  total: { fontSize: 16, fontWeight: '900' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  clearBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkoutBtn: { flex: 2, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
