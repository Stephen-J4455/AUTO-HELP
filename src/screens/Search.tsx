import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';
import { ScreenAds, StickyAdFooter } from '../utils/remoteContent';

type Product = {
  id: string;
  title: string;
  sku: string;
  price: number;
  brand: string;
  imageUri: string | null;
};

export default function Search({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [request, setRequest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);

    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, sku, price, brand, images')
          .order('created_at', { ascending: false })
          .limit(200)
          .abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error) throw error;
        setProducts((data ?? []).map((row) => ({
          id: String(row.id),
          title: String(row.title || 'Product'),
          sku: String(row.sku || ''),
          price: Number(row.price || 0),
          brand: String(row.brand || 'Other'),
          imageUri: getProductImageUri(row.images),
        })));
      } catch {
        if (!controller.signal.aborted) setLoadError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, [request]);

  const brands = useMemo(() => {
    const names = [...new Set(products.map(({ brand }) => brand))];
    return [null, ...names.sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => products.filter(({ title, sku, brand }) =>
    (!activeBrand || brand === activeBrand) &&
    (!term || [title, sku, brand].some((value) => value.toLowerCase().includes(term))),
  ), [products, term, activeBrand]);

  const hasFilters = !!term || activeBrand !== null;
  const showResults = !loading && !loadError;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <PageHeader title="Search parts" onBack={() => navigation.goBack()} />
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.searchIcon, { backgroundColor: colors.background }]}>
            <Ionicons name="search" size={20} color={colors.primary} />
          </View>
          <TextInput
            accessibilityLabel="Search parts by name, SKU or brand"
            placeholder="Part name, SKU or brand"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text }]}
          />
          {!!query && (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}>
              <Ionicons name="close" size={19} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {showResults && brands.length > 1 && (
          <FlatList
            horizontal
            accessibilityLabel="Filter by brand"
            data={brands}
            keyExtractor={(brand) => brand === null ? 'all' : `brand:${brand}`}
            contentContainerStyle={styles.brands}
            style={styles.brandList}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: brand }) => {
              const selected = brand === activeBrand;
              return (
                <Pressable accessibilityRole="radio" aria-checked={selected} onPress={() => setActiveBrand(brand)}
                  style={[styles.brandChip, {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  }]}>
                  <Text style={[styles.brandLabel, { color: selected ? '#fff' : colors.text }]}>{brand ?? 'All brands'}</Text>
                </Pressable>
              );
            }}
          />
        )}

        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.primary} accessibilityLabel="Loading parts" />
          </View>
        ) : loadError ? (
          <View style={styles.status}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>Couldn’t load parts</Text>
            <Pressable accessibilityRole="button" onPress={() => setRequest((value) => value + 1)} style={styles.statusAction}>
              <Text style={[styles.actionText, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!!filtered.length && (
              <Text accessibilityLiveRegion="polite" style={[styles.resultCount, { color: colors.muted }]}>
                {filtered.length} {filtered.length === 1 ? 'part' : 'parts'}
              </Text>
            )}
            <FlatList
              style={styles.resultList}
              contentContainerStyle={styles.results}
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                  style={({ pressed }) => [styles.card, {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.74 : 1,
                  }]}
                >
                  <View style={[styles.thumbnail, { backgroundColor: colors.background }]}>
                    {item.imageUri ? (
                      <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="contain" />
                    ) : (
                      <Ionicons name="construct-outline" size={24} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={[styles.productTitle, { color: colors.text }]}>{item.title}</Text>
                    {(item.brand !== 'Other' || !!item.sku) && (
                      <Text numberOfLines={1} style={[styles.productMeta, { color: colors.muted }]}>
                        {[item.brand === 'Other' ? '' : item.brand, item.sku && `SKU ${item.sku}`].filter(Boolean).join(' · ')}
                      </Text>
                    )}
                    <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(item.price)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.status}>
                  <Ionicons name="search-outline" size={29} color={colors.muted} />
                  <Text style={[styles.statusTitle, { color: colors.text }]}>{hasFilters ? 'No matching parts' : 'No parts available'}</Text>
                  {hasFilters && (
                    <Pressable accessibilityRole="button" style={styles.statusAction} onPress={() => { setQuery(''); setActiveBrand(null); }}>
                      <Text style={[styles.actionText, { color: colors.primary }]}>Clear filters</Text>
                    </Pressable>
                  )}
                </View>
              }
            />
          </>
        )}
        <ScreenAds screen="search" />
        <StickyAdFooter />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  searchBox: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, minHeight: 58, paddingHorizontal: 10, gap: 10, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  searchIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 16, fontWeight: '600' },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  brandList: { flexGrow: 0 },
  brands: { paddingHorizontal: 16, gap: 8 },
  brandChip: { minHeight: 44, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brandLabel: { fontSize: 13, fontWeight: '700' },
  resultCount: { marginHorizontal: 16, marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: '700' },
  resultList: { flex: 1 },
  results: { paddingHorizontal: 16, paddingBottom: 24, gap: 9 },
  card: { padding: 10, gap: 12, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  thumbnail: { width: 76, height: 76, overflow: 'hidden', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  productTitle: { fontSize: 15, fontWeight: '800' },
  productMeta: { fontSize: 12 },
  price: { fontSize: 15, fontWeight: '900' },
  status: { padding: 24, alignItems: 'center', gap: 10 },
  statusTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  statusAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  actionText: { fontSize: 14, fontWeight: '800' },
});
