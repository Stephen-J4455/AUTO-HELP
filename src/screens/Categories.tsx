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
import { useCategories } from '../context/Categories';
import { supabase } from '../supabase/supabase';

interface CategoryWithCount {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  product_count: number;
  image: string | null;
}

export default function Categories({
  navigateTo,
  navigation,
}: {
  navigateTo?: (name: string, params?: any) => void;
  navigation?: any;
}) {
  const { colors } = useTheme();
  const { categories, loading, refreshCategories } = useCategories();
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const openScreen = (name: string, params?: any) => {
    if (navigateTo) {
      navigateTo(name, params);
      return;
    }
    navigation?.navigate?.(name, params);
  };

  useEffect(() => {
    loadCategoriesWithCounts();
  }, [categories]);

  const loadCategoriesWithCounts = async () => {
    if (categories.length === 0) return;
    
    setCountLoading(true);
    try {
      const categoriesData = await Promise.all(
        categories.map(async (cat) => {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', cat.id)
            .eq('active', true);

          return {
            ...cat,
            product_count: count || 0,
            image: cat.image || null,
          };
        })
      );
      setCategoriesWithCounts(categoriesData);
    } catch (error) {
      console.error('Failed to load category counts:', error);
    } finally {
      setCountLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCategories();
    setRefreshing(false);
  };

  const handleCategoryPress = (category: CategoryWithCount) => {
    openScreen('CategoryProducts', {
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
    });
  };

  if (loading || countLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigation?.goBack?.()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Categories</Text>
      </View>

      <FlatList
        data={categoriesWithCounts}
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
              <View style={styles.countBadge}>
                <Ionicons name="cube" size={12} color={colors.primary} />
                <Text style={[styles.countText, { color: colors.text }]}>
                  {item.product_count} {item.product_count === 1 ? 'product' : 'products'}
                </Text>
              </View>
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>No categories available</Text>
          </View>
        }
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
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
