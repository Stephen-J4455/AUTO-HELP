import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { Ionicons } from '@expo/vector-icons';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

type Product = {
  id: string;
  title: string;
  sku: string;
  price: number | null;
  brand: string;
  imageUri: string | null;
};

export default function CategoryProducts({ route, navigation }: { route: any; navigation: any }) {
  const { colors } = useTheme();
  const categoryId = route?.params?.categoryId;
  const categoryName = route?.params?.categoryName || 'Category';
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!categoryId) {
        setError('Category not provided.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, title, sku, price, brand, images')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        if (mounted) {
          setError(fetchError.message);
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setProducts(
          (data || []).map((row: any) => ({
            id: String(row.id),
            title: String(row.title || 'Product'),
            sku: String(row.sku || ''),
            price: row.price === null || row.price === undefined ? null : Number(row.price),
            brand: String(row.brand || 'Other'),
            imageUri: getProductImageUri(row.images),
          }))
        );
        setLoading(false);
      }
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {categoryName}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>{products.length} products</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.column}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
            >
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imageFallback, { backgroundColor: colors.background }]}>
                  <Ionicons name="image-outline" size={24} color={colors.muted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={[styles.brand, { color: colors.primary }]} numberOfLines={1}>
                  {item.brand}
                </Text>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.footer}>
                  <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(item.price)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }} numberOfLines={1}>
                    {item.sku || 'SKU N/A'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: colors.muted }}>No products found in this category.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 12, paddingBottom: 120 },
  column: { gap: 10, marginBottom: 10 },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: { width: '100%', height: 120 },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 10 },
  brand: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  name: { fontSize: 13, fontWeight: '700', minHeight: 34 },
  footer: { marginTop: 8, gap: 4 },
  price: { fontSize: 14, fontWeight: '900' },
});
