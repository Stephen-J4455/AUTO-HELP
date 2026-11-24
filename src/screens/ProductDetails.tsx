import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  GestureResponderEvent,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useTheme } from "../theme";
import { supabase } from "../supabase/supabase";
import { useCart } from "../context/Cart";
import { useAuth } from "../context/Auth";
import { useAppAlert } from "../components/AppAlert";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import {
  getProductImageUri,
  toPublicProductImageUrl,
} from "../utils/productImages";
import { loadImageSize, peekImageSize } from "../utils/imageSize";
import PageHeader from "../components/PageHeader";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { formatCedis } from "../utils/currency";

const { width } = Dimensions.get("window");

// Dark mode sets `surface` equal to `background`, so any surface-filled
// container or divider would be invisible there. These hairlines supply the
// separation instead, matching the Home feed and Cart.
const HAIRLINE = "rgba(0, 0, 0, 0.10)";
const HAIRLINE_DARK = "rgba(255, 255, 255, 0.14)";

// Every gallery image shares one hero band so the carousel does not jump
// between slide heights. The band is sized from the *tallest* image ratio in
// the set, because that is the only height at which every image can render at
// full device width at once. Shorter images letterbox inside the band, which
// keeps the layout stable instead of resizing per slide.
//
// There is deliberately NO upper clamp. With `contain`, an image only reaches
// the full device width when the band is at least its natural full-width
// height; clamping the band makes `contain` scale tall photos down to fit the
// height, which renders them narrower than the screen. Removing the clamp is
// what guarantees every image fills the width.
const HERO_FALLBACK_HEIGHT = 340;
const HERO_MIN_HEIGHT = 200;

/**
 * Height for a uniform hero band that lets every image fill the device width.
 *
 * Uses the tallest aspect ratio in the gallery so every image reaches the full
 * screen width. Only a lower bound is applied: an upper bound would make
 * `contain` shrink tall photos, so the band is allowed to grow as tall as the
 * tallest image needs. Falls back to a sensible default before measurement.
 */
function heroHeightForGallery(
  uris: string[],
  sizes: Record<string, { width: number; height: number }>,
): number {
  let tallestRatio = 0;
  uris.forEach((uri) => {
    const size = sizes[uri] ?? peekImageSize(uri);
    if (!size || !size.width || !size.height) return;
    const ratio = size.height / size.width;
    if (ratio > tallestRatio) tallestRatio = ratio;
  });

  if (!tallestRatio) return HERO_FALLBACK_HEIGHT;
  return Math.max(Math.round(width * tallestRatio), HERO_MIN_HEIGHT);
}

export default function ProductDetails({ route, navigation }: any) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { productId } = route.params || {};
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [productError, setProductError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Intrinsic sizes of the gallery images, keyed by uri. Used to size the hero
  // from each image's real aspect ratio.
  const [imageSizes, setImageSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, body: "" });
  const [submitting, setSubmitting] = useState(false);
  const { addItem } = useCart();
  const { show: showAlert } = useAppAlert();
  const modalStartY = useRef(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!productId) {
        setProductError(true);
        return;
      }
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();
      if (!mounted) return;
      if (error || !data) {
        setProductError(true);
        return;
      }
      setProduct(data);
    }
    setProductError(false);
    setProduct(null);
    void load().catch(() => {
      if (mounted) setProductError(true);
    });
    return () => {
      mounted = false;
    };
  }, [productId, loadAttempt]);

  useEffect(() => {
    let mounted = true;
    async function loadLikes() {
      if (!productId) return;

      const { count } = await supabase
        .from("product_likes")
        .select("*", { count: "exact" })
        .eq("product_id", productId);

      if (mounted) setLikeCount(count || 0);

      if (user) {
        const { data } = await supabase
          .from("product_likes")
          .select("id")
          .eq("product_id", productId)
          .eq("user_id", user.id)
          .limit(1);

        if (mounted) setLiked(!!data && data.length > 0);
      }
    }
    loadLikes();
    return () => {
      mounted = false;
    };
  }, [productId, user]);

  useEffect(() => {
    let mounted = true;
    async function loadReviews() {
      if (!productId) return;
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, body, created_at, users(full_name)")
        .eq("product_id", productId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) {
        console.warn("Failed to load reviews", error.message);
        return;
      }
      if (mounted) setReviews(data || []);
    }
    loadReviews();
    return () => {
      mounted = false;
    };
  }, [productId]);

  const handleToggleLike = async () => {
    if (!user) {
      showAlert({
        title: "Please log in",
        message: "You need to be logged in to like products.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.rpc("toggle_product_like", {
        p_product_id: productId,
      });

      if (error) throw error;

      setLiked(data?.liked);
      setLikeCount(data?.count || 0);
    } catch (error) {
      console.error("Error toggling like:", error);
      showAlert({ title: "Error", message: "Failed to update like" });
    }
  };

  const imageUri = product ? getProductImageUri(product.images) : null;
  // Memoised so the array identity is stable across renders. Without this the
  // measuring effect below re-runs on every render and sets state each time,
  // which React reports as "Maximum update depth exceeded".
  const galleryImages = React.useMemo<string[]>(() => {
    if (!Array.isArray(product?.images)) return imageUri ? [imageUri] : [];
    const list = product.images
      .map((img: unknown) => {
        if (!img || typeof img !== "object" || !("path" in img)) return null;
        const path = (img as { path?: unknown }).path;
        if (typeof path !== "string" || !path.trim()) return null;
        return toPublicProductImageUrl(path);
      })
      .filter((img: string | null): img is string => Boolean(img));
    if (list.length) return list;
    return imageUri ? [imageUri] : [];
  }, [product?.images, imageUri]);

  // Dark mode collapses `surface` onto `background`, so cards and dividers
  // need an explicit hairline to stay visible.
  const hairline = scheme === "dark" ? HAIRLINE_DARK : HAIRLINE;

  // One height shared by every gallery slide, so the carousel band stays put.
  const heroHeight = React.useMemo(
    () => heroHeightForGallery(galleryImages, imageSizes),
    [galleryImages, imageSizes],
  );

  // Mean rating across loaded reviews, used for the summary strip.
  const averageRating = React.useMemo(() => {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  // Measure every gallery image so the hero can be sized from the real aspect
  // ratio. Sizes are cached globally by `loadImageSize`, so revisiting a
  // product costs nothing.
  useEffect(() => {
    if (!galleryImages.length) return;
    let cancelled = false;

    // Seed synchronously from cache so a revisited product does not resize.
    const seeded: Record<string, { width: number; height: number }> = {};
    galleryImages.forEach((uri) => {
      const cached = peekImageSize(uri);
      if (cached) seeded[uri] = cached;
    });
    if (Object.keys(seeded).length) {
      setImageSizes((prev) => ({ ...prev, ...seeded }));
    }

    const missing = galleryImages.filter((uri) => !peekImageSize(uri));
    if (!missing.length) return;

    void Promise.all(
      missing.map((uri) =>
        loadImageSize(uri).then((size) => [uri, size] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, { width: number; height: number }> = {};
      entries.forEach(([uri, size]) => {
        if (size) next[uri] = size;
      });
      if (Object.keys(next).length) {
        setImageSizes((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [galleryImages]);

  const handleSubmitReview = async () => {
    if (!user) {
      showAlert({
        title: "Please log in",
        message: "You need to be logged in to leave a review.",
      });
      return;
    }

    if (!reviewForm.body.trim()) {
      showAlert({
        title: "Missing review",
        message: "Please write your review.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_review", {
        p_product_id: productId,
        p_rating: reviewForm.rating,
        p_body: reviewForm.body,
      });

      if (error) {
        console.error("Review submission error:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showAlert({
        title: "Success",
        message: "Your review has been published!",
      });
      setReviewForm({ rating: 5, body: "" });
      setReviewModalVisible(false);

      // Reload reviews to show the new one
      const { data: newReviews } = await supabase
        .from("reviews")
        .select("id, rating, body, created_at, users(full_name)")
        .eq("product_id", productId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (newReviews) setReviews(newReviews);
    } catch (error) {
      console.error("Full error:", error);
      showAlert({
        title: "Error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to submit review. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) {
    return (
      <SafeAreaView style={[styles.wrapper, { backgroundColor: colors.background }]}>
        <PageHeader title="Part details" onBack={() => navigation.goBack()} />
        {productError ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={34} color={colors.muted} />
            <Text style={{ color: colors.text }}>This part could not be loaded.</Text>
            {!!productId && (
              <Pressable accessibilityRole="button" style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => setLoadAttempt((attempt) => attempt + 1)}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Try again</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View accessibilityLabel="Loading part details" accessible style={styles.detailSkeleton}>
            <View style={[styles.skeletonImage, { backgroundColor: colors.border }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: "72%" }]} />
            <View style={[styles.skeletonLine, { backgroundColor: colors.border, width: "38%" }]} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
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
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / width,
                  );
                  setActiveImageIndex(index);
                }}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => {
                      setActiveImageIndex(index);
                      setPreviewVisible(true);
                    }}
                  >
                    {/* One shared height for every slide, so swiping never
                        changes the band. `contain` keeps each image whole and
                        fits it within the device width. */}
                    <View
                      style={[
                        styles.imageStage,
                        {
                          height: heroHeight,
                          backgroundColor: colors.background,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: item }}
                        style={styles.image}
                        resizeMode="contain"
                      />
                    </View>
                  </TouchableOpacity>
                )}
              />
              {galleryImages.length > 1 ? (
                <View style={styles.dotsRow}>
                  <View
                    style={[
                      styles.imageCounter,
                      { backgroundColor: "rgba(0,0,0,0.55)" },
                    ]}
                  >
                    <Ionicons name="images-outline" size={11} color="#fff" />
                    <Text style={styles.imageCounterText}>
                      {activeImageIndex + 1}/{galleryImages.length}
                    </Text>
                  </View>
                  <View style={styles.dotTrack}>
                    {galleryImages.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              index === activeImageIndex
                                ? colors.primary
                                : colors.muted,
                            opacity: index === activeImageIndex ? 1 : 0.35,
                            width: index === activeImageIndex ? 18 : 6,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                {
                  height: heroHeight,
                  backgroundColor: colors.background,
                  borderColor: hairline,
                },
              ]}
            >
              <Ionicons name="image-outline" size={30} color={colors.muted} />
              <Text
                style={[styles.imagePlaceholderText, { color: colors.muted }]}
              >
                No image available
              </Text>
            </View>
          )}
          <View style={[styles.heroActions, { top: insets.top + 8 }]}>
            <TouchableOpacity
              style={[
                styles.topIconBtn,
                { backgroundColor: colors.background, borderColor: hairline },
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.topIconBtn,
                {
                  backgroundColor: colors.background,
                  borderColor: liked ? colors.primary : hairline,
                },
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                liked ? "Remove from wishlist" : "Add to wishlist"
              }
              onPress={handleToggleLike}
            >
              <MaterialCommunityIcons
                name={liked ? "heart" : "heart-outline"}
                size={20}
                color={liked ? colors.primary : colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.detailsContent}>
          <View style={styles.summarySection}>
            {product.brand ? (
              <Text style={[styles.brandEyebrow, { color: colors.primary }]}>
                {product.brand}
              </Text>
            ) : null}

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.text }]}>
                {product.title}
              </Text>
              <View style={[styles.likeCountPill, { borderColor: hairline }]}>
                <Ionicons
                  name="heart"
                  size={12}
                  color={liked ? colors.primary : colors.muted}
                />
                <Text style={[styles.likeCountText, { color: colors.muted }]}>
                  {likeCount}
                </Text>
              </View>
            </View>

            <View style={[styles.priceRow, { borderColor: hairline }]}>
              <Text style={[styles.price, { color: colors.text }]}>
                {formatCedis(product.price)}
              </Text>
              {product.sku ? (
                <Text style={[styles.sku, { color: colors.muted }]}>
                  SKU {product.sku}
                </Text>
              ) : null}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={13}
                  color={colors.primary}
                />
                <Text style={[styles.metaChipText, { color: colors.muted }]}>
                  Genuine part
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="star" size={13} color={colors.primary} />
                <Text style={[styles.metaChipText, { color: colors.muted }]}>
                  {averageRating > 0
                    ? `${averageRating} (${reviews.length})`
                    : "No ratings yet"}
                </Text>
              </View>
              {product.pay_on_delivery ? (
                <View style={styles.metaChip}>
                  <Ionicons
                    name="cash-outline"
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={[styles.metaChipText, { color: colors.muted }]}>
                    Pay on delivery
                  </Text>
                </View>
              ) : null}
            </View>

            {!!product.description && (
              <Text style={[styles.description, { color: colors.text }]}>
                {product.description}
              </Text>
            )}
          </View>

          {product.specs && Object.keys(product.specs).length > 0 && (
            <View
              style={[
                styles.specsCard,
                { backgroundColor: colors.background, borderColor: hairline },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Specifications
              </Text>
              {Object.entries(product.specs).map(([key, value], index) => (
                <View
                  key={index}
                  style={[
                    styles.specItem,
                    index !== Object.keys(product.specs).length - 1 && {
                      borderBottomColor: hairline,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text style={[styles.specLabel, { color: colors.muted }]}>
                    {key}
                  </Text>
                  <Text style={[styles.specValue, { color: colors.text }]}>
                    {String(value)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Customer Reviews
              </Text>
              <TouchableOpacity
                style={[styles.leaveReviewBtn, { borderColor: colors.primary }]}
                activeOpacity={0.8}
                accessibilityRole="button"
                onPress={() => setReviewModalVisible(true)}
              >
                <Text
                  style={[styles.leaveReviewBtnText, { color: colors.primary }]}
                >
                  Leave Review
                </Text>
              </TouchableOpacity>
            </View>

            {reviews.length > 0 ? (
              <View
                style={[
                  styles.reviewsCard,
                  { backgroundColor: colors.background, borderColor: hairline },
                ]}
              >
                {reviews.map((review, index) => (
                  <View
                    key={review.id || index}
                    style={[
                      styles.reviewItem,
                      index !== reviews.length - 1 && {
                        borderBottomColor: hairline,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <View style={styles.reviewHeader}>
                      <Text
                        style={[styles.reviewAuthor, { color: colors.text }]}
                      >
                        {review.users?.full_name || "Anonymous"}
                      </Text>
                      <View style={styles.ratingBadge}>
                        <Ionicons
                          name="star"
                          size={12}
                          color={colors.primary}
                        />
                        <Text style={[styles.rating, { color: colors.text }]}>
                          {review.rating}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.reviewBody, { color: colors.text }]}>
                      {review.body}
                    </Text>
                    <Text style={[styles.reviewDate, { color: colors.muted }]}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={[
                  styles.reviewsCard,
                  { backgroundColor: colors.background, borderColor: hairline },
                ]}
              >
                <Text style={[styles.noReviewsText, { color: colors.muted }]}>
                  No reviews yet. Be the first to review.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.leaveReviewBtnLarge,
                    { backgroundColor: colors.primary },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setReviewModalVisible(true)}
                >
                  <Text style={styles.leaveReviewBtnLargeText}>
                    Leave a Review
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom ? insets.bottom + 10 : 18,
            backgroundColor: colors.background,
            borderTopColor: hairline,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.addBtn,
            { backgroundColor: colors.background, borderColor: hairline },
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add to cart"
          onPress={async () => {
            try {
              await addItem(
                {
                  product_id: product.id,
                  sku: product.sku || "",
                  title: product.title,
                  price: Number(product.price || 0),
                  weight_kg: Number(product.weight_kg || 0),
                  pay_on_delivery: Boolean(product.pay_on_delivery),
                  image_url: imageUri || undefined,
                },
                1,
              );
              navigation?.navigate("Main", { tab: "cart" });
            } catch (error) {
              showAlert({
                title: "Cart error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not add to cart.",
              });
            }
          }}
        >
          <Ionicons name="cart-outline" size={17} color={colors.text} />
          <Text style={[styles.addBtnText, { color: colors.text }]}>
            Add to Cart
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.buyBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Buy now"
          onPress={async () => {
            try {
              await addItem(
                {
                  product_id: product.id,
                  sku: product.sku || "",
                  title: product.title,
                  price: Number(product.price || 0),
                  weight_kg: Number(product.weight_kg || 0),
                  pay_on_delivery: Boolean(product.pay_on_delivery),
                  image_url: imageUri || undefined,
                },
                1,
              );
              navigation?.navigate("Checkout");
            } catch (error) {
              showAlert({
                title: "Checkout error",
                message:
                  error instanceof Error
                    ? error.message
                    : "Could not continue to checkout.",
              });
            }
          }}
        >
          <Ionicons name="flash-outline" size={17} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "800" }}>Buy Now</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={previewVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <Pressable
            style={[styles.previewClose, { top: insets.top + 8 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
            onPress={() => setPreviewVisible(false)}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <FlatList
            data={galleryImages}
            keyExtractor={(item, index) => `${item}-preview-${index}`}
            horizontal
            pagingEnabled
            initialScrollIndex={activeImageIndex}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width,
              );
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => (
              <View style={styles.previewImageWrap}>
                <Image
                  source={{ uri: item }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
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
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={10}
            style={styles.modalKav}
          >
            <SafeAreaView
              edges={["bottom"]}
              style={[
                styles.modalContainer,
                { backgroundColor: colors.background },
              ]}
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
              <View
                style={[styles.modalHandle, { backgroundColor: colors.muted }]}
              />

              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}
                nestedScrollEnabled={true}
              >
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  Your Rating
                </Text>
                <View style={styles.ratingSelector}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() =>
                        setReviewForm({ ...reviewForm, rating: star })
                      }
                    >
                      <Text
                        style={[
                          styles.starButton,
                          {
                            color:
                              star <= reviewForm.rating
                                ? colors.primary
                                : colors.muted,
                          },
                        ]}
                      >
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.ratingValue, { color: colors.text }]}>
                  {reviewForm.rating} out of 5
                </Text>

                <Text
                  style={[
                    styles.formLabel,
                    { color: colors.text, marginTop: 20 },
                  ]}
                >
                  Your Review
                </Text>
                <TextInput
                  style={[
                    styles.textAreaInput,
                    { borderColor: hairline, color: colors.text },
                  ]}
                  placeholder="Share your experience with this product..."
                  placeholderTextColor={colors.muted}
                  value={reviewForm.body}
                  onChangeText={(text) =>
                    setReviewForm({ ...reviewForm, body: text })
                  }
                  multiline
                  numberOfLines={6}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={[styles.charCount, { color: colors.muted }]}>
                  {reviewForm.body.length}/500
                </Text>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: submitting ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleSubmitReview}
                  disabled={submitting}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}
                  >
                    {submitting ? "Submitting..." : "Submit Review"}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 14 },
  detailSkeleton: { padding: 16, gap: 13 },
  skeletonImage: { height: 235, borderRadius: 22 },
  skeletonLine: { height: 15, borderRadius: 8 },
  heroWrap: { position: "relative" },
  // Neutral stage behind the photo. `height` is applied per slide at render
  // time from the image's measured aspect ratio.
  imageStage: {
    width,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    width,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  imagePlaceholderText: { marginTop: 8, fontSize: 12, fontWeight: "600" },
  heroActions: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  imageCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  imageCounterText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  dotTrack: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 6, borderRadius: 999 },
  detailsContent: { paddingHorizontal: 16, paddingTop: 14, gap: 14 },
  summarySection: { paddingVertical: 2 },
  brandEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: { flex: 1, fontSize: 21, fontWeight: "900", lineHeight: 28 },
  likeCountPill: {
    minWidth: 46,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  likeCountText: { fontSize: 12, fontWeight: "800" },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  price: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  sku: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaChipText: { fontSize: 11, fontWeight: "700" },
  description: { marginTop: 14, fontSize: 14, lineHeight: 22 },
  specsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  reviewsSection: { paddingBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  specItem: {
    paddingVertical: 11,
    paddingHorizontal: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  specLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  specValue: { fontSize: 13, fontWeight: "700", textAlign: "right", flex: 1 },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  leaveReviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  leaveReviewBtnText: { fontSize: 12, fontWeight: "800" },
  leaveReviewBtnLarge: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 13,
    alignItems: "center",
  },
  leaveReviewBtnLargeText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  reviewsCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  noReviewsText: { fontSize: 13, lineHeight: 19 },
  reviewItem: { paddingVertical: 12 },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewAuthor: { fontSize: 13, fontWeight: "800" },
  ratingBadge: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  rating: { fontSize: 13, fontWeight: "800" },
  reviewBody: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  reviewDate: { fontSize: 11, fontWeight: "600" },
  addBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: { fontSize: 14, fontWeight: "800" },
  buyBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  previewClose: {
    position: "absolute",
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImageWrap: {
    width,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: width,
    height: "100%",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  modalContainer: {
    height: Dimensions.get("window").height * 0.55,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  modalKav: { width: "100%" },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalContent: { flex: 1, padding: 16 },
  formLabel: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  ratingSelector: { flexDirection: "row", gap: 12, marginBottom: 8 },
  starButton: { fontSize: 32 },
  ratingValue: { fontSize: 12, marginBottom: 16 },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 4,
    maxHeight: 120,
  },
  charCount: { fontSize: 11, marginBottom: 16, textAlign: "right" },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
});
