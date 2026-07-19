import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Switch, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { useAppAlert } from '../components/AppAlert';
import LoadingScreen from '../components/LoadingScreen';
import { APP_VERSION } from '../utils/appVersion';

type Profile = {
  fullName: string;
  phone: string;
  notifications: boolean;
};

export default function Account({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { user, session, signOut, loading } = useAuth();
  const { show: showAlert } = useAppAlert();
  const [signingOut, setSigningOut] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>({ fullName: '', phone: '', notifications: true });
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [showAppLoading, setShowAppLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('full_name, phone, notifications_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.warn('Profile load failed', error.message);
        return;
      }
      if (mounted && data) {
        setProfile({
          fullName: data.full_name || '',
          phone: data.phone || '',
          notifications: data.notifications_enabled ?? true,
        });
      }
    }
    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    showAlert({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Sign Out',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
            } catch (error: any) {
              showAlert({ title: 'Error', message: error.message || 'Failed to sign out' });
            } finally {
              setSigningOut(false);
            }
          },
          style: 'destructive',
        },
      ],
    });
  };

  async function saveProfile() {
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from('customer_profiles').upsert(
        {
          user_id: user.id,
          email: user.email,
          full_name: profile.fullName.trim() || null,
          phone: profile.phone.trim() || null,
          notifications_enabled: profile.notifications,
        },
        { onConflict: 'user_id' }
      );
      if (error) throw new Error(error.message);
      showAlert({ title: 'Saved', message: 'Your profile settings were updated.' });
    } catch (error) {
      showAlert({ title: 'Save failed', message: error instanceof Error ? error.message : 'Could not save profile.' });
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session || !user) {
    return (
      <View style={[styles.guestWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.guestIconWrap, { backgroundColor: `${colors.primary}18` }]}>
          <Ionicons name="person-outline" size={56} color={colors.primary} />
        </View>
        <Text style={[styles.guestTitle, { color: colors.text }]}>Welcome to Auto Help GH</Text>
        <Text style={[styles.guestSubtitle, { color: colors.muted }]}>
          Log in to track orders, save addresses and manage your profile. You can still browse and shop without an account.
        </Text>
        <Pressable
          style={[styles.guestPrimaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigateTo?.('Auth')}
        >
          <Ionicons name="log-in-outline" size={20} color={colors.surface} />
          <Text style={[styles.guestPrimaryText, { color: colors.surface }]}>Login</Text>
        </Pressable>
        <Pressable
          style={[styles.guestSecondaryBtn, { borderColor: colors.primary }]}
          onPress={() => navigateTo?.('Auth', { initialMode: 'signup' })}
        >
          <Text style={[styles.guestSecondaryText, { color: colors.primary }]}>Create an account</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.background }]}>
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons name="person" size={30} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {profile.fullName || 'Auto Help Customer'}
          </Text>
          <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>
            {user.email}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Member since {new Date(user.created_at!).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile details</Text>
          <TouchableOpacity onPress={() => setEditingProfile((v) => !v)} hitSlop={8}>
            <Ionicons name={editingProfile ? 'eye-off-outline' : 'create-outline'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {editingProfile ? (
          <>
            <TextInput
              value={profile.fullName}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { borderColor: colors.background, color: colors.text }]}
            />
            <TextInput
              value={profile.phone}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
              placeholder="Phone number"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor: colors.background, color: colors.text }]}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.7 : 1 }]}
              onPress={() => void saveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save profile</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Full name</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.fullName || 'Not set'}</Text>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Phone</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.phone || 'Not set'}</Text>
            <Text style={[styles.editHint, { color: colors.muted }]}>Tap the edit icon to update your details</Text>
          </View>
        )}
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => navigateTo?.('Orders')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            </View>
            <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>My Orders</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>View placed orders</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => navigateTo?.('Notifications')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            </View>
            <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Notifications</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>View all updates</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="notifications" size={16} color={colors.primary} />
            </View>
            <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Push alerts</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Order updates and alerts</Text>
            </View>
          </View>
          <Switch
            value={profile.notifications}
            onValueChange={(value) => setProfile((prev) => ({ ...prev, notifications: value }))}
            trackColor={{ false: '#b0b0b0', true: colors.primary }}
          />
        </View>
        <TouchableOpacity style={styles.settingRow} onPress={() => navigateTo?.('Checkout')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="location-outline" size={16} color={colors.primary} />
            </View>
            <View>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Address book</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Manage shipping addresses</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact support</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://facebook.com/autohelpgh')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="logo-facebook" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Facebook</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Message us on Facebook</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('https://wa.me/233200000000')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="logo-whatsapp" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>WhatsApp</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Chat with our team</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('mailto:support@autohelpgh.com')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Email</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>support@autohelpgh.com</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => Linking.openURL('tel:+233200000000')}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="call-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Phone</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>+233 20 000 0000</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <Pressable
        style={[
          styles.signoutButton,
          { backgroundColor: colors.primary, opacity: signingOut ? 0.6 : 1 },
        ]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <>
            <Ionicons name="log-out" size={20} color={colors.surface} />
            <Text style={[styles.signoutText, { color: colors.surface }]}>Sign Out</Text>
          </>
        )}
      </Pressable>

      <Pressable
        style={styles.versionButton}
        onPress={() => setShowAppLoading(true)}
        hitSlop={10}
      >
        <Text style={[styles.versionText, { color: colors.muted }]}>
          Auto Help GH v{APP_VERSION}
        </Text>
      </Pressable>
      </ScrollView>

      {showAppLoading && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1000 }]}>
          <LoadingScreen />
          <Pressable
            style={styles.loadingClose}
            onPress={() => setShowAppLoading(false)}
          >
            <Ionicons name="close-circle" size={36} color={colors.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  heroCard: {
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  guestWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  guestIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  guestSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 6,
  },
  guestPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 16,
    marginBottom: 12,
  },
  guestPrimaryText: {
    fontSize: 16,
    fontWeight: '900',
  },
  guestSecondaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestSecondaryText: {
    fontSize: 16,
    fontWeight: '800',
  },
  name: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  email: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  sectionCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  detailRow: { gap: 2 },
  detailLabel: { fontSize: 12, marginTop: 8 },
  detailValue: { fontSize: 15, fontWeight: '700' },
  editHint: { fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 10,
    fontWeight: '600',
  },
  primaryBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  settingRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 10,
    marginBottom: 24,
  },
  signoutText: {
    fontSize: 15,
    fontWeight: '800',
  },
  versionButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingClose: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    opacity: 0.85,
  },
});
