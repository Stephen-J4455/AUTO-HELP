import React from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';

const VEHICLE_IMAGES_BUCKET = 'vehicle-images';

type Vehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  year_to: number | null;
  trim: string | null;
  engine: string | null;
  body_type: string | null;
  fuel_type: string | null;
  transmission: string | null;
  drivetrain: string | null;
  image: string | null;
};

function toPublicImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const { data } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function Vehicle({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadVehicles = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, make, model, year, year_to, trim, engine, body_type, fuel_type, transmission, drivetrain, image')
        .order('year', { ascending: false })
        .order('make', { ascending: true })
        .order('model', { ascending: true })
        .limit(500);

      if (error) throw error;
      setVehicles((data as Vehicle[]) || []);
    } catch (error) {
      console.warn('Failed to load vehicles', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.listContent}
      data={vehicles}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void loadVehicles();
          }}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) => {
        const yearLabel = item.year_to ? `${item.year}-${item.year_to}` : String(item.year);
        const details = [item.trim, item.engine, item.body_type, item.fuel_type, item.transmission, item.drivetrain]
          .filter(Boolean)
          .join(' • ');
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() =>
              navigateTo?.('VehicleParts', {
                vehicleId: item.id,
                vehicleName: `${yearLabel} ${item.make} ${item.model}`,
                vehicleMake: item.make,
                vehicleModel: item.model,
                vehicleYear: item.year,
                vehicleYearTo: item.year_to,
              })
            }
          >
            <View style={[styles.imageWrap, { backgroundColor: colors.background }]}>
              {item.image ? (
                <Image source={{ uri: toPublicImageUrl(item.image) }} style={styles.vehicleImage} />
              ) : (
                <Ionicons name="car-sport-outline" size={32} color={colors.muted} />
              )}
            </View>
            <View style={styles.cardTextWrap}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  {yearLabel} {item.make} {item.model}
                </Text>
                {!!details && (
                  <Text style={[styles.cardSubTitle, { color: colors.muted }]} numberOfLines={2}>
                    {details}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="car-outline" size={44} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No vehicles available</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>Vehicles added by admin will show here.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  imageWrap: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  cardTextWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubTitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    marginTop: 90,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '800',
  },
  emptySub: {
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
});
