import React from 'react';
import { View, Text, StyleSheet, TextInput, Image, TouchableOpacity, Dimensions, ScrollView, Animated, StatusBar, ActivityIndicator } from 'react-native';
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
import { cacheReadThrough } from '../utils/cache';
import MasonryGrid, { MasonryItem } from '../components/MasonryGrid';
import { loadImageSize, peekImageSize, hasMeasuredImage } from '../utils/imageSize';
import { useCart } from '../context/Cart';
import { useAppAlert } from '../components/AppAlert';

const { width } = Dimensions.get('window');
const isMobile = width < 768;

// Feed layout metrics. `FEED_H_PADDING` matches the horizontal padding on the
// feed section, and the gap sits between masonry columns.
const FEED_H_PADDING = 32;
const FEED_GAP = 12;
const FEED_COLUMNS = 2;
const FEED_COLUMN_WIDTH = (width - FEED_H_PADDING - FEED_GAP * (FEED_COLUMNS - 1)) / FEED_COLUMNS;

// Height used before a card's image has been measured. Matches the old fixed
// image box plus its text block so the first paint does not jump noticeably.
const ESTIMATED_CARD_HEIGHT = 232;

// Height of the text block beneath the image, which varies with the name's
// line count. Used only as a masonry estimate before the image is measured.
const CARD_TEXT_BASE = 96;
const NAME_LINE_HEIGHT = 18;

// Hairline that separates a card from the page. Dark mode sets `surface`
// equal to `background`, so a plain surface fill gives cards no edge at all;
// this border supplies the separation instead of a drop shadow.
const CARD_BORDER = 'rgba(0, 0, 0, 0.10)';
const CARD_BORDER_DARK = 'rgba(255, 255, 255, 0.14)';

// Product names in the feed are short and mostly fit on one or two lines.
// Rather than clamping every card to a fixed height, the number of lines
// tracks the name's length so short names do not leave empty space and long
// names still get enough room to stay readable.
//
// Thresholds assume roughly 25 characters fit on one line at 13px in the
// ~173px card (13px * 0.53 average glyph width). Wide-word safety margins are
// built in, since the exact wrap point depends on the characters used.
function nameLineCount(name: string): number {
  const len = name.trim().length;
  if (len <= 18) return 1;
  if (len <= 42) return 2;
  if (len <= 68) return 3;
  return 4;
}

/**
 * Height the image box occupies at full intrinsic aspect ratio. Falls back to
 * the estimate until the image has been measured.
 */
function imageHeightFor(product: Product, columnWidth: number): number {
  return product.imageSize && product.imageSize.width > 0
    ? (columnWidth * product.imageSize.height) / product.imageSize.width
    : ESTIMATED_CARD_HEIGHT;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  image: any;
  brand?: string;
  imageSize?: { width: number; height: number } | null;
  weight_kg?: number | null;
  pay_on_delivery?: boolean | null;
}

type FeedEntry = ({ type: 'product'; item: Product } | { type: 'ad'; ad: any }) & MasonryItem;

export default function Home({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors, scheme } = useTheme();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { show: showAlert } = useAppAlert();
  // Tracks which product is mid-request so its button can show a spinner and
  // reject repeat taps.
  const [addingId, setAddingId] = React.useState<string | null>(null);

  const handleAddToCart = React.useCallback(
    async (product: Product) => {
      if (addingId) return;
      if (!user?.id) {
        showAlert({ title: 'Please log in', message: 'You need to be logged in to add items to cart.' });
        return;
      }
      setAddingId(product.id);
      try {
        await addItem(
          {
            product_id: product.id,
            sku: product.sku || '',
            title: product.name,
            price: Number(product.price || 0),
            weight_kg: Number(product.weight_kg || 0),
            pay_on_delivery: Boolean(product.pay_on_delivery),
            image_url: product.image?.uri,
          },
          1,
        );
        showAlert({ title: 'Added', message: `${product.name} was added to your cart.` });
      } catch (error) {
        showAlert({
          title: 'Cart error',
          message: error instanceof Error ? error.message : 'Could not add to cart.',
        });
      } finally {
        setAddingId(null);
      }
    },
    [addingId, user?.id, addItem, showAlert],
  );
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
    const result: FeedEntry[] = [];
    if (!latest.length) return result;
    let adIdx = 0;
    latest.forEach((item, i) => {
      // Estimate the card's text block from the name's line count so the
      // masonry columns stay balanced while images are still unmeasured.
      const textHeight = CARD_TEXT_BASE + NAME_LINE_HEIGHT * nameLineCount(item.name);
      result.push({
        type: 'product',
        item,
        imageSize: item.imageSize,
        height: imageHeightFor(item, FEED_COLUMN_WIDTH) + textHeight,
      });
      // Insert an ad after every 4th product.
      if ((i + 1) % 4 === 0 && adIdx < feedAds.length) {
        const ad = feedAds[adIdx];
        adIdx += 1;
        if (!dismissedFeedAds.includes(ad.id)) {
          // Ads are self-sizing; the estimate keeps the columns balanced
          // until the card reports its real height.
          result.push({ type: 'ad', ad, height: ESTIMATED_CARD_HEIGHT });
        }
      }
    });
    return result;
  }, [latest, feedAds, dismissedFeedAds]);

  // Products persist only an image path, so the masonry layout has to learn
  // each image's intrinsic size at runtime to size the card without cropping.
  // `hasMeasuredImage` also covers failed measurements, so a broken url does
  // not re-trigger this effect forever.
  React.useEffect(() => {
    let cancelled = false;
    const pending = latest.filter((p) => p.image?.uri && !p.imageSize && !hasMeasuredImage(p.image.uri));
    if (!pending.length) return;

    Promise.all(
      pending.map((p) => loadImageSize(p.image.uri).then((size) => ({ id: p.id, size }))),
    ).then((results) => {
      if (cancelled) return;
      const resolved = results.filter((r) => r.size).length;
      if (!resolved) return;
      setLatest((prev) =>
        prev.map((p) => {
          const match = results.find((r) => r.id === p.id);
          return match?.size ? { ...p, imageSize: match.size } : p;
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [latest]);

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
      let rows: any[] = [];
      try {
        rows = await cacheReadThrough(
          'home:latest_products',
          async () => {
            const { data, error } = await supabase
              .from('products')
              .select('id, title, sku, images, price, brand, weight_kg, pay_on_delivery, created_at')
              .order('created_at', { ascending: false })
              .limit(50);
            if (error) throw error;
            return data || [];
          },
          120,
        );
      } catch (e: any) {
        console.warn('Failed to load products', e?.message);
        rows = [];
      }

      if (mounted) {
        setLatest(
          rows.map((p: any) => {
            const uri = getProductImageUri(p.images);
            return {
              id: p.id,
              name: p.title,
              sku: p.sku,
              price: p.price === null || p.price === undefined ? null : Number(p.price),
              image: uri ? { uri } : null,
              brand: p.brand,
              weight_kg: p.weight_kg === null || p.weight_kg === undefined ? null : Number(p.weight_kg),
              pay_on_delivery: Boolean(p.pay_on_delivery),
              // Sizes measured in an earlier mount are reused immediately.
              imageSize: uri ? peekImageSize(uri) ?? null : null,
            };
          })
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
                  style={[
                    styles.skeletonCard,
                    { opacity: shimmer, borderColor: scheme === 'dark' ? CARD_BORDER_DARK : CARD_BORDER },
                  ]}
                >
                  <View style={[styles.skeletonImage, { backgroundColor: colors.surface }]} />
                  <View style={[styles.skeletonLine, { backgroundColor: colors.surface }]} />
                  <View style={[styles.skeletonRule, { backgroundColor: colors.surface }]} />
                  <View style={[styles.skeletonPrice, { backgroundColor: colors.surface }]} />
                </Animated.View>
              ))}
            </View>
          ) : (
            <MasonryGrid
              style={styles.masonry}
              data={interleaved}
              columns={FEED_COLUMNS}
              gap={FEED_GAP}
              columnWidth={FEED_COLUMN_WIDTH}
              estimatedHeight={ESTIMATED_CARD_HEIGHT}
              renderItem={(entry) => {
                const isDark = scheme === 'dark';
                const cardBorder = isDark ? CARD_BORDER_DARK : CARD_BORDER;

                if (entry.type === 'ad') {
                  return (
                    <View
                      style={[
                        styles.cardShell,
                        { backgroundColor: colors.background, borderColor: cardBorder },
                      ]}
                    >
                      <AdCardInline
                        ad={entry.ad}
                        colors={colors}
                        onClose={() => setDismissedFeedAds((prev) => [...prev, entry.ad.id])}
                      />
                    </View>
                  );
                }

                const { item } = entry;
                // Full image height: size the box from the measured aspect
                // ratio instead of cropping the image to a fixed height.
                const imageHeight = imageHeightFor(item, FEED_COLUMN_WIDTH);

                return (
                  <TouchableOpacity
                    style={[
                      styles.cardShell,
                      { backgroundColor: colors.background, borderColor: cardBorder },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => navigateTo?.('ProductDetails', { productId: item.id })}
                  >
                    <View style={[styles.imageContainer, { height: imageHeight }]}>
                      {item.image ? (
                        <Image source={item.image} style={styles.productImage} resizeMode="contain" />
                      ) : (
                        <View style={[styles.imageFallback, { borderColor: cardBorder }]}>
                          <Ionicons name="cube-outline" size={30} color={colors.muted} />
                          <Text style={[styles.imageFallbackText, { color: colors.muted }]}>
                            No image
                          </Text>
                        </View>
                      )}
                      {item.brand ? (
                        <View
                          style={[
                            styles.brandChip,
                            { backgroundColor: colors.background, borderColor: cardBorder },
                          ]}
                        >
                          <Text style={[styles.brandChipText, { color: colors.primary }]} numberOfLines={1}>
                            {item.brand}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.productInfo}>
                      <Text
                        style={[styles.productName, { color: colors.text }]}
                        numberOfLines={nameLineCount(item.name)}
                      >
                        {item.name}
                      </Text>

                      <View style={[styles.infoRule, { backgroundColor: cardBorder }]} />

                      <View style={styles.productFooter}>
                        <View style={styles.priceBlock}>
                          <Text style={[styles.productPrice, { color: colors.text }]}>
                            {formatCedis(item.price)}
                          </Text>
                          {item.sku ? (
                            <Text style={[styles.productSku, { color: colors.muted }]} numberOfLines={1}>
                              {item.sku}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.addBtn,
                            {
                              backgroundColor: colors.primary,
                              opacity: addingId === item.id ? 0.7 : 1,
                            },
                          ]}
                          activeOpacity={0.8}
                          disabled={addingId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${item.name} to cart`}
                          onPress={(event) => {
                            // Keep the tap here: the surrounding card opens the
                            // product, which should not happen on "Add".
                            event.stopPropagation();
                            handleAddToCart(item);
                          }}
                        >
                          {addingId === item.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="cart-outline" size={13} color="#fff" />
                              <Text style={styles.addBtnText}>Add</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
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
  masonry: { marginTop: 14 },
  // Cards sit flush with the page and carry no elevation. A hairline border
  // (supplied by the theme) is what separates them, since dark mode makes
  // `surface` and `background` the same colour.
  cardShell: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  imageFallbackText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  // Brand sits on the image as a small chip so the product photo keeps the
  // full width of the card. The chip fill is supplied at render time from the
  // theme so it stays legible over any photo.
  brandChip: {
    position: "absolute",
    top: 8,
    left: 8,
    maxWidth: "72%",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  brandChipText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  productInfo: {
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 12,
    width: "100%",
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  infoRule: {
    height: 1,
    marginTop: 10,
    marginBottom: 9,
  },
  productFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  priceBlock: {
    flex: 1,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  productSku: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minWidth: 62,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  skeletonCard: {
    width: FEED_COLUMN_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: FEED_GAP,
    overflow: "hidden",
    paddingBottom: 14,
  },
  skeletonImage: {
    width: "100%",
    height: 116,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    marginBottom: 12,
  },
  skeletonLine: {
    width: "86%",
    height: 11,
    borderRadius: 6,
    marginHorizontal: 12,
  },
  skeletonRule: {
    width: "86%",
    height: 1,
    marginTop: 10,
    marginBottom: 10,
    marginHorizontal: 12,
  },
  skeletonPrice: {
    width: "46%",
    height: 13,
    borderRadius: 6,
    marginHorizontal: 12,
  },
});
