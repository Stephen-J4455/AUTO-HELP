import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { useCart } from '../context/Cart';
import { useAuth } from '../context/Auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProductImageUri, toPublicProductImageUrl } from '../utils/productImages';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { formatCedis } from '../utils/currency';

const { width } = Dimensions.get('window');

export default function ProductDetails({ route, navigation }: any) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { productId } = route.params || {};
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: '' });
  const [submitting, setSubmitting] = useState(false);
  const { addItem } = useCart();
  const modalStartY = useRef(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!productId) return;
      const { data, error } = await supabase.from('products').select('*').eq('id', productId).single();
      if (error) {
        console.warn('Failed to load product', error.message);
        return;
      }
      if (mounted) setProduct(data);
    }
    load();
    return () => { mounted = false; };
  }, [productId]);

  useEffect(() => {
    let mounted = true;
    async function loadLikes() {
      if (!productId) return;
      
      const { count } = await supabase
        .from('product_likes')
        .select('*', { count: 'exact' })
        .eq('product_id', productId);
      
      if (mounted) setLikeCount(count || 0);

      if (user) {
        const { data } = await supabase
          .from('product_likes')
          .select('id')
          .eq('product_id', productId)
          .eq('user_id', user.id)
          .limit(1);
        
        if (mounted) setLiked(!!data && data.length > 0);
      }
    }
    loadLikes();
    return () => { mounted = false; };
  }, [productId, user]);

  useEffect(() => {
    let mounted = true;
    async function loadReviews() {
      if (!productId) return;
      const { data, error } = await supabase
        .from('reviews')
        .select('id, rating, body, created_at, users(full_name)')
        .eq('product_id', productId)
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        console.warn('Failed to load reviews', error.message);
        return;
      }
      if (mounted) setReviews(data || []);
    }
    loadReviews();
    return () => { mounted = false; };
  }, [productId]);

  const handleToggleLike = async () => {
    if (!user) {
      Alert.alert('Please log in', 'You need to be logged in to like products.');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('toggle_product_like', {
        p_product_id: productId,
      });

      if (error) throw error;

      setLiked(data?.liked);
      setLikeCount(data?.count || 0);
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const imageUri = product ? getProductImageUri(product.images) : null;
  const productImages: string[] = Array.isArray(product?.images)
    ? product.images
        .map((img: unknown) => {
          if (!img || typeof img !== 'object' || !('path' in img)) return null;
          const path = (img as { path?: unknown }).path;
          if (typeof path !== 'string' || !path.trim()) return null;
          return toPublicProductImageUrl(path);
        })
        .filter((img: string | null): img is string => Boolean(img))
    : [];
  const galleryImages = productImages.length ? productImages : imageUri ? [imageUri] : [];

  const handleSubmitReview = async () => {
    if (!user) {
      Alert.alert('Please log in', 'You need to be logged in to leave a review.');
      return;
    }

    if (!reviewForm.body.trim()) {
      Alert.alert('Missing review', 'Please write your review.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('submit_review', {
        p_product_id: productId,
        p_rating: reviewForm.rating,
        p_body: reviewForm.body,
      });

      if (error) {
        console.error('Review submission error:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      Alert.alert('Success', 'Your review has been published!');
      setReviewForm({ rating: 5, body: '' });
      setReviewModalVisible(false);
      
      // Reload reviews to show the new one
      const { data: newReviews } = await supabase
        .from('reviews')
        .select('id, rating, body, created_at, users(full_name)')
        .eq('product_id', productId)
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(10);
      if (newReviews) setReviews(newReviews);
    } catch (error) {
      console.error('Full error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          {galleryImages.length ? (
            <>
              <FlatList
                data={galleryImages}
                keyExtractor={(item, index) => `${item}-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(event.nativeEvent.contentOffset.x / width);
                  setActiveImageIndex(index);
                }}
                renderItem={({ item, index }) => (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => {
                    setActiveImageIndex(index);
                    setPreviewVisible(true);
                  }}>
                    <Image source={{ uri: item }} style={styles.image} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
              <View style={styles.dotsRow}>
                {galleryImages.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      { backgroundColor: index === activeImageIndex ? colors.primary : colors.muted },
                    ]}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surface }]}>
              <Ionicons name="image-outline" size={30} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 6 }}>No image available</Text>
            </View>
          )}
          <View style={styles.heroActions}>
            <TouchableOpacity style={[styles.topIconBtn, { backgroundColor: colors.surface }]} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.topIconBtn, { backgroundColor: colors.surface }]}
              onPress={handleToggleLike}
            >
              <MaterialCommunityIcons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? colors.primary : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailsContent}>
          <View style={styles.summarySection}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>{product.title}</Text>
                <Text style={[styles.sku, { color: colors.muted }]}>SKU: {product.sku || 'N/A'}</Text>
              </View>
              <View style={[styles.likeCountPill, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name="heart" size={12} color={colors.primary} />
                <Text style={[styles.likeCountText, { color: colors.primary }]}>{likeCount}</Text>
              </View>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(product.price)}</Text>
            {product.brand ? <Text style={[styles.brand, { color: colors.muted }]}>{product.brand}</Text> : null}
            {!!product.description && (
              <Text style={[styles.description, { color: colors.text }]}>{product.description}</Text>
            )}
          </View>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <View style={[styles.specsCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Specifications</Text>
              <View style={styles.specsContainer}>
                {Object.entries(product.specs).map(([key, value], index) => (
                  <View
                    key={index}
                    style={[
                      styles.specItem,
                      index !== Object.keys(product.specs).length - 1 && {
                        borderBottomColor: colors.background,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text style={[styles.specLabel, { color: colors.muted }]}>{key}</Text>
                    <Text style={[styles.specValue, { color: colors.text }]}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Customer Reviews</Text>
              <TouchableOpacity
                style={[styles.leaveReviewBtn, { backgroundColor: colors.primary }]}
                onPress={() => setReviewModalVisible(true)}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Leave Review</Text>
              </TouchableOpacity>
            </View>

            {reviews.length > 0 ? (
              reviews.map((review, index) => (
                <View
                  key={review.id || index}
                  style={[styles.reviewItem, { borderBottomColor: colors.background }]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewAuthor, { color: colors.text }]}>
                      {review.users?.full_name || 'Anonymous'}
                    </Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color={colors.primary} />
                      <Text style={[styles.rating, { color: colors.primary }]}>{review.rating}</Text>
                    </View>
                  </View>
                  <Text style={[styles.reviewBody, { color: colors.text }]}>{review.body}</Text>
                  <Text style={[styles.reviewDate, { color: colors.muted }]}>
                    {new Date(review.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.noReviewsContainer}>
                <Text style={[styles.noReviewsText, { color: colors.muted }]}>No reviews yet. Be the first to review.</Text>
                <TouchableOpacity
                  style={[styles.leaveReviewBtnLarge, { backgroundColor: colors.primary }]}
                  onPress={() => setReviewModalVisible(true)}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Leave a Review</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom ? insets.bottom + 8 : 18, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.surface }]}
          onPress={async () => {
            try {
              await addItem(
                {
                  product_id: product.id,
                  sku: product.sku || '',
                  title: product.title,
                  price: Number(product.price || 0),
                  image_url: imageUri || undefined,
                },
                1
              );
              navigation?.navigate('Main', { tab: 'cart' });
            } catch (error) {
              Alert.alert('Cart error', error instanceof Error ? error.message : 'Could not add to cart.');
            }
          }}
        >
          <Ionicons name="cart-outline" size={17} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: colors.primary }]}
          onPress={async () => {
            try {
              await addItem(
                {
                  product_id: product.id,
                  sku: product.sku || '',
                  title: product.title,
                  price: Number(product.price || 0),
                  image_url: imageUri || undefined,
                },
                1
              );
              navigation?.navigate('Checkout');
            } catch (error) {
              Alert.alert('Checkout error', error instanceof Error ? error.message : 'Could not continue to checkout.');
            }
          }}
        >
          <Ionicons name="flash-outline" size={17} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800' }}>Buy Now</Text>
        </TouchableOpacity>
      </View>

      <Modal
          visible={previewVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.previewOverlay}>
            <Pressable style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <FlatList
              data={galleryImages}
              keyExtractor={(item, index) => `${item}-preview-${index}`}
              horizontal
              pagingEnabled
              initialScrollIndex={activeImageIndex}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                setActiveImageIndex(index);
              }}
              renderItem={({ item }) => (
                <View style={styles.previewImageWrap}>
                  <Image source={{ uri: item }} style={styles.previewImage} resizeMode="contain" />
                </View>
              )}
            />
          </View>
        </Modal>

      <Modal
          visible={reviewModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setReviewModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <Pressable 
              style={styles.backdropTouchable}
              onPress={() => setReviewModalVisible(false)}
            />
            <View 
              style={[styles.modalContainer, { backgroundColor: colors.background }]}
              onStartShouldSetResponder={() => true}
              onTouchStart={(e) => {
                modalStartY.current = e.nativeEvent.pageY;
              }}
              onTouchEnd={(e) => {
                const endY = e.nativeEvent.pageY;
                if (endY - modalStartY.current > 80) {
                  setReviewModalVisible(false);
                }
              }}
            >
              <View style={[styles.modalHandle, { backgroundColor: colors.muted }]} />
              
              <ScrollView 
                style={styles.modalContent} 
                showsVerticalScrollIndicator={false} 
                scrollEnabled={true}
                nestedScrollEnabled={true}
              >
                <Text style={[styles.formLabel, { color: colors.text }]}>Your Rating</Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setReviewForm({ ...reviewForm, rating: star })}
                    >
                      <Text style={[styles.starButton, { color: star <= reviewForm.rating ? colors.primary : colors.muted }]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.ratingValue, { color: colors.text }]}>{reviewForm.rating} out of 5</Text>

                <Text style={[styles.formLabel, { color: colors.text, marginTop: 20 }]}>Your Review</Text>
                <TextInput
                  style={[styles.textAreaInput, { borderColor: colors.muted, color: colors.text }]}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={colors.muted}
                  value={reviewForm.body}
                  onChangeText={(text) => setReviewForm({ ...reviewForm, body: text })}
                  multiline
                  numberOfLines={6}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: colors.muted }]}>{reviewForm.body.length}/500</Text>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
                  onPress={handleSubmitReview}
                  disabled={submitting}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroWrap: { position: 'relative' },
  image: { width, height: 340 },
  imagePlaceholder: { width, height: 300, alignItems: 'center', justifyContent: 'center' },
  heroActions: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 999, opacity: 0.8 },
  detailsContent: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  summarySection: { paddingVertical: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  title: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  sku: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  likeCountPill: {
    minWidth: 44,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  likeCountText: { fontSize: 12, fontWeight: '800' },
  price: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  brand: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  description: { marginTop: 12, lineHeight: 21 },
  specsCard: {
    borderRadius: 18,
    padding: 14,
  },
  reviewsSection: { paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  specsContainer: { borderRadius: 10, overflow: 'hidden' },
  specItem: { paddingVertical: 11, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between' },
  specLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  specValue: { fontSize: 13, textAlign: 'right', flex: 1 },
  reviewsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  leaveReviewBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  leaveReviewBtnLarge: { marginTop: 10, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  noReviewsContainer: { marginTop: 8, marginBottom: 8 },
  noReviewsText: { marginBottom: 12, fontSize: 13 },
  reviewItem: {
    borderRadius: 0,
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reviewTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  reviewAuthor: { fontSize: 13, fontWeight: '700' },
  ratingBadge: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  rating: { fontSize: 13, fontWeight: '800' },
  reviewBody: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  reviewDate: { fontSize: 11 },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    width: '49%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  buyBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    width: '49%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderRadius: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImageWrap: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: width,
    height: '100%',
  },
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'flex-end' 
  },
  backdropTouchable: {
    flex: 1,
  },
  modalContainer: { 
    height: Dimensions.get('window').height * 0.55,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  modalHandle: { 
    width: 40, 
    height: 4, 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginBottom: 12 
  },
  modalContent: { flex: 1, padding: 16 },
  formLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  ratingSelector: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  starButton: { fontSize: 32 },
  ratingValue: { fontSize: 12, marginBottom: 16 },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4 },
  textAreaInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 4, maxHeight: 120 },
  charCount: { fontSize: 11, marginBottom: 16, textAlign: 'right' },
  submitBtn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 16, marginBottom: 16 },
});
