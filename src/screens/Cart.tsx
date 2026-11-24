import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useCart } from '../context/Cart';
import { useAuth } from '../context/Auth';
import { useAppAlert } from '../components/AppAlert';
import { Ionicons } from '@expo/vector-icons';
import { formatCedis } from '../utils/currency';
import { supabase } from '../supabase/supabase';
import { getProductImageUri } from '../utils/productImages';

// How many suggestions to show. One per row, per the cart layout.
const REC_COUNT = 6;

// Candidate pool size. Larger than REC_COUNT so shuffling has something to
// choose from rather than just reordering the same handful of products.
const REC_POOL_SIZE = 40;

// Hairline used to separate suggestion cards. Dark mode sets `surface` equal to
// `background`, so a border supplies the separation that a shadow otherwise did.
const REC_BORDER = 'rgba(0, 0, 0, 0.10)';
const REC_BORDER_DARK = 'rgba(255, 255, 255, 0.14)';

function CartThumbnail({ uri }: { uri?: string }) {
  const { colors } = useTheme();
  const [failed, setFailed] = React.useState(false);
  return (
    <View style={[styles.thumbWrap, { backgroundColor: colors.background }]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={styles.thumb} resizeMode="contain" onError={() => setFailed(true)} />
      ) : (
        <Ionicons name="cube-outline" size={28} color={colors.accentText} accessibilityLabel="Product photo unavailable" />
      )}
    </View>
  );
}

type RecProduct = {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  image: any;
  brand?: string;
};

/**
 * Fisher-Yates shuffle.
 *
 * Supabase/PostgREST has no random ordering, so the pool is fetched newest
 * first and shuffled here. That gives a genuinely different set of
 * suggestions each time the page is opened instead of always leading with the
 * newest products.
 */
function shuffled<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export default function Cart({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors, scheme } = useTheme();
  const { items, loading, updateQuantity, removeItem, clear, total, addItem } = useCart();
  const { user } = useAuth();
  const { show: showAlert } = useAppAlert();

  const hairline = scheme === 'dark' ? REC_BORDER_DARK : REC_BORDER;

  // Suggestion pool, the shuffle seed, and which row is mid-request.
  const [recPool, setRecPool] = React.useState<RecProduct[]>([]);
  const [recSeed, setRecSeed] = React.useState(0);
  const [recLoading, setRecLoading] = React.useState(true);
  const [addingRecId, setAddingRecId] = React.useState<string | null>(null);

  // Derived from the cart so changing a quantity does not trigger a refetch.
  const cartIdsKey = React.useMemo(() => items.map((i) => i.product_id).join(','), [items]);

  React.useEffect(() => {
    let mounted = true;
    async function loadPool() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, title, sku, images, price, brand')
          .order('created_at', { ascending: false })
          .limit(REC_POOL_SIZE);
        if (error) throw error;
        if (!mounted) return;

        // Never suggest something already in the cart.
        const inCart = new Set(cartIdsKey ? cartIdsKey.split(',') : []);
        setRecPool(
          ((data || []) as any[])
            .filter((p) => !inCart.has(p.id))
            .map((p) => {
              const uri = getProductImageUri(p.images);
              return {
                id: p.id,
                name: p.title,
                sku: p.sku,
                price: p.price === null || p.price === undefined ? null : Number(p.price),
                image: uri ? { uri } : null,
                brand: p.brand,
              };
            }),
        );
      } catch (e: any) {
        console.warn('Failed to load suggestions', e?.message);
        if (mounted) setRecPool([]);
      } finally {
        if (mounted) setRecLoading(false);
      }
    }
    void loadPool();
    return () => {
      mounted = false;
    };
  }, [cartIdsKey]);

  // Re-derives on every shuffle tap without refetching.
  const recommendations = React.useMemo(
    () => shuffled(recPool).slice(0, REC_COUNT),
    [recPool, recSeed],
  );

  async function handleAddRec(product: RecProduct) {
    if (addingRecId) return;
    if (!user?.id) {
      showAlert({ title: 'Please log in', message: 'You need to be logged in to add items to cart.' });
      return;
    }
    setAddingRecId(product.id);
    try {
      await addItem(
        {
          product_id: product.id,
          sku: product.sku || '',
          title: product.name,
          price: Number(product.price || 0),
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
      setAddingRecId(null);
    }
  }

  const subtotal = total;
  const deliveryFee = items.length ? 6.5 : 0;
  const grandTotal = subtotal + deliveryFee;

  async function handleClear() {
    try {
      await clear();
    } catch (error) {
      showAlert({ title: 'Cart error', message: error instanceof Error ? error.message : 'Could not clear cart.' });
    }
  }

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>My Cart</Text>
        </View>
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} accessibilityLabel="Loading cart" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>My Cart</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          {items.length > 0 && (
            <TouchableOpacity onPress={() => void handleClear()} activeOpacity={0.7}>
              <Text style={[styles.clearText, { color: colors.muted }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Always a scroll view so the suggestion rows below stay reachable
            even when the cart itself is empty. */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: hairline }]}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="cart-outline" size={34} color={colors.primary} />
              </View>
              <View style={styles.emptyTextWrap}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Your cart is empty</Text>
                <Text style={[styles.emptySub, { color: colors.muted }]}>
                  Add something from the suggestions below, or browse for parts.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.shopBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => navigateTo?.('home')}
              >
                <Text style={styles.shopBtnText}>Start shopping</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {items.map((item) => (
              <TouchableOpacity
                key={`${item.product_id}-${item.sku}`}
                style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
                activeOpacity={0.9}
                onPress={() => navigateTo?.('ProductDetails', { productId: item.product_id })}
              >
                <CartThumbnail key={item.image_url} uri={item.image_url} />

                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.sku, { color: colors.muted }]}>SKU: {item.sku || 'N/A'}</Text>
                  <Text style={[styles.price, { color: colors.accentText }]}>
                    {formatCedis(item.price * item.quantity)}
                  </Text>

                  <View style={styles.qtyRow}>
                    <View style={[styles.stepper, { backgroundColor: colors.background }]}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity - 1)}
                      >
                        <Ionicons name="remove" size={16} color={colors.text} />
                      </TouchableOpacity>
                      <Text style={[styles.qty, { color: colors.text }]}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        hitSlop={8}
                        onPress={() => void updateQuantity(item.product_id, item.sku, item.quantity + 1)}
                      >
                        <Ionicons name="add" size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.removeBtn}
                      activeOpacity={0.7}
                      onPress={() => void removeItem(item.product_id, item.sku)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ff5d5d" />
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={[styles.footer, { backgroundColor: colors.surface }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }]}>Subtotal</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.muted }] }>Delivery</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCedis(deliveryFee)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>{formatCedis(grandTotal)}</Text>
              </View>
              <TouchableOpacity
                style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => navigateTo?.('Checkout')}
              >
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.checkoutText}>Proceed to checkout</Text>
              </TouchableOpacity>
            </View>
            </>
          )}

          {/* Random suggestions: one card per row, re-shuffled on demand. */}
          {recLoading ? (
            <View style={[styles.recSkeleton, { backgroundColor: colors.surface, borderColor: hairline }]} />
          ) : recommendations.length > 0 ? (
            <View style={styles.recSection}>
              <View style={styles.recHeader}>
                <View style={styles.recHeaderText}>
                  <Text style={[styles.recTitle, { color: colors.text }]}>
                    {items.length === 0 ? 'Popular parts' : 'You may also need'}
                  </Text>
                  <Text style={[styles.recSubtitle, { color: colors.muted }]}>
                    {items.length === 0
                      ? 'Browse these while your cart is empty'
                      : 'A few other parts worth a look'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.shuffleBtn}
                  hitSlop={8}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Show different suggestions"
                  onPress={() => setRecSeed((n) => n + 1)}
                >
                  <Ionicons name="shuffle" size={15} color={colors.primary} />
                  <Text style={[styles.shuffleText, { color: colors.primary }]}>Shuffle</Text>
                </TouchableOpacity>
              </View>

              {recommendations.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.recCard, { backgroundColor: colors.surface, borderColor: hairline }]}
                  activeOpacity={0.9}
                  onPress={() => navigateTo?.('ProductDetails', { productId: product.id })}
                >
                  <View
                    style={[
                      styles.recThumbWrap,
                      { borderColor: hairline, backgroundColor: colors.background },
                    ]}
                  >
                    {product.image ? (
                      <Image source={product.image} style={styles.recThumb} resizeMode="contain" />
                    ) : (
                      <Ionicons name="cube-outline" size={22} color={colors.muted} />
                    )}
                  </View>

                  <View style={styles.recInfo}>
                    {product.brand ? (
                      <Text style={[styles.recBrand, { color: colors.primary }]} numberOfLines={1}>
                        {product.brand}
                      </Text>
                    ) : null}
                    <Text style={[styles.recName, { color: colors.text }]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={[styles.recPrice, { color: colors.text }]}>
                      {formatCedis(product.price)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.recAddBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: addingRecId === product.id ? 0.7 : 1,
                      },
                    ]}
                    activeOpacity={0.8}
                    disabled={addingRecId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${product.name} to cart`}
                    onPress={(event) => {
                      // Keep the tap here: the row opens the product.
                      event.stopPropagation();
                      void handleAddRec(product);
                    }}
                  >
                    {addingRecId === product.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="cart-outline" size={17} color="#fff" />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            ) : null}
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  clearText: { fontSize: 13, fontWeight: '700' },
  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 12, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  thumbWrap: { width: 88, height: 96, marginRight: 12, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  sku: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  price: { fontSize: 15, fontWeight: '900', marginTop: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  qty: { fontSize: 15, fontWeight: '800', minWidth: 26, textAlign: 'center' },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeText: { color: '#ff5d5d', fontWeight: '700', fontSize: 13 },
  // Compact horizontal banner so the suggestion rows below stay on screen.
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTextWrap: { flex: 1 },
  emptyTitle: { fontSize: 15, fontWeight: '900' },
  emptySub: { fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 17 },
  shopBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 13,
  },
  shopBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  footer: {
    marginTop: 4,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingTop: 10, marginTop: 2, marginBottom: 12 },
  totalLabel: { fontSize: 16, fontWeight: '900' },
  totalValue: { fontSize: 18, fontWeight: '900' },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
  },
  checkoutText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  recSection: {
    marginTop: 26,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recHeaderText: { flex: 1 },
  recTitle: { fontSize: 17, fontWeight: '800' },
  recSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
  },
  shuffleText: { fontSize: 12, fontWeight: '800' },
  // One suggestion per row, matching the cart rows above.
  recCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  recThumbWrap: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  recThumb: {
    width: '100%',
    height: '100%',
  },
  recInfo: {
    flex: 1,
  },
  recBrand: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  recName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  recPrice: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: -0.2,
  },
  recAddBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recSkeleton: {
    height: 88,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 26,
  },
});