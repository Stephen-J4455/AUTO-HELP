import React from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Dimensions, ScrollView, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import {Ionicons, MaterialCommunityIcons} from '@expo/vector-icons';
import { useAuth } from '../context/Auth';
import { supabase } from '../supabase/supabase';
import { useCategories } from '../context/Categories';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';
import { AppUpdateBanner, MarketingBanner, CallToOrderBanner, AdCarousel, useFeedAds, AdCardInline } from '../utils/remoteContent';
import { APP_VERSION } from '../utils/appVersion';
import { DEVICE_CORNER_RADIUS } from '../utils/device';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

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
  const { user } = useAuth();
  const { categories: contextCategories, loading: categoriesLoading } = useCategories();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [latest, setLatest] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const shimmer = React.useRef(new Animated.Value(0)).current;
  const homeCategories = React.useMemo(() => contextCategories.slice(0, 4), [contextCategories]);

  // Ads to interleave among the vehicle product feed (placement 'home_feed' or '*').
  const feedAds = useFeedAds(colors);
  const [dismissedFeedAds, setDismissedFeedAds] = React.useState<string[]>([]);
  const interleaved = React.useMemo(() => {
    const result: Array<{ type: 'product'; item: Product } | { type: 'ad'; ad: any }> = [];
    if (!latest.length) return result;
    let adIdx = 0;
    latest.forEach((item, i) => {
      result.push({ type: 'product', item });
      // Insert an ad after every 4th product.
      if ((i + 1) % 4 === 0 && adIdx < feedAds.length) {
        const ad = feedAds[adIdx];
        adIdx += 1;
        if (!dismissedFeedAds.includes(ad.id)) {
          result.push({ type: 'ad', ad });
        }
      }
    });
    return result;
  }, [latest, feedAds, dismissedFeedAds]);

  // Keep the notification bell badge in sync with unread inbox entries.
  React.useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function refreshUnread() {
      if (!user?.id) {
        if (mounted) setUnreadCount(0);
        return;
      }
      const { count, error } = await supabase
        .from('inbox_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      if (mounted && !error) setUnreadCount(count || 0);
    }
    refreshUnread();
    timer = setInterval(refreshUnread, 15000);

    // Realtime: update the badge the instant an inbox entry changes.
    // Use a unique channel name per mount so React StrictMode's double
    // invocation (and any re-subscribe) never calls `.on()` on an already
    // subscribed channel, which throws the postgres_changes error.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (user?.id) {
      const channelName = `inbox:${user.id}:${Math.random().toString(36).slice(2)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inbox_entries',
            filter: `user_id=eq.${user.id}`,
          },
          () => refreshUnread()
        )
        .subscribe();
    }

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

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
          edges={['bottom']} style={[styles.container, { backgroundColor: colors.background , paddingTop: isMobile ? Math.max(0, (StatusBar.currentHeight || 0) - 20) : 30 }]}
      >
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <AppUpdateBanner appVersion={APP_VERSION} />
        <CallToOrderBanner />
        <MarketingBanner />
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <View style={styles.brandRow}>
                <Text style={[styles.brand, { color: colors.text }]}>AUTO HELP</Text>
                <View style={[styles.brandBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.brandBadgeText}>GH</Text>
                </View>
              </View>
              <Text style={[styles.brandTagline, { color: colors.muted }]}>Home of genuine parts</Text>
            </View>
            <TouchableOpacity
              style={[styles.notificationBtn, { backgroundColor: colors.surface }]}
              activeOpacity={0.75}
              onPress={() => navigateTo?.('Notifications')}
            >
              <View style={styles.notifIconWrap}>
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={colors.muted}
                />
                {unreadCount > 0 ? (
                  <View style={[styles.notifBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                    <Text style={styles.notifBadgeText}>
                      {unreadCount > 99 ? '99+' : String(unreadCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigateTo?.('search')}
        style={[
          styles.searchContainer,
          { backgroundColor: colors.surface, borderRadius: DEVICE_CORNER_RADIUS },
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
              editable={false}
              showSoftInputOnFocus={false}
            />
              <MaterialCommunityIcons name="tune-variant" size={20} color={colors.primary} style={{ position: 'relative' }} />
              </View>
          </TouchableOpacity>
        </View>

        <AdCarousel placement="home_carousel" />

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
              {interleaved.map((entry, idx) =>
                entry.type === 'ad' ? (
                  <View key={`ad-${entry.ad.id}-${idx}`} style={[styles.productCard, { backgroundColor: colors.surface }]}>
                    <AdCardInline ad={entry.ad} colors={colors} onClose={() => setDismissedFeedAds((prev) => [...prev, entry.ad.id])} />
                  </View>
                ) : (
                  <TouchableOpacity 
                    key={entry.item.id} 
                    style={[styles.productCard, { backgroundColor: colors.surface }]} 
                    activeOpacity={0.85} 
                    onPress={() => navigateTo?.('ProductDetails', { productId: entry.item.id })}
                  >
                    <View style={styles.imageContainer}>
                      {entry.item.image ? (
                        <Image source={entry.item.image} style={styles.productImage} />
                      ) : (
                        <View style={[styles.productImage, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="cube-outline" size={32} color={colors.muted} />
                        </View>
                      )}
                    </View>

                    <View style={styles.productInfo}>
                      <View style={styles.productMetaRow}>
                        {entry.item.brand ? (
                          <Text style={[styles.productBrand, { color: colors.primary }]} numberOfLines={1}>
                            {entry.item.brand}
                          </Text>
                        ) : (
                          <View />
                        )}
                        {entry.item.sku ? (
                          <Text style={[styles.productSku, { color: colors.muted }]} numberOfLines={1}>
                            {entry.item.sku}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[styles.productName, { color: colors.text }]}
                        numberOfLines={2}
                      >
                        {entry.item.name}
                      </Text>
                      <View style={styles.productFooter}>
                        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatCedis(entry.item.price)}</Text>
                        <View style={[styles.addBtn, { backgroundColor: colors.primary }]}>
                          <Ionicons name="chevron-forward" size={14} color="#fff" />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ),
              )}
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
  notifIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  notifBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
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
