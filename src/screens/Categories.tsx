import PageHeader from '../components/PageHeader';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Category, useCategories } from '../context/Categories';
import { supabase } from '../supabase/supabase';

export default function Categories({
  navigateTo,
  navigation,
}: {
  navigateTo?: (name: string, params?: any) => void;
  navigation?: any;
}) {
  const { colors } = useTheme();
  const { categories, loading, refreshCategories } = useCategories();
  const [counts, setCounts] = useState<Partial<Record<number, number>>>({});
  const [refreshing, setRefreshing] = useState(false);
  const openScreen = (name: string, params?: any) => {
    if (navigateTo) {
      navigateTo(name, params);
      return;
    }
    navigation?.navigate?.(name, params);
  };

  useEffect(() => {
    let active = true;
    if (!categories.length) return;
    void Promise.all(
      categories.map(async (category) => {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('active', true);
        return [category.id, count ?? undefined] as const;
      }),
    ).then((entries) => {
      if (active) setCounts(Object.fromEntries(entries));
    }).catch((error) => console.warn('Failed to load category counts:', error));
    return () => { active = false; };
  }, [categories]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCategories();
    setRefreshing(false);
  };

  const handleCategoryPress = (category: Category) => {
    openScreen('CategoryProducts', {
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <PageHeader title="Categories" onBack={() => navigation?.goBack?.()} />

      <FlatList
        data={categories}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryCard, { backgroundColor: colors.surface }]}
            onPress={() => handleCategoryPress(item)}
          >
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.categoryImage} />
            ) : (
              <View style={[styles.categoryImage, styles.categoryFallback, { backgroundColor: colors.background }]}>
                <Ionicons name="grid-outline" size={22} color={colors.muted} />
              </View>
            )}
            <View style={styles.categoryOverlay} />
            <View style={styles.categoryContent}>
              <Text style={[styles.categoryName, { color: '#fff' }]}>{item.name}</Text>
              {counts[item.id] !== undefined && <View style={styles.countBadge}>
                <Ionicons name="cube" size={12} color={colors.primary} />
                <Text style={[styles.countText, { color: colors.text }]}>
                  {counts[item.id]} {counts[item.id] === 1 ? 'product' : 'products'}
                </Text>
              </View>}
              {item.description && (
                <Text
                  style={[styles.categoryDesc, { color: 'rgba(255, 255, 255, 0.8)' }]}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={loading ? (
          <ActivityIndicator accessibilityLabel="Loading categories" color={colors.primary} style={styles.loader} />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>No categories available</Text>
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 32 },
  listContent: { paddingHorizontal: 8, paddingVertical: 8 },
  columnWrapper: { gap: 8, paddingHorizontal: 8, marginBottom: 8 },
  categoryCard: {
    flex: 1,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  categoryImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  categoryFallback: { alignItems: 'center', justifyContent: 'center' },
  categoryOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  categoryContent: { padding: 12, zIndex: 1 },
  categoryName: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  countText: { fontSize: 12, fontWeight: '600' },
  categoryDesc: { fontSize: 11, fontWeight: '500' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
