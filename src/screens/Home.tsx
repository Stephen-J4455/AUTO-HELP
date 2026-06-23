import React from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, Dimensions, ScrollView, ActivityIndicator, Animated, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { supabase } from '../supabase/supabase';

const { width } = Dimensions.get('window');

const defaultCategoryImages = [
  require('../../assets/onboarding/bmw1.jpg'),
  require('../../assets/onboarding/bmw2.jpg'),
  require('../../assets/onboarding/bmw3.jpg'),
  require('../../assets/onboarding/bmw4.jpg'),
];

export default function Home({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const [latest, setLatest] = React.useState<Array<{ id: string; name: string; sku: string; price: string; image: any }>>([]);
  const [categories, setCategories] = React.useState<Array<{ id: string; name: string; image: any }>>([]);
  const [loading, setLoading] = React.useState(true);
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      // fetch categories
      const [{ data: catRows }, { data: products, error }] = await Promise.all([
        supabase.from('categories').select('id, name').limit(20),
        supabase.from('products').select('id, title, sku, images, variants, created_at').order('created_at', { ascending: false }).limit(50),
      ]);

      if (catRows && mounted) {
        setCategories(
          catRows.map((c: any, idx: number) => ({
            id: c.id,
            name: c.name,
            image: defaultCategoryImages[idx % defaultCategoryImages.length],
          }))
        );
      }

      if (error) {
        console.warn('Failed to load products', error.message);
      }
      if (mounted && products) {
        setLatest(
          products.map((p: any) => ({
            id: p.id,
            name: p.title,
            sku: p.sku,
            price: p.variants && p.variants[0] ? `$${p.variants[0].price}` : '-',
            image: p.images && p.images[0] ? { uri: p.images[0].path } : defaultCategoryImages[0],
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
  }, []);

  return (
    <ScrollView>
      <SafeAreaView
          edges={['bottom']} style={[styles.container, { backgroundColor: colors.background , paddingTop: 30, paddingBottom: 80}]}
      >
          <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.brand, { color: colors.text }]}>
              AUTO HELP GH
            </Text>
            <TouchableOpacity
              style={[styles.notificationBtn, { backgroundColor: colors.surface }]}
              activeOpacity={0.75}
              onPress={() => {
                /* TODO: open notifications */
              }}
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
            />
              <MaterialCommunityIcons name="tune-variant" size={20} color={colors.primary} style={{ position: 'relative' }} />
              </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Categories
          </Text>
          <View style={styles.categoryGridWrap}>
            {(categories.length
              ? categories
              : [
                  { id: "1", name: "Brakes", image: defaultCategoryImages[0] },
                  {
                    id: "2",
                    name: "Filters",
                    image: defaultCategoryImages[1],
                  },
                  {
                    id: "3",
                    name: "Suspension",
                    image: defaultCategoryImages[2],
                  },
                  {
                    id: "4",
                    name: "Lighting",
                    image: defaultCategoryImages[3],
                  },
                ]
            ).map((item) => (
              <TouchableOpacity
                key={String(item.id)}
                style={styles.categoryCircle}
                activeOpacity={0.8}
              >
                <Image source={item.image} style={styles.categoryCircleImage} />
                <Text
                  style={[styles.categoryTextSmall, { color: colors.muted }]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
                    <TouchableOpacity key={item.id} style={styles.productCard} activeOpacity={0.85} onPress={() => navigateTo?.('ProductDetails', { productId: item.id })}>
                      <Image source={item.image} style={styles.productThumb} />
                      <Text
                        style={[styles.productName, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[styles.productPrice, { color: colors.primary }]}
                      >
                        {item.price}
                      </Text>
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
  brand: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  search: { padding: 18, borderRadius: 8 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
  
    borderRadius: 30,
    paddingHorizontal: 12,
   
  },
  section: { marginTop: 18, paddingLeft: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  categoryItem: { marginRight: 12, width: 100, alignItems: "center" },
  categoryImage: { width: 100, height: 60, borderRadius: 6, marginBottom: 6 },
  categoryText: {},
  categoryGridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  categoryCircle: { width: 72, marginRight: 12, alignItems: 'center', marginBottom: 12 },
  categoryCircleImage: { width: 64, height: 64, borderRadius: 32, marginBottom: 6 },
  categoryTextSmall: { fontSize: 12, textAlign: 'center' },
  card: { marginRight: 12, width: width * 0.6, borderRadius: 8, padding: 8 },
  cardImage: { width: "100%", height: 120, borderRadius: 6 },
  cardTitle: { marginTop: 8, fontWeight: "700" },
  cardPrice: { marginTop: 4, fontWeight: "800" },
  feed: { marginTop: 24, paddingHorizontal: 16 },
  feedTitle: { fontSize: 18, fontWeight: "700" },
  feedItem: { marginTop: 8, fontSize: 14 },
  emptystate: { marginTop: 16, alignItems: "center", justifyContent: "center" },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  productCard: { width: (width - 48) / 2, backgroundColor: '#fff', borderRadius: 24, padding: 8, marginBottom: 12, alignItems: 'flex-start', elevation: 2 },
  skeletonImage: { width: '100%', height: 100, backgroundColor: '#eee', borderRadius: 6, marginBottom: 8 },
  skeletonLine: { width: '70%', height: 12, backgroundColor: '#eee', borderRadius: 6 },
  productThumb: { width: '100%', height: 100, borderRadius: 6, marginBottom: 8, backgroundColor: '#f6f6f6' },
  productName: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  productPrice: { fontSize: 13, fontWeight: '700' },
});
