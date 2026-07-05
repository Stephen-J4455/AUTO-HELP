import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

type Product = {
  id: string;
  title: string;
  sku: string;
  price: number;
  brand: string;
  imageUri: string | null;
};

export default function Search({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeBrand, setActiveBrand] = useState<string>('All');
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('id, title, sku, price, brand, images')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.warn('Search load failed', error.message);
      } else if (mounted && data) {
        const mapped: Product[] = data.map((row: any) => ({
          id: String(row.id),
          title: String(row.title || 'Product'),
          sku: String(row.sku || ''),
          price: Number(row.price || 0),
          brand: String(row.brand || 'Other'),
          imageUri: getProductImageUri(row.images),
        }));
        setProducts(mapped);
      }
      if (mounted) setLoading(false);
    }
    void loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const brands = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))], [products]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesText =
        !term ||
        product.title.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term);
      const matchesBrand = activeBrand === 'All' || product.brand === activeBrand;
      return matchesText && matchesBrand;
    });
  }, [products, query, activeBrand]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}></Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Find by name, SKU, or brand</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          placeholder="Search parts, SKU, brand..."
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          style={[styles.input, { color: colors.text }]}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        horizontal
        data={brands}
        keyExtractor={(item) => item}
        style={styles.brandsList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const active = item === activeBrand;
          return (
            <TouchableOpacity
              onPress={() => setActiveBrand(item)}
              style={[
                styles.brandChip,
                { backgroundColor: active ? colors.primary : colors.surface, borderColor: colors.surface },
              ]}
            >
              <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.results}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              activeOpacity={0.86}
              onPress={() => navigateTo?.('ProductDetails', { productId: item.id })}
            >
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.placeholder, { backgroundColor: colors.background }]}>
                  <Ionicons name="image-outline" size={26} color={colors.muted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text numberOfLines={2} style={[styles.productTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>SKU: {item.sku || 'N/A'}</Text>
                <View style={styles.row}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>{formatCedis(item.price)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.brand}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.muted }}>No products match your search.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 13 },
  searchBox: {
    marginHorizontal: 16,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600' },
  brandsList: { paddingHorizontal: 6,paddingBottom: 30, maxHeight: 45,},
  brandChip: {
    paddingHorizontal: 24,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  results: { padding: 16, paddingBottom: 90, gap: 12 },
  card: {
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  image: { width: 96, height: 96 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  productTitle: { fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { paddingTop: 36, alignItems: 'center' },
});
