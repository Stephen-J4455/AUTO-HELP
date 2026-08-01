import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Switch, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { useAppAlert } from '../components/AppAlert';
import LoadingScreen from '../components/LoadingScreen';
import { APP_VERSION } from '../utils/appVersion';
import { DEVICE_CORNER_RADIUS } from '../utils/device';

type Profile = {
  fullName: string;
  phone: string;
  notifications: boolean;
};

// Overlay being shown: none, the edit-profile page, or the delete-account flow.
type Overlay = 'none' | 'edit' | 'delete';

export default function Account({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { user, session, signOut, deleteAccount, loading } = useAuth();
  const radius = DEVICE_CORNER_RADIUS;
  const { show: showAlert } = useAppAlert();
  const [signingOut, setSigningOut] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>({ fullName: '', phone: '', notifications: true });
  const [overlay, setOverlay] = React.useState<Overlay>('none');
  const [showAppLoading, setShowAppLoading] = React.useState(false);

  // Delete-confirmation state: the user must type their exact email.
  const [deleteEmail, setDeleteEmail] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

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

  const performDelete = async () => {
    // Guard: the typed email must exactly match the account email.
    if (deleteEmail.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()) {
      showAlert({ title: 'Email does not match', message: 'Please type your email exactly as shown to confirm deletion.' });
      return;
    }
    setDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        showAlert({ title: 'Error', message: error });
        setDeleting(false);
      }
      // On success the Auth context clears the session and the app returns
      // to the guest state — nothing else to do here.
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to delete account' });
      setDeleting(false);
    }
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
      setOverlay('none');
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
        <View style={styles.legalRow}>
          <Pressable onPress={() => navigateTo?.('PrivacyPolicy')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.muted }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.legalDivider, { color: colors.muted }]}>•</Text>
          <Pressable onPress={() => navigateTo?.('Terms')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.muted }]}>Terms & Conditions</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // The profile card is now read-only; editing happens in a dedicated overlay.
  const initials = (profile.fullName || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Redesigned profile card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.heroBanner, { backgroundColor: `${colors.primary}14` }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.surface }]}>{initials || 'A'}</Text>
            </View>
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {profile.fullName || 'Auto Help Customer'}
            </Text>
            <Text style={[styles.email, { color: colors.muted }]} numberOfLines={1}>
              {user.email}
            </Text>
            <Text style={[styles.memberSince, { color: colors.muted }]}>
              Member since {new Date(user.created_at || Date.now()).toLocaleDateString()}
            </Text>
            <View style={[styles.profileMeta, { borderColor: `${colors.primary}22` }]}>
              <Ionicons name="call-outline" size={15} color={colors.muted} />
              <Text style={[styles.profileMetaText, { color: colors.text }]} numberOfLines={1}>
                {profile.phone || 'No phone added'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.cardEditBtn, { backgroundColor: `${colors.primary}14` }]}
            onPress={() => setOverlay('edit')}
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
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

        {/* Contact support */}
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

        {/* Sign out */}
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

        {/* Delete account — now at the very bottom, behind a confirmation that
            requires the user to type their email. */}
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: `${colors.danger || colors.primary}55` }]}
          onPress={() => {
            setDeleteEmail('');
            setOverlay('delete');
          }}
          disabled={deleting}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger || colors.primary} />
          <Text style={[styles.deleteText, { color: colors.danger || colors.primary }]}>Delete account</Text>
        </TouchableOpacity>

        <Pressable
          style={styles.versionButton}
          onPress={() => setShowAppLoading(true)}
          hitSlop={10}
        >
          <Text style={[styles.versionText, { color: colors.muted }]}>
            Auto Help GH v{APP_VERSION}
          </Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => navigateTo?.('PrivacyPolicy')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.muted }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.legalDivider, { color: colors.muted }]}>•</Text>
          <Pressable onPress={() => navigateTo?.('Terms')} hitSlop={8}>
            <Text style={[styles.legalLink, { color: colors.muted }]}>Terms & Conditions</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit profile overlay (a dedicated "edit page") */}
      {overlay === 'edit' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { borderColor: colors.surface, backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setOverlay('none')} hitSlop={8} style={styles.overlayClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>Edit profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Full name</Text>
            <TextInput
              value={profile.fullName}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))}
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              style={[styles.input, { borderColor: colors.surface, color: colors.text }]}
            />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone number</Text>
            <TextInput
              value={profile.phone}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, phone: value }))}
              placeholder="Phone number"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={[styles.input, { borderColor: colors.surface, color: colors.text }]}
            />
            <View style={[styles.overlayToggleRow, { borderColor: colors.surface }]}>
              <View>
                <Text style={[styles.overlayToggleTitle, { color: colors.text }]}>Push alerts</Text>
                <Text style={[styles.overlayToggleSub, { color: colors.muted }]}>Order updates and alerts</Text>
              </View>
              <Switch
                value={profile.notifications}
                onValueChange={(value) => setProfile((prev) => ({ ...prev, notifications: value }))}
                trackColor={{ false: '#b0b0b0', true: colors.primary }}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.7 : 1, marginTop: 16 }]}
              onPress={() => void saveProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Delete account overlay — requires typing the email to confirm */}
      {overlay === 'delete' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { borderColor: colors.surface, backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setOverlay('none')} hitSlop={8} style={styles.overlayClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>Delete account</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.deleteWarningBox, { backgroundColor: `${colors.danger || colors.primary}12`, borderColor: `${colors.danger || colors.primary}44` }]}>
              <Ionicons name="warning-outline" size={28} color={colors.danger || colors.primary} />
              <Text style={[styles.deleteWarningTitle, { color: colors.text }]}>This action is permanent</Text>
              <Text style={[styles.deleteWarningBody, { color: colors.muted }]}>
                Deleting your account removes your profile, orders and sign-in permanently. This cannot be undone.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.muted }]}>
              Type your email to confirm
            </Text>
            <Text style={[styles.confirmEmailHint, { color: colors.text }]}>{user.email}</Text>
            <TextInput
              value={deleteEmail}
              onChangeText={setDeleteEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={[styles.input, { borderColor: colors.surface, color: colors.text }]}
            />

            <TouchableOpacity
              style={[
                styles.deleteConfirmBtn,
                {
                  backgroundColor: colors.danger || colors.primary,
                  opacity:
                    deleting || deleteEmail.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()
                      ? 0.4
                      : 1,
                },
              ]}
              onPress={() => void performDelete()}
              disabled={deleting || deleteEmail.trim().toLowerCase() !== (user.email || '').trim().toLowerCase()}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.deleteConfirmText}>Permanently delete my account</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

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
  // Redesigned profile card
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroBanner: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '900',
  },
  heroBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    position: 'relative',
  },
  name: { fontSize: 18, fontWeight: '900', marginBottom: 2, textAlign: 'center' },
  email: { fontSize: 13, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  memberSince: { fontSize: 12, textAlign: 'center' },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  profileMetaText: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardEditBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sectionCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
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
    marginBottom: 12,
  },
  signoutText: {
    fontSize: 15,
    fontWeight: '800',
  },
  // Delete button at the bottom
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 24,
  },
  deleteText: {
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
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 28,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: 10,
  },
  // Overlay (edit / delete pages)
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  overlayClose: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  overlayToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  overlayToggleTitle: { fontSize: 15, fontWeight: '800' },
  overlayToggleSub: { fontSize: 12, marginTop: 2 },
  // Delete overlay
  deleteWarningBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteWarningTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 6,
    textAlign: 'center',
  },
  deleteWarningBody: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
  confirmEmailHint: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  deleteConfirmBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteConfirmText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  loadingClose: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    opacity: 0.85,
  },
});