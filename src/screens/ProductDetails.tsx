import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { useCart } from '../context/Cart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProductDetails({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { productId } = route.params || {};
  const [product, setProduct] = useState<any>(null);
  const { addItem } = useCart();

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!productId) return;
      const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
      if (error) {
        console.warn('Failed to load product', error.message);
        return;
      }
      if (mounted) setProduct(data);
    }
    load();
    return () => { mounted = false; };
  }, [productId]);

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}> 
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  const primaryVariant = (product.variants && product.variants[0]) || null;

    return (
      <View style={[styles.wrapper, { backgroundColor: colors.background }]}> 
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {product.images && product.images[0] ? (
            <Image source={{ uri: product.images[0].path }} style={styles.image} />
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>
          <Text style={[styles.sku, { color: colors.muted }]}>SKU: {product.sku}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>{primaryVariant ? `$${primaryVariant.price}` : '-'}</Text>
          <Text style={[styles.description, { color: colors.text }]}>{product.description}</Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom || 16, borderTopColor: colors.surface }]}> 
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              addItem({ product_id: product.id, sku: primaryVariant?.sku, title: product.title, price: parseFloat(primaryVariant?.price || 0) }, 1);
              navigation?.navigate('Cart');
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 240, borderRadius: 8, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  sku: { fontSize: 12, marginBottom: 6 },
  price: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  description: { marginBottom: 16 },
  addBtn: { padding: 14, borderRadius: 8, alignItems: 'center', width: '100%' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: 'transparent', borderTopWidth: 1 },
});
