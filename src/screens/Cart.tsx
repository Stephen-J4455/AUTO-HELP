import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { useCart } from '../context/Cart';

export default function Cart() {
  const { colors } = useTheme();
  const { items, removeItem, clear, total } = useCart();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Cart</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.product_id + (i.sku || '')}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: colors.surface }]}> 
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.muted }}>SKU: {item.sku || '—'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.primary }}>${(item.price * item.quantity).toFixed(2)}</Text>
              <Text style={{ color: colors.muted }}>x{item.quantity}</Text>
              <TouchableOpacity onPress={() => removeItem(item.product_id, item.sku)}>
                <Text style={{ color: '#ff6b6b', marginTop: 6 }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Text style={[styles.total, { color: colors.text }]}>Total: ${total.toFixed(2)}</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: colors.surface }]} onPress={clear}>
            <Text style={{ color: colors.text }}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}> 
            <Text style={{ color: '#fff' }}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 18 }
});
