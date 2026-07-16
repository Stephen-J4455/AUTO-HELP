import React from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

type Product = {
  id: string;
  title: string;
  sku: string;
  brand: string | null;
  price: number;
  imageUri: string | null;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function VehicleParts({ route, navigation }: { route: any; navigation: any }) {
  const { colors } = useTheme();
  const vehicleId = route?.params?.vehicleId as string | undefined;
  const vehicleMake = route?.params?.vehicleMake as string | undefined;
  const vehicleModel = route?.params?.vehicleModel as string | undefined;
  const vehicleYear = route?.params?.vehicleYear as number | undefined;
  const vehicleName = (route?.params?.vehicleName as string | undefined) || 'Vehicle Parts';
  const [loading, setLoading] = React.useState(true);
  const [products, setProducts] = React.useState<Product[]>([]);

  React.useEffect(() => {
    navigation?.setOptions?.({ title: vehicleName });
  }, [navigation, vehicleName]);

  React.useEffect(() => {
    let mounted = true;
    async function loadProducts() {
      if (!vehicleId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('id, title, sku, brand, price, images, fitments')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.warn('Failed to load vehicle parts', error.message);
      } else if (mounted && data) {
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

      if (mounted) setLoading(false);
    }

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, [vehicleId]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }]}
            activeOpacity={0.86}
            onPress={() => navigation?.navigate?.('ProductDetails', { productId: item.id })}
          >
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.image} />
            ) : (
              <View style={[styles.image, styles.placeholder, { backgroundColor: colors.background }]}>
                <Ionicons name="cube-outline" size={26} color={colors.muted} />
              </View>
            )}
            <View style={styles.cardBody}>
              {item.brand ? (
                <Text style={[styles.brand, { color: colors.primary }]} numberOfLines={1}>
                  {item.brand}
                </Text>
              ) : null}
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[styles.sku, { color: colors.muted }]} numberOfLines={1}>
                SKU: {item.sku || 'N/A'}
              </Text>
              <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(item.price)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cube-outline" size={42} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No parts found</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>No products are linked to this vehicle yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 , paddingTop: 30},
  center: { justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 24, gap: 12 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 170,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: 12,
    gap: 6,
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  sku: {
    fontSize: 12,
    fontWeight: '600',
  },
  price: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: 'center',
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
});
