import React from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Dimensions, ScrollView, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { useCategories } from '../context/Categories';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  image: any;
  brand?: string;
}

export default function Home({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { categories: contextCategories, loading: categoriesLoading } = useCategories();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [latest, setLatest] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const shimmer = React.useRef(new Animated.Value(0)).current;
  const homeCategories = React.useMemo(() => contextCategories.slice(0, 4), [contextCategories]);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: products, error } = await supabase
        .from('products')
        .select('id, title, sku, images, price, brand, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Failed to load products', error.message);
      }
      if (mounted && products) {
        setLatest(
          products.map((p: any) => ({
            id: p.id,
            name: p.title,
            sku: p.sku,
            price: p.price === null || p.price === undefined ? null : Number(p.price),
            image: getProductImageUri(p.images) ? { uri: getProductImageUri(p.images)! } : null,
            brand: p.brand,
          }))
        );
      }

      setLoading(false);
    }
    load();
    // start shimmer loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => {
      mounted = false;
    };
  }, [contextCategories]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SafeAreaView
          edges={['bottom']} style={[styles.container, { backgroundColor: colors.background , paddingTop: 30, paddingBottom: 80}]}
      >
          <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.brandRow}>
                <Text style={[styles.brand, { color: colors.text }]}>AUTO HELP</Text>
                <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.brandBadgeText}>GH</Text>
                </View>
              </View>
              <Text style={[styles.brandTagline, { color: colors.muted }]}>Trusted auto parts marketplace</Text>
            </View>
            <TouchableOpacity
              style={[styles.notificationBtn, { backgroundColor: colors.surface }]}
              activeOpacity={0.75}
              onPress={() => navigateTo?.('Notifications')}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.surface },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={colors.muted}
              style={{ marginRight: 8 }}
            />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TextInput
              style={styles.search}
              placeholder="Search parts, VIN, SKU..."
              placeholderTextColor="#999"
              value={searchTerm}
              onFocus={() => navigateTo?.('search')}
              onChangeText={setSearchTerm}
              onSubmitEditing={() => navigateTo?.('search', { q: searchTerm })}
            />
              <MaterialCommunityIcons name="tune-variant" size={20} color={colors.primary} style={{ position: 'relative' }} />
              </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>
            <TouchableOpacity onPress={() => navigateTo?.('CategoriesList')}>
              <Text style={[styles.moreLink, { color: colors.primary }]}>More</Text>
            </TouchableOpacity>
          </View>
          {categoriesLoading ? (
            <View style={styles.categoryGridWrap}>
              {Array.from({ length: 4 }).map((_, idx) => (
                <Animated.View key={idx} style={[styles.categoryCircle, { opacity: shimmer }]}>
                  <View style={[styles.categoryCircleImage, { backgroundColor: colors.surface }]} />
                  <View style={[styles.categorySkeletonText, { backgroundColor: colors.surface }]} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.categoryGridWrap}>
              {homeCategories.map((item) => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.categoryCircle}
                  activeOpacity={0.8}
                  onPress={() => navigateTo?.('CategoryProducts', { categoryId: item.id, categoryName: item.name })}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.categoryCircleImage} />
                  ) : (
                    <View style={[styles.categoryCircleImage, styles.categoryFallback, { backgroundColor: colors.surface }]}>
                      <Ionicons name="grid-outline" size={20} color={colors.muted} />
                    </View>
                  )}
                  <Text
                    style={[styles.categoryTextSmall, { color: colors.muted }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/*auto part feed */}
        <View style={styles.feed}>
          <Text style={[styles.feedTitle, { color: colors.text }]}>
            Latest Parts
          </Text>
          {loading ? (
            <View style={styles.grid}>
              {Array.from({ length: 6 }).map((_, idx) => (
                <Animated.View
                  key={idx}
                  style={[styles.productCard, { opacity: shimmer }]}
                >
                  <View style={styles.skeletonImage} />
                  <View style={styles.skeletonLine} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {latest.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={[styles.productCard, { backgroundColor: colors.surface }]} 
                  activeOpacity={0.85} 
                  onPress={() => navigateTo?.('ProductDetails', { productId: item.id })}
                >
                  <View style={styles.imageContainer}>
                    {item.image ? (
                      <Image source={item.image} style={styles.productImage} />
                    ) : (
                      <View style={[styles.productImage, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="cube-outline" size={32} color={colors.muted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.productInfo}>
                    <View style={styles.productMetaRow}>
                      {item.brand ? (
                        <Text style={[styles.productBrand, { color: colors.primary }]} numberOfLines={1}>
                          {item.brand}
                        </Text>
                      ) : (
                        <View />
                      )}
                      {item.sku ? (
                        <Text style={[styles.productSku, { color: colors.muted }]} numberOfLines={1}>
                          {item.sku}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.productName, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                    <View style={styles.productFooter}>
                      <Text style={[styles.productPrice, { color: colors.primary }]}>{formatCedis(item.price)}</Text>
                      <View style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 27, fontWeight: "900", letterSpacing: 0.6 },
  brandBadge: {
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  brandBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  brandTagline: { marginTop: 4, fontSize: 11, fontWeight: "600" },
  search: { padding: 18, borderRadius: 8 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",

    borderRadius: 30,
    paddingHorizontal: 12,
  },
  section: { marginTop: 18, paddingLeft: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  moreLink: { fontSize: 13, fontWeight: "800", marginBottom: 12 },
  categoryGridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  categoryCircle: {
    width: 72,
    marginRight: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  categoryCircleImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 6,
  },
  categoryFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTextSmall: { fontSize: 12, textAlign: "center" },
  categorySkeletonText: {
    width: 58,
    height: 10,
    borderRadius: 5,
  },
  feed: { marginTop: 24, paddingHorizontal: 16 },
  feedTitle: { fontSize: 18, fontWeight: "700" },
  grid: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  skeletonImage: {
    width: "100%",
    height: 116,
    backgroundColor: "#eee",
    borderRadius: 18,
    marginBottom: 10,
  },
  skeletonLine: {
    width: "70%",
    height: 12,
    backgroundColor: "#eee",
    borderRadius: 6,
  },
  productThumb: {
    width: "100%",
    height: 120,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginBottom: 10,
    backgroundColor: "#f6f6f6",
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    minHeight: 34,
  },
  imageContainer: {
    width: "100%",
    height: 116,
    backgroundColor: "#f6f6f6",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    width: "100%",
  },
  productMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 6,
  },
  productBrand: {
    fontSize: 11,
    fontWeight: "700",
    maxWidth: "48%",
    textTransform: "uppercase",
  },
  productSku: {
    fontSize: 10,
    fontWeight: "600",
    maxWidth: "48%",
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "900",
  },
  addBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
