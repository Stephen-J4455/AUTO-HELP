import React from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

const VEHICLE_IMAGES_BUCKET = 'vehicle-images';
const { width } = Dimensions.get('window');

type Product = {
  id: string;
  title: string;
  sku: string;
  brand: string | null;
  price: number;
  imageUri: string | null;
};

type VehicleInfo = {
  image: string | null;
  trim: string | null;
  engine: string | null;
  body_type: string | null;
  fuel_type: string | null;
  transmission: string | null;
  drivetrain: string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPublicImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const { data } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function VehicleParts({ route, navigation }: { route: any; navigation: any }) {
  const { colors } = useTheme();
  const vehicleId = route?.params?.vehicleId as string | undefined;
  const vehicleMake = route?.params?.vehicleMake as string | undefined;
  const vehicleModel = route?.params?.vehicleModel as string | undefined;
  const vehicleYear = route?.params?.vehicleYear as number | undefined;
  const vehicleYearTo = route?.params?.vehicleYearTo as number | undefined;
  const vehicleName = (route?.params?.vehicleName as string | undefined) || 'Vehicle Parts';
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [vehicle, setVehicle] = React.useState<VehicleInfo | null>(null);
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    navigation?.setOptions?.({ title: vehicleName, headerShown: false });
  }, [navigation, vehicleName]);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const loadData = React.useCallback(async () => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    try {
      const [{ data: vehicleData, error: vehicleError }, { data, error }] = await Promise.all([
        supabase
          .from('vehicles')
          .select('image, trim, engine, body_type, fuel_type, transmission, drivetrain')
          .eq('id', vehicleId)
          .maybeSingle(),
        supabase
          .from('products')
          .select('id, title, sku, brand, price, images, fitments')
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (vehicleError) {
        console.warn('Failed to load vehicle', vehicleError.message);
      } else if (vehicleData) {
        setVehicle(vehicleData as VehicleInfo);
      }

      if (error) {
        console.warn('Failed to load vehicle parts', error.message);
      } else if (data) {
        const normalizedMake = normalizeText(vehicleMake);
        const normalizedModel = normalizeText(vehicleModel);
        const normalizedYear = toNumber(vehicleYear);

        const filteredRows = data.filter((row: any) => {
          if (!Array.isArray(row.fitments)) return false;
          return row.fitments.some((fitment: any) => {
            if (!fitment || typeof fitment !== 'object') return false;

            if (vehicleId && fitment.vehicle_id === vehicleId) return true;

            const fitmentMake = normalizeText(fitment.make);
            const fitmentModel = normalizeText(fitment.model);
            if (!normalizedMake || !normalizedModel) return false;
            if (fitmentMake !== normalizedMake || fitmentModel !== normalizedModel) return false;

            if (normalizedYear === null) return true;
            const fitmentYear = toNumber(fitment.year);
            if (fitmentYear !== null) return fitmentYear === normalizedYear;

            const fitmentYearFrom = toNumber(fitment.year_from);
            const fitmentYearTo = toNumber(fitment.year_to);
            if (fitmentYearFrom !== null && fitmentYearTo !== null) {
              return normalizedYear >= fitmentYearFrom && normalizedYear <= fitmentYearTo;
            }

            return false;
          });
        });

        setProducts(
          filteredRows.map((row: any) => ({
            id: String(row.id),
            title: String(row.title || 'Product'),
            sku: String(row.sku || ''),
            brand: row.brand ? String(row.brand) : null,
            price: Number(row.price || 0),
            imageUri: getProductImageUri(row.images),
          }))
        );
      }
    } catch (error) {
      console.warn('Failed to load vehicle parts', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vehicleId, vehicleMake, vehicleModel, vehicleYear]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const yearLabel = vehicleYearTo ? `${vehicleYear}-${vehicleYearTo}` : String(vehicleYear ?? '');
  const specChips = [vehicle?.body_type, vehicle?.fuel_type, vehicle?.transmission, vehicle?.drivetrain, vehicle?.engine]
    .filter((v): v is string => Boolean(v))
    .slice(0, 4);

  const renderHero = () => (
    <View style={styles.hero}>
      {vehicle?.image ? (
        <Image source={{ uri: toPublicImageUrl(vehicle.image) }} style={styles.heroImage} />
      ) : (
        <View style={[styles.heroImageFallback, { backgroundColor: colors.surface }]}>
          <Ionicons name="car-sport-outline" size={48} color={colors.muted} />
        </View>
      )}

      {/* Gradient scrim for text legibility over the image */}
      <View style={styles.heroScrim} pointerEvents="none" />

      <TouchableOpacity
        style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        activeOpacity={0.8}
        onPress={() => navigation?.goBack()}
      >
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>

      <View style={styles.heroOverlay}>
        <View style={styles.heroTopRow}>
          {yearLabel ? (
            <View style={[styles.yearBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.yearBadgeText}>{yearLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.heroTitle} numberOfLines={1}>
            {vehicleMake} {vehicleModel}
          </Text>
        </View>
        {vehicle?.trim ? (
          <Text style={styles.heroTrim} numberOfLines={1}>
            {vehicle.trim}
          </Text>
        ) : null}

        {specChips.length > 0 && (
          <View style={styles.heroChips}>
            {specChips.map((chip, idx) => (
              <View key={idx} style={styles.heroChip}>
                <Text style={styles.heroChipText} numberOfLines={1}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.surface }]}
      activeOpacity={0.86}
      onPress={() => navigation?.navigate?.('ProductDetails', { productId: item.id })}
    >
      <View style={[styles.productImageWrap, { backgroundColor: colors.background }]}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.productImage} />
        ) : (
          <Ionicons name="cube-outline" size={26} color={colors.muted} />
        )}
      </View>
      <View style={styles.productBody}>
        {item.brand ? (
          <Text style={[styles.brand, { color: colors.primary }]} numberOfLines={1}>
            {item.brand}
          </Text>
        ) : null}
        <Text style={[styles.productTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.productFooter}>
          <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(item.price)}</Text>
          {item.sku ? (
            <Text style={[styles.sku, { color: colors.muted }]} numberOfLines={1}>
              {item.sku}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderProductSkeleton = () => (
    <Animated.View style={[styles.productCard, { opacity: shimmer }]}>
      <View style={[styles.productImageWrap, { backgroundColor: colors.background }]} />
      <View style={styles.productBody}>
        <View style={[styles.skeletonLine, { backgroundColor: colors.background, width: '40%' }]} />
        <View style={[styles.skeletonLine, { backgroundColor: colors.background, width: '80%' }]} />
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHero()}
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <React.Fragment key={idx}>{renderProductSkeleton()}</React.Fragment>
          ))}
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.list}
      data={products}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.column}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadData();
          }}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={renderHero}
      renderItem={renderProduct}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="cube-outline" size={42} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No parts found</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            No products are linked to this vehicle yet.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 14, paddingBottom: 120, gap: 12 },
  column: { gap: 12 },
  hero: {
    marginHorizontal: -14,
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    height: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backBtn: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  heroOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  yearBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  heroTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroTrim: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  heroChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingBottom: 120,
    gap: 12,
  },
  productCard: {
    width: (width - 42) / 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  productImageWrap: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productBody: {
    padding: 10,
    gap: 4,
  },
  brand: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  productTitle: {
    fontSize: 13,
    fontWeight: '800',
    minHeight: 34,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '900',
  },
  sku: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
});