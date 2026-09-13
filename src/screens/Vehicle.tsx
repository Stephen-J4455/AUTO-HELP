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
  Modal,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { supabase } from '../supabase/supabase';
import { useAuth } from '../context/Auth';
import { getProductImageUri } from '../utils/productImages';
import { formatCedis } from '../utils/currency';
import { cacheReadThrough } from '../utils/cache';

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

type UserCar = {
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
  notes: string | null;
  image: string | null;
};

type Product = {
  id: string;
  title: string;
  sku: string;
  brand: string | null;
  price: number;
  imageUri: string | null;
};

function toPublicImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const { data } = supabase.storage.from(VEHICLE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function specChips(item: Vehicle | UserCar): string[] {
  return [item.body_type, item.fuel_type, item.transmission, item.engine]
    .filter((v): v is string => Boolean(v))
    .slice(0, 3);
}

export default function Vehicle({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const shimmer = React.useRef(new Animated.Value(0)).current;

  // --- "My car" state ---
  const [myCars, setMyCars] = React.useState<UserCar[]>([]);
  const [addCarVisible, setAddCarVisible] = React.useState(false);
  const [carDetail, setCarDetail] = React.useState<UserCar | null>(null);
  const [carParts, setCarParts] = React.useState<Product[]>([]);
  const [carPartsLoading, setCarPartsLoading] = React.useState(false);

  // NHTSA lookup
  const CURRENT_YEAR = new Date().getFullYear();
  const NHTSA_YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i));
  const [vpicMake, setVpicMake] = React.useState('');
  const [vpicYear, setVpicYear] = React.useState('');
  const [vpicMakeQuery, setVpicMakeQuery] = React.useState('');
  const [vpicResults, setVpicResults] = React.useState<{ Make_Name?: string; Model_Name?: string }[]>([]);
  const [vpicLoading, setVpicLoading] = React.useState(false);
  const [nhtsaMakes, setNhtsaMakes] = React.useState<string[]>([]);
  const [nhtsaMakesLoading, setNhtsaMakesLoading] = React.useState(false);
  const [makePickerVisible, setMakePickerVisible] = React.useState(false);
  const [yearPickerVisible, setYearPickerVisible] = React.useState(false);
  const [make, setMake] = React.useState('');
  const [model, setModel] = React.useState('');
  const [year, setYear] = React.useState('');
  const [yearTo, setYearTo] = React.useState('');
  const [engine, setEngine] = React.useState('');
  const [trim, setTrim] = React.useState('');
  const [bodyType, setBodyType] = React.useState('');
  const [fuelType, setFuelType] = React.useState('');
  const [transmission, setTransmission] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const loadVehicles = React.useCallback(async () => {
    try {
      const rows = await cacheReadThrough<Vehicle[]>(
        'vehicles:list',
        async () => {
          const { data, error } = await supabase
            .from('vehicles')
            .select('id, make, model, year, year_to, trim, engine, body_type, fuel_type, transmission, drivetrain, image')
            .order('make', { ascending: true })
            .order('year', { ascending: false })
            .order('model', { ascending: true })
            .limit(500);
          if (error) throw error;
          return (data as Vehicle[]) || [];
        },
        10 * 60,
      );
      setVehicles(rows);
    } catch (error) {
      console.warn('Failed to load vehicles', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMyCars = React.useCallback(async () => {
    if (!user?.id) {
      setMyCars([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_cars')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setMyCars((data as UserCar[]) || []);
    } catch (error) {
      console.warn('Failed to load my cars', error);
    }
  }, [user?.id]);

  React.useEffect(() => {
    void loadVehicles();
    void loadMyCars();
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [loadVehicles, loadMyCars, shimmer]);

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

  const openMyCar = async (car: UserCar) => {
    setCarDetail(car);
    setCarPartsLoading(true);
    setCarParts([]);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, sku, brand, price, images, fitments')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const normMake = normalizeText(car.make);
      const normModel = normalizeText(car.model);
      const normYear = toNumber(car.year);
      const matched = ((data as any[]) || []).filter((row) => {
        if (!Array.isArray(row.fitments)) return false;
        return row.fitments.some((f: any) => {
          if (!f || typeof f !== 'object') return false;
          if (f.vehicle_id) return false; // handled on dedicated vehicle pages
          const fMake = normalizeText(f.make);
          const fModel = normalizeText(f.model);
          if (fMake && fModel) {
            if (fMake !== normMake || fModel !== normModel) return false;
            if (normYear === null) return true;
            const fYear = toNumber(f.year);
            if (fYear !== null) return fYear === normYear;
            const fYf = toNumber(f.year_from);
            const fYt = toNumber(f.year_to);
            if (fYf !== null && fYt !== null) return normYear >= fYf && normYear <= fYt;
          }
          return false;
        });
      });
      setCarParts(
        matched.map((row: any) => ({
          id: String(row.id),
          title: String(row.title || 'Product'),
          sku: String(row.sku || ''),
          brand: row.brand ? String(row.brand) : null,
          price: Number(row.price || 0),
          imageUri: getProductImageUri(row.images),
        }))
      );
    } catch (error) {
      console.warn('Failed to load car parts', error);
    } finally {
      setCarPartsLoading(false);
    }
  };

  // --- NHTSA helpers ---
  async function loadNhtsaMakes() {
    if (nhtsaMakes.length > 0 || nhtsaMakesLoading) return;
    setNhtsaMakesLoading(true);
    try {
      const endpoint = 'https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`NHTSA makes request failed (${response.status}).`);
      const body = (await response.json()) as { Results?: { Make_Name?: string }[] };
      const names = Array.from(
        new Set(
          (body.Results || [])
            .map((item) => item.Make_Name?.trim() || '')
            .filter((name) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));
      setNhtsaMakes(names);
    } catch (error: any) {
      console.warn('NHTSA makes load failed', error?.message);
    } finally {
      setNhtsaMakesLoading(false);
    }
  }

  async function openMakePicker() {
    setMakePickerVisible(true);
    await loadNhtsaMakes();
  }

  async function fetchVpicVehicles() {
    const makeInput = vpicMake.trim();
    const parsedYear = Number(vpicYear);
    if (!makeInput || !vpicYear.trim()) return;
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) return;
    setVpicLoading(true);
    try {
      const endpoint = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(
        makeInput
      )}/modelyear/${parsedYear}?format=json`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`NHTSA request failed (${response.status}).`);
      const body = (await response.json()) as { Results?: { Make_Name?: string; Model_Name?: string }[] };
      const normalized = (body.Results || [])
        .filter((item) => item.Model_Name && item.Model_Name.trim().length > 0)
        .map((item) => ({ Make_Name: item.Make_Name, Model_Name: item.Model_Name }));
      const unique = Array.from(
        new Map(normalized.map((item) => [item.Model_Name?.trim().toUpperCase(), item])).values()
      );
      setVpicResults(unique);
    } catch (error: any) {
      console.warn('NHTSA fetch failed', error?.message);
    } finally {
      setVpicLoading(false);
    }
  }

  function addVehicleFromVpic(item: { Make_Name?: string; Model_Name?: string }) {
    const parsedYear = Number(vpicYear);
    const makeName = (item.Make_Name || vpicMake).trim();
    const modelName = (item.Model_Name || '').trim();
    if (!makeName || !modelName || !Number.isInteger(parsedYear)) return;
    setMake(makeName);
    setModel(modelName);
    setYear(String(parsedYear));
    setVpicResults([]);
  }

  function resetCarForm() {
    setMake('');
    setModel('');
    setYear('');
    setYearTo('');
    setEngine('');
    setTrim('');
    setBodyType('');
    setFuelType('');
    setTransmission('');
    setNotes('');
    setVpicMake('');
    setVpicYear('');
    setVpicResults([]);
    setVpicMakeQuery('');
  }

  function closeAddCar() {
    setAddCarVisible(false);
    resetCarForm();
  }

  async function handleSaveCar() {
    if (!user?.id) return;
    if (!make.trim() || !model.trim() || !year.trim()) return;
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100) return;
    const parsedYearTo = yearTo.trim() ? Number(yearTo) : null;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        make: make.trim(),
        model: model.trim(),
        year: parsedYear,
        year_to: parsedYearTo,
        engine: engine.trim() || null,
        trim: trim.trim() || null,
        body_type: bodyType.trim() || null,
        fuel_type: fuelType.trim() || null,
        transmission: transmission.trim() || null,
        drivetrain: null,
        notes: notes.trim() || null,
      };
      const { error } = await supabase.from('user_cars').insert(payload);
      if (error) throw error;
      closeAddCar();
      await loadMyCars();
    } catch (error: any) {
      console.warn('Failed to save car', error?.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCar(car: UserCar) {
    try {
      const { error } = await supabase.from('user_cars').delete().eq('id', car.id);
      if (error) throw error;
      if (carDetail?.id === car.id) setCarDetail(null);
      await loadMyCars();
    } catch (error: any) {
      console.warn('Failed to delete car', error?.message);
    }
  }

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

  const yearLabel = (car: UserCar) => (car.year_to ? `${car.year}-${car.year_to}` : String(car.year));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Vehicles</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {loading ? 'Loading your vehicles…' : `${filtered.length} vehicle${filtered.length === 1 ? '' : 's'} available`}
            </Text>
          </View>
          {user?.id ? (
            <TouchableOpacity
              style={[styles.myCarBtn, { backgroundColor: myCars.length ? colors.primary : colors.surface, borderColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => {
                if (myCars.length) openMyCar(myCars[0]);
                else setAddCarVisible(true);
              }}
            >
              <Ionicons name="car-sport" size={18} color={myCars.length ? '#fff' : colors.primary} />
              <Text style={[styles.myCarBtnText, { color: myCars.length ? '#fff' : colors.primary }]}>
                {myCars.length ? 'My Car' : 'Add Car'}
              </Text>
              {myCars.length > 1 && (
                <View style={styles.myCarCountBadge}>
                  <Text style={styles.myCarCountText}>{myCars.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

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
                void loadMyCars();
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

      {/* --- Add My Car modal --- */}
      <Modal visible={addCarVisible} animationType="slide" transparent={true} onRequestClose={closeAddCar}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={[styles.modalHeaderBtn, { backgroundColor: colors.surface }]} onPress={closeAddCar}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Your Car</Text>
            <TouchableOpacity
              style={[styles.modalHeaderBtn, { backgroundColor: colors.primary }]}
              disabled={saving}
              onPress={() => void handleSaveCar()}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            <View style={[styles.heroCard, { backgroundColor: `${colors.primary}14` }]}>
              <Text style={[styles.heroTitle, { color: colors.text }]}>Add a vehicle you own</Text>
              <Text style={[styles.heroSubTitle, { color: colors.muted }]}>
                Import from NHTSA vPIC, or add your car manually. We'll show parts that fit it.
              </Text>
            </View>

            <View style={[styles.vpicSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.vpicTitle, { color: colors.text }]}>Import from NHTSA vPIC</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => void openMakePicker()}
                  style={[styles.selectorInput, styles.vpicMakeInput, { backgroundColor: colors.background, borderColor: colors.background }]}
                >
                  <Text style={[styles.selectorText, { color: vpicMake ? colors.text : colors.muted }]} numberOfLines={1}>
                    {vpicMake || 'Select Make'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setYearPickerVisible(true)}
                  style={[styles.selectorInput, styles.vpicYearInput, { backgroundColor: colors.background, borderColor: colors.background }]}
                >
                  <Text style={[styles.selectorText, { color: vpicYear ? colors.text : colors.muted }]} numberOfLines={1}>
                    {vpicYear || 'Year'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.fetchBtn, { backgroundColor: colors.primary }]}
                  onPress={() => void fetchVpicVehicles()}
                  disabled={vpicLoading}
                >
                  <Text style={styles.fetchBtnText}>{vpicLoading ? '...' : 'Fetch'}</Text>
                </TouchableOpacity>
              </View>
              {!!vpicResults.length && (
                <View style={styles.vpicResultList}>
                  {vpicResults.slice(0, 20).map((result) => {
                    const makeName = (result.Make_Name || vpicMake).trim();
                    const modelName = (result.Model_Name || '').trim();
                    const isCurrent =
                      make.trim().toLowerCase() === makeName.toLowerCase() &&
                      model.trim().toLowerCase() === modelName.toLowerCase() &&
                      year.trim() === vpicYear.trim();
                    return (
                      <View key={`${makeName}-${modelName}`} style={styles.vpicResultRow}>
                        <Text style={[styles.vpicResultText, { color: colors.text }]} numberOfLines={1}>
                          {vpicYear.trim()} {makeName} {modelName}
                        </Text>
                        <TouchableOpacity
                          style={[styles.vpicAddBtn, { borderColor: isCurrent ? '#10B981' : colors.primary }]}
                          onPress={() => addVehicleFromVpic(result)}
                        >
                          {isCurrent ? (
                            <Ionicons name="checkmark" size={14} color="#10B981" />
                          ) : (
                            <Text style={[styles.vpicAddBtnText, { color: colors.primary }]}>Add</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.formSection, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Car Details</Text>
              <TextInput placeholder="Make *" placeholderTextColor={colors.muted} value={make} onChangeText={setMake}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Model *" placeholderTextColor={colors.muted} value={model} onChangeText={setModel}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <View style={styles.row}>
                <TextInput placeholder="Start Year *" placeholderTextColor={colors.muted} keyboardType="number-pad" value={year} onChangeText={setYear}
                  style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]} />
                <TextInput placeholder="End Year" placeholderTextColor={colors.muted} keyboardType="number-pad" value={yearTo} onChangeText={setYearTo}
                  style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]} />
              </View>
              <TextInput placeholder="Trim (Optional)" placeholderTextColor={colors.muted} value={trim} onChangeText={setTrim}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Engine (Optional)" placeholderTextColor={colors.muted} value={engine} onChangeText={setEngine}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Body Type (Optional)" placeholderTextColor={colors.muted} value={bodyType} onChangeText={setBodyType}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Fuel Type (Optional)" placeholderTextColor={colors.muted} value={fuelType} onChangeText={setFuelType}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Transmission (Optional)" placeholderTextColor={colors.muted} value={transmission} onChangeText={setTransmission}
                style={[styles.input, { color: colors.text, borderColor: colors.background }]} />
              <TextInput placeholder="Notes (Optional)" placeholderTextColor={colors.muted} value={notes} onChangeText={setNotes}
                multiline numberOfLines={3} textAlignVertical="top"
                style={[styles.input, styles.notesInput, { color: colors.text, borderColor: colors.background }]} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Make picker */}
      <Modal visible={makePickerVisible} transparent animationType="fade" onRequestClose={() => setMakePickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMakePickerVisible(false)} />
          <View style={[styles.pickerCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select NHTSA Make</Text>
            <TextInput placeholder="Search make..." placeholderTextColor={colors.muted} value={vpicMakeQuery} onChangeText={setVpicMakeQuery}
              style={[styles.pickerSearchInput, { color: colors.text, borderColor: colors.background, backgroundColor: colors.background }]} />
            {nhtsaMakesLoading ? (
              <View style={styles.pickerLoadingWrap}><ActivityIndicator size="small" color={colors.primary} /></View>
            ) : (
              <FlatList
                data={vpicMakeQuery.trim() ? nhtsaMakes.filter((n) => n.toLowerCase().includes(vpicMakeQuery.trim().toLowerCase())) : nhtsaMakes}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, { borderBottomColor: colors.background }]}
                    onPress={() => { setVpicMake(item); setMakePickerVisible(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.text }]}>{item}</Text>
                    {vpicMake === item ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Year picker */}
      <Modal visible={yearPickerVisible} transparent animationType="fade" onRequestClose={() => setYearPickerVisible(false)}>
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setYearPickerVisible(false)} />
          <View style={[styles.pickerCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>Select Model Year</Text>
            <FlatList
              data={NHTSA_YEAR_OPTIONS}
              keyExtractor={(item) => item}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: colors.background }]}
                  onPress={() => { setVpicYear(item); setYearPickerVisible(false); }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{item}</Text>
                  {vpicYear === item ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* My Car detail */}
      <Modal visible={!!carDetail} animationType="slide" transparent={false} onRequestClose={() => setCarDetail(null)}>
        <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
          <View style={styles.detailHeader}>
            <TouchableOpacity style={[styles.modalHeaderBtn, { backgroundColor: colors.surface }]} onPress={() => setCarDetail(null)}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>My Car</Text>
            <TouchableOpacity
              style={[styles.modalHeaderBtn, { backgroundColor: `${colors.danger || '#ef4444'}1A` }]}
              onPress={() => carDetail && handleDeleteCar(carDetail)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger || '#ef4444'} />
            </TouchableOpacity>
          </View>

          {carDetail ? (
            <ScrollView contentContainerStyle={styles.detailBody} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailHero, { backgroundColor: colors.surface }]}>
                {carDetail.image ? (
                  <Image source={{ uri: toPublicImageUrl(carDetail.image) }} style={styles.detailHeroImage} />
                ) : (
                  <View style={[styles.detailHeroFallback, { backgroundColor: colors.background }]}>
                    <Ionicons name="car-sport-outline" size={48} color={colors.muted} />
                  </View>
                )}
                <View style={styles.detailHeroOverlay}>
                  <View style={[styles.yearBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.yearBadgeText}>{yearLabel(carDetail)}</Text>
                  </View>
                  <Text style={[styles.detailHeroTitle, { color: colors.text }]}>
                    {carDetail.make} {carDetail.model}
                  </Text>
                  {carDetail.trim ? <Text style={[styles.detailHeroSub, { color: colors.muted }]}>{carDetail.trim}</Text> : null}
                </View>
              </View>

              {specChips(carDetail).length > 0 && (
                <View style={styles.detailChips}>
                  {specChips(carDetail).map((chip, idx) => (
                    <View key={idx} style={[styles.chip, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.chipText, { color: colors.muted }]}>{chip}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.detailSectionTitle, { color: colors.text }]}>Parts that fit your car</Text>
              {carPartsLoading ? (
                <View style={styles.detailPartsLoading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : carParts.length === 0 ? (
                <View style={styles.detailEmpty}>
                  <Ionicons name="cube-outline" size={40} color={colors.muted} />
                  <Text style={[styles.emptySub, { color: colors.muted }]}>
                    No matching parts found for this car yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.detailPartsGrid}>
                  {carParts.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.detailProductCard, { backgroundColor: colors.surface }]}
                      activeOpacity={0.86}
                      onPress={() => navigateTo?.('ProductDetails', { productId: p.id })}
                    >
                      <View style={[styles.detailProductImageWrap, { backgroundColor: colors.background }]}>
                        {p.imageUri ? (
                          <Image source={{ uri: p.imageUri }} style={styles.detailProductImage} />
                        ) : (
                          <Ionicons name="cube-outline" size={26} color={colors.muted} />
                        )}
                      </View>
                      <View style={styles.detailProductBody}>
                        {p.brand ? <Text style={[styles.brand, { color: colors.primary }]} numberOfLines={1}>{p.brand}</Text> : null}
                        <Text style={[styles.detailProductTitle, { color: colors.text }]} numberOfLines={2}>{p.title}</Text>
                        <Text style={[styles.price, { color: colors.primary }]}>{formatCedis(p.price)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 30 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: 0.3 },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  myCarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1.5,
  },
  myCarBtnText: { fontSize: 13, fontWeight: '800' },
  myCarCountBadge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, marginLeft: 2,
  },
  myCarCountText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  group: { marginBottom: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 },
  groupTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  groupCount: { fontSize: 12, fontWeight: '800' },
  cardSpacing: { marginBottom: 12 },
  card: {
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  imageWrap: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center' },
  vehicleImage: { width: '100%', height: '100%' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 56 },
  yearBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  yearBadgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  makeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  make: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  trim: { fontSize: 11, fontWeight: '700' },
  model: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
  chevronWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { marginTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { marginTop: 10, fontSize: 17, fontWeight: '800' },
  emptySub: { marginTop: 4, fontWeight: '600', textAlign: 'center', fontSize: 13 },
  skeletonLine: { height: 12, borderRadius: 6 },
  // Modal / forms
  modalContainer: { flex: 1, paddingTop: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  modalHeaderBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  form: { padding: 16, paddingBottom: 32, gap: 12 },
  heroCard: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  heroTitle: { fontSize: 16, fontWeight: '800' },
  heroSubTitle: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  vpicSection: { borderRadius: 12, padding: 12, gap: 10 },
  vpicTitle: { fontSize: 14, fontWeight: '800' },
  vpicMakeInput: { flex: 1 },
  vpicYearInput: { width: 92 },
  row: { flexDirection: 'row', gap: 10 },
  selectorInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectorText: { flex: 1, fontSize: 14, fontWeight: '600' },
  fetchBtn: { height: 48, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  fetchBtnText: { color: '#fff', fontWeight: '700' },
  vpicResultList: { gap: 8 },
  vpicResultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  vpicResultText: { flex: 1, fontWeight: '600' },
  vpicAddBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  vpicAddBtnText: { fontWeight: '700' },
  formSection: { borderRadius: 12, padding: 12, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontSize: 14, fontWeight: '600' },
  halfInput: { flex: 1 },
  notesInput: { height: 80, paddingTop: 12 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 20 },
  pickerCard: { borderRadius: 16, maxHeight: '72%', padding: 12 },
  pickerTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  pickerSearchInput: { borderWidth: 1, borderRadius: 10, height: 42, paddingHorizontal: 12, marginBottom: 8, fontSize: 14, fontWeight: '600' },
  pickerLoadingWrap: { alignItems: 'center', paddingVertical: 20 },
  pickerList: { maxHeight: 360 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 14, fontWeight: '600' },
  // Detail
  detailContainer: { flex: 1, paddingTop: 30 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  detailBody: { paddingHorizontal: 16, paddingBottom: 120, gap: 14 },
  detailHero: { borderRadius: 18, overflow: 'hidden', height: 220, justifyContent: 'flex-end' },
  detailHeroImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', resizeMode: 'cover' },
  detailHeroFallback: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  detailHeroOverlay: { padding: 16, gap: 6 },
  detailHeroTitle: { fontSize: 22, fontWeight: '900' },
  detailHeroSub: { fontSize: 14, fontWeight: '700' },
  detailChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailSectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  detailPartsLoading: { paddingVertical: 40, alignItems: 'center' },
  detailEmpty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  detailPartsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  detailProductCard: { width: '48%', borderRadius: 16, overflow: 'hidden' },
  detailProductImageWrap: { width: '100%', height: 110, alignItems: 'center', justifyContent: 'center' },
  detailProductImage: { width: '100%', height: '100%' },
  detailProductBody: { padding: 10, gap: 4 },
  detailProductTitle: { fontSize: 13, fontWeight: '800', minHeight: 32 },
  brand: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  price: { fontSize: 14, fontWeight: '900' },
});