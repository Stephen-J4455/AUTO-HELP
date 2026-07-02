import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { useCart } from '../context/Cart';
import { useAuth } from '../context/Auth';
import { supabase } from '../supabase/supabase';
import { Ionicons } from '@expo/vector-icons';
import { formatCedis } from '../utils/currency';

type Address = {
  id: string;
  full_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  is_default: boolean;
};

const paystackLink = process.env.EXPO_PUBLIC_PAYSTACK_PAYMENT_LINK;

export default function Checkout({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { items, total, clear } = useCart();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [country, setCountry] = useState('Ghana');

  const deliveryFee = items.length ? 6.5 : 0;
  const grandTotal = useMemo(() => total + deliveryFee, [total, deliveryFee]);

  useEffect(() => {
    let mounted = true;
    async function loadAddresses() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('user_addresses')
        .select('id, full_name, phone, street, city, state, country, is_default')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) {
        console.warn('Address load failed', error.message);
      } else if (mounted) {
        const rows = (data as Address[]) || [];
        setAddresses(rows);
        const defaultAddress = rows.find((row) => row.is_default) || rows[0];
        if (defaultAddress) setSelectedAddressId(defaultAddress.id);
      }
      if (mounted) setLoading(false);
    }
    void loadAddresses();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function handleSaveAddress() {
    if (!user?.id) return;
    if (!fullName.trim() || !phone.trim() || !street.trim() || !city.trim() || !stateRegion.trim()) {
      Alert.alert('Address required', 'Please fill all address fields.');
      return;
    }

    if (editingAddressId) {
      // Update existing address
      const { error } = await supabase
        .from('user_addresses')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: stateRegion.trim(),
          country: country.trim() || 'Ghana',
        })
        .eq('id', editingAddressId);
      
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
      
      setAddresses(addresses.map(a => 
        a.id === editingAddressId 
          ? { ...a, full_name: fullName, phone, street, city, state: stateRegion, country }
          : a
      ));
    } else {
      // Insert new address
      const { data, error } = await supabase
        .from('user_addresses')
        .insert({
          user_id: user.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          street: street.trim(),
          city: city.trim(),
          state: stateRegion.trim(),
          country: country.trim() || 'Ghana',
          is_default: addresses.length === 0,
        })
        .select('id, full_name, phone, street, city, state, country, is_default')
        .single();
      if (error) {
        Alert.alert('Save failed', error.message);
        return;
      }
      const next = [data as Address, ...addresses];
      setAddresses(next);
      setSelectedAddressId(data.id);
    }
    
    // Reset form
    setFullName('');
    setPhone('');
    setStreet('');
    setCity('');
    setStateRegion('');
    setCountry('Ghana');
    setShowAddForm(false);
    setEditingAddressId(null);
  }

  const handleEditAddress = (address: Address) => {
    setFullName(address.full_name);
    setPhone(address.phone);
    setStreet(address.street);
    setCity(address.city);
    setStateRegion(address.state);
    setCountry(address.country);
    setEditingAddressId(address.id);
    setShowAddForm(true);
  };

  async function makeDefaultAddress(addressId: string) {
    if (!user?.id) return;
    const { error: resetError } = await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    if (resetError) {
      Alert.alert('Address error', resetError.message);
      return;
    }
    const { error } = await supabase
      .from('user_addresses')
      .update({ is_default: true })
      .eq('user_id', user.id)
      .eq('id', addressId);
    if (error) {
      Alert.alert('Address error', error.message);
      return;
    }
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === addressId })));
    setSelectedAddressId(addressId);
  }

  async function startPaystackCheckout() {
    if (!user?.id) return;
    if (!items.length) {
      Alert.alert('Cart empty', 'Add products to cart before checkout.');
      return;
    }
    const selectedAddress = addresses.find((address) => address.id === selectedAddressId);
    if (!selectedAddress) {
      Alert.alert('Address required', 'Please select or add a shipping address.');
      return;
    }
    if (!paystackLink) {
      Alert.alert('Paystack config missing', 'Set EXPO_PUBLIC_PAYSTACK_PAYMENT_LINK to enable Paystack checkout.');
      return;
    }

    setPaying(true);
    try {
      const orderRef = `AHG-${Date.now()}`;
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_amount: grandTotal,
          shipping_cost: deliveryFee,
          currency: 'GHS',
          shipping_address: selectedAddress,
          metadata: { source: 'mobile-app', reference: orderRef },
        })
        .select('id')
        .single();
      if (orderError) throw new Error(orderError.message);

      const lineItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_sku: item.sku || null,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.quantity * item.price,
      }));
      const { error: orderItemsError } = await supabase.from('order_items').insert(lineItems);
      if (orderItemsError) throw new Error(orderItemsError.message);

      const { error: paymentError } = await supabase.from('payments').insert({
        order_id: order.id,
        provider: 'paystack',
        status: 'initiated',
        amount: grandTotal,
        currency: 'GHS',
        metadata: { reference: orderRef, channel: 'payment-link' },
      });
      if (paymentError) throw new Error(paymentError.message);

      const checkoutUrl = `${paystackLink}?reference=${encodeURIComponent(orderRef)}&email=${encodeURIComponent(
        user.email || ''
      )}&amount=${Math.round(grandTotal * 100)}`;
      await Linking.openURL(checkoutUrl);
      await clear();
      Alert.alert('Payment started', 'You were redirected to Paystack to complete payment.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Checkout failed', error instanceof Error ? error.message : 'Could not start checkout');
    } finally {
      setPaying(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="bag-check-outline" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, margin: 0 }]}>Order items</Text>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id || `${item.product_id}-${item.sku}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[styles.itemRow, { borderRadius: 12, backgroundColor: colors.background, padding: 12, marginBottom: 12 }]}>
                  {item.image_url && (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.itemImage}
                    />
                  )}
                  <View style={{ flex: 1, marginLeft: item.image_url ? 12 : 0 }}>
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      <Ionicons name="cube-outline" size={12} color={colors.muted} /> Qty: {item.quantity}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {formatCedis(item.price * item.quantity)}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      {formatCedis(item.price)}/qty
                    </Text>
                  </View>
                </View>
              )}
            />
            <View style={[styles.divider, { backgroundColor: colors.background }]} />
            <View style={styles.itemRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="calculator-outline" size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: '700' }}>Subtotal</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCedis(total)}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, margin: 0 }]}>Saved addresses</Text>
            </View>
            <FlatList
              data={addresses}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item.id === selectedAddressId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.addressCard,
                      {
                        borderColor: active ? colors.primary : colors.background,
                        backgroundColor: active ? `${colors.primary}12` : colors.background,
                      },
                    ]}
                    onPress={() => setSelectedAddressId(item.id)}
                  >
                    <View style={styles.addressHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={18} color={colors.primary} />
                        <Text style={{ color: colors.text, fontWeight: '800' }}>{item.full_name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity 
                          onPress={() => handleEditAddress(item)}
                          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                        >
                          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        </TouchableOpacity>
                        {item.is_default ? (
                          <View style={[styles.defaultPill, { backgroundColor: colors.primary }]}>
                            <Ionicons name="star" size={10} color="#fff" />
                            <Text style={styles.defaultText}>Default</Text>
                          </View>
                        ) : (
                          <TouchableOpacity onPress={() => void makeDefaultAddress(item.id)}>
                            <Ionicons name="star-outline" size={16} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={{ marginTop: 8, marginLeft: 26 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        <Ionicons name="home-outline" size={11} color={colors.muted} /> {item.street}, {item.city}, {item.state}, {item.country}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        <Ionicons name="call-outline" size={11} color={colors.muted} /> {item.phone}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{ color: colors.muted }}><Ionicons name="information-circle-outline" size={14} color={colors.muted} /> No addresses yet. Add one below.</Text>}
            />
          </View>

          {addresses.length === 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
             <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
             <Text style={[styles.cardTitle, { color: colors.text, margin: 0 }]}>Add address</Text>
           </View>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              value={fullName}
              onChangeText={setFullName}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
              keyboardType="phone-pad"
            />
            <TextInput
              placeholder="Street address"
              placeholderTextColor={colors.muted}
              value={street}
              onChangeText={setStreet}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <View style={styles.row}>
              <TextInput
                placeholder="City"
                placeholderTextColor={colors.muted}
                value={city}
                onChangeText={setCity}
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]}
              />
              <TextInput
                placeholder="State"
                placeholderTextColor={colors.muted}
                value={stateRegion}
                onChangeText={setStateRegion}
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]}
              />
            </View>
            <TextInput
              placeholder="Country"
              placeholderTextColor={colors.muted}
              value={country}
              onChangeText={setCountry}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.background }]} onPress={() => void handleSaveAddress()}>
              <Ionicons name={editingAddressId ? "pencil" : "add"} size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '800' }}>{editingAddressId ? 'Update address' : 'Save address'}</Text>
            </TouchableOpacity>
            {editingAddressId && (
              <TouchableOpacity 
                style={[styles.secondaryBtn, { backgroundColor: colors.background, opacity: 0.7 }]}
                onPress={() => {
                  setEditingAddressId(null);
                  setShowAddForm(false);
                  setFullName('');
                  setPhone('');
                  setStreet('');
                  setCity('');
                  setStateRegion('');
                  setCountry('Ghana');
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          )}

          {addresses.length > 0 && (
          <TouchableOpacity 
            style={[{ marginHorizontal: 16, marginBottom: 12 }, styles.secondaryBtn, { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primary }]}
            onPress={() => {
              setFullName('');
              setPhone('');
              setStreet('');
              setCity('');
              setStateRegion('');
              setCountry('Ghana');
              setEditingAddressId(null);
              setShowAddForm(!showAddForm);
            }}
          >
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800' }}>Add another address</Text>
          </TouchableOpacity>
          )}

          {showAddForm && addresses.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name={editingAddressId ? "pencil" : "add-circle-outline"} size={20} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text, margin: 0 }]}>{editingAddressId ? 'Edit address' : 'Add address'}</Text>
            </View>
            <TextInput
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              value={fullName}
              onChangeText={setFullName}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor={colors.muted}
              value={phone}
              onChangeText={setPhone}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
              keyboardType="phone-pad"
            />
            <TextInput
              placeholder="Street address"
              placeholderTextColor={colors.muted}
              value={street}
              onChangeText={setStreet}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <View style={styles.row}>
              <TextInput
                placeholder="City"
                placeholderTextColor={colors.muted}
                value={city}
                onChangeText={setCity}
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]}
              />
              <TextInput
                placeholder="State"
                placeholderTextColor={colors.muted}
                value={stateRegion}
                onChangeText={setStateRegion}
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.background }]}
              />
            </View>
            <TextInput
              placeholder="Country"
              placeholderTextColor={colors.muted}
              value={country}
              onChangeText={setCountry}
              style={[styles.input, { color: colors.text, borderColor: colors.background }]}
            />
            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.background }]} onPress={() => void handleSaveAddress()}>
              <Ionicons name={editingAddressId ? "pencil" : "add"} size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '800' }}>{editingAddressId ? 'Update address' : 'Save address'}</Text>
            </TouchableOpacity>
            {editingAddressId && (
              <TouchableOpacity 
                style={[styles.secondaryBtn, { backgroundColor: colors.background, opacity: 0.7 }]}
                onPress={() => {
                  setEditingAddressId(null);
                  setShowAddForm(false);
                  setFullName('');
                  setPhone('');
                  setStreet('');
                  setCity('');
                  setStateRegion('');
                  setCountry('Ghana');
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface }]}>
          <View style={styles.totalRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="bag-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted }}>Items</Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCedis(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="car-outline" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted }}>Delivery</Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{formatCedis(deliveryFee)}</Text>
          </View>
          <View style={[styles.totalRow, { paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.background }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="cash-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Total</Text>
            </View>
            <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 16 }}>{formatCedis(grandTotal)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: colors.primary, opacity: paying ? 0.7 : 1 }]}
            onPress={() => void startPaystackCheckout()}
            disabled={paying}
          >
            {paying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.payText}>Pay with Paystack</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column', paddingTop: 12 },
  header: { paddingHorizontal: 16, marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '900' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { marginHorizontal: 16, borderRadius: 18, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  addressCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  defaultPill: { paddingHorizontal: 8, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  defaultText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  payBtn: { height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 10, flexDirection: 'row', gap: 8 },
  payText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, gap: 10 },
  itemImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#f0f0f0' },
  divider: { height: 1, marginVertical: 8 },
});
