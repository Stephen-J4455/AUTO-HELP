import React from 'react';
import {
  Animated,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

function specChips(item: Vehicle): string[] {
  return [item.body_type, item.fuel_type, item.transmission, item.engine]
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);
}

export default function Vehicle({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const shimmer = React.useRef(new Animated.Value(0)).current;

  const loadVehicles = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, make, model, year, year_to, trim, engine, body_type, fuel_type, transmission, drivetrain, image')
        .order('make', { ascending: true })
        .order('year', { ascending: false })
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
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [loadVehicles, shimmer]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!normalizedQuery) return vehicles;
    return vehicles.filter((v) =>
      `${v.make} ${v.model} ${v.year} ${v.trim ?? ''} ${v.body_type ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [vehicles, normalizedQuery]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const v of filtered) {
      const key = v.make;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const openVehicle = (item: Vehicle) => {
    const yearLabel = item.year_to ? `${item.year}-${item.year_to}` : String(item.year);
    navigateTo?.('VehicleParts', {
      vehicleId: item.id,
      vehicleName: `${yearLabel} ${item.make} ${item.model}`,
      vehicleMake: item.make,
      vehicleModel: item.model,
      vehicleYear: item.year,
      vehicleYearTo: item.year_to,
    });
  };

  const renderCard = (item: Vehicle) => {
    const yearLabel = item.year_to ? `${item.year}-${item.year_to}` : String(item.year);
    const chips = specChips(item);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { backgroundColor: colors.surface }]}
        onPress={() => openVehicle(item)}
      >
        <View style={[styles.imageWrap, { backgroundColor: colors.background }]}>
          {item.image ? (
            <Image source={{ uri: toPublicImageUrl(item.image) }} style={styles.vehicleImage} />
          ) : (
            <Ionicons name="car-sport-outline" size={32} color={colors.muted} />
          )}
          <View style={[styles.yearBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.yearBadgeText}>{yearLabel}</Text>
          </View>
          <View style={[styles.shade, { backgroundColor: colors.overlay }]} pointerEvents="none" />
        </View>

        <View style={styles.cardBody}>
          <View style={{ flex: 1 }}>
            <View style={styles.makeRow}>
              <Text style={[styles.make, { color: colors.primary }]} numberOfLines={1}>
                {item.make.toUpperCase()}
              </Text>
              {!!item.trim && (
                <Text style={[styles.trim, { color: colors.muted }]} numberOfLines={1}>
                  {item.trim}
                </Text>
              )}
            </View>
            <Text style={[styles.model, { color: colors.text }]} numberOfLines={1}>
              {item.model}
            </Text>
            {chips.length > 0 && (
              <View style={styles.chips}>
                {chips.map((chip, idx) => (
                  <View key={idx} style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Text style={[styles.chipText, { color: colors.muted }]} numberOfLines={1}>
                      {chip}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={[styles.chevronWrap, { backgroundColor: colors.background }]}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeleton = () => (
    <Animated.View style={[styles.card, { opacity: shimmer }]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.background }]} />
      <View style={styles.cardBody}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.skeletonLine, { backgroundColor: colors.background, width: '40%' }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.background, width: '70%' }]} />
          <View style={[styles.skeletonLine, { backgroundColor: colors.background, width: '90%', height: 22 }]} />
        </View>
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Vehicles</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          {loading ? 'Loading your vehicles…' : `${filtered.length} vehicle${filtered.length === 1 ? '' : 's'} available`}
        </Text>

        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search make, model, year…"
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={Array.from({ length: 4 })}
          keyExtractor={(_, idx) => `sk-${idx}`}
          showsVerticalScrollIndicator={false}
          renderItem={renderSkeleton}
        />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={grouped}
          keyExtractor={([make]) => make}
          showsVerticalScrollIndicator={false}
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
          renderItem={({ item: [make, items] }) => (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <Text style={[styles.groupTitle, { color: colors.text }]}>{make}</Text>
                <Text style={[styles.groupCount, { color: colors.muted }]}>{items.length}</Text>
              </View>
              {items.map((v) => (
                <View key={v.id} style={styles.cardSpacing}>
                  {renderCard(v)}
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="car-outline" size={44} color={colors.muted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {normalizedQuery ? 'No vehicles found' : 'No vehicles available'}
              </Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>
                {normalizedQuery
                  ? 'Try a different search term.'
                  : 'Vehicles added by admin will show here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    paddingTop: 4,
  },
  group: {
    marginBottom: 18,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  groupCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  cardSpacing: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  imageWrap: {
    width: '100%',
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  yearBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  yearBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  makeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  make: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  trim: {
    fontSize: 11,
    fontWeight: '700',
  },
  model: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevronWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
});