import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  StatusBar,
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { useAppAlert } from '../components/AppAlert';
import LoadingScreen from '../components/LoadingScreen';
import { APP_VERSION } from '../utils/appVersion';
import { useStoreSettings } from '../utils/remoteContent';
import { openNotificationSettings } from '../utils/pushNotifications';
import { ChatFabContext } from '../../App';

// Overlay being shown: none, the edit-profile page, or the delete-account flow.
type Overlay = 'none' | 'edit' | 'delete';

// Colored icon circles matching the reference UI palette.
const ICON_COLORS = {
  payment: '#34C759',
  referral: '#00BCD4',
  notification: '#5856D6',
  lightmode: '#FF2D55',
  support: '#AF52DE',
  delete: '#FF3B30',
  logout: '#5856D6',
};

export default function Account({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { user, signOut, deleteAccount, loading } = useAuth();
  const { show: showAlert } = useAppAlert();
  const { settings } = useStoreSettings();

  // --- State ---
  const [signingOut, setSigningOut] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profile, setProfile] = React.useState({ fullName: '', phone: '', notifications: true, lightMode: false });
  const [overlay, setOverlay] = React.useState<Overlay>('none');
  const [showAppLoading, setShowAppLoading] = React.useState(false);

  // Chat FAB visibility toggle
  const { hidden: chatHidden, setHidden: setChatHidden } = React.useContext(ChatFabContext);

  // Delete-confirmation: user must type their exact email.
  const [deleteEmail, setDeleteEmail] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  // --- Effects ---

  // Load profile
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
          lightMode: false,
        });
      }
    }
    void loadProfile();
    return () => { mounted = false; };
  }, [user?.id]);

  // --- Handlers ---

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
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
      },
    ]);
  };

  const performDelete = async () => {
    if (deleteEmail.trim().toLowerCase() !== (user?.email || '').toLowerCase()) {
      showAlert({
        title: 'Email mismatch',
        message: `Type your exact email address (${user?.email}) to confirm deletion.`,
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    setDeleting(true);
    try {
      const { error } = await deleteAccount();
      if (error) {
        showAlert({ title: 'Error', message: error.message || 'Failed to delete account' });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Failed to delete account' });
    } finally {
      setDeleting(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('customer_profiles')
        .upsert({
          user_id: user?.id,
          full_name: profile.fullName,
          phone: profile.phone,
          notifications_enabled: profile.notifications,
        });
      if (error) {
        showAlert({ title: 'Error', message: error.message || 'Failed to save profile' });
      } else {
        setOverlay('none');
        showAlert({ title: 'Success', message: 'Profile updated successfully' });
      }
    } catch (e: any) {
      showAlert({ title: 'Error', message: e.message || 'Failed to save profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const initials = (profile.fullName || user.email || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (loading) {
    return <LoadingScreen message="Loading your account…" />;
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="log-in-outline" size={48} color={colors.muted} />
        <Text style={[styles.title, { color: colors.text, marginTop: 12 }]}>Sign in to view your account</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={() => navigateTo?.('Auth')}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingTop: StatusBar.currentHeight || 0, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== Profile card ===== */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{initials || 'A'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {profile.fullName || 'Auto Help Customer'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.muted }]} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={() => setOverlay('edit')} hitSlop={8}>
              <Ionicons name="create-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={[styles.profileMetaRow, { borderColor: `${colors.primary}22` }]}>
            <Ionicons name="call-outline" size={14} color={colors.muted} />
            <Text style={[styles.profileMetaText, { color: colors.text }]} numberOfLines={1}>
              {profile.phone || 'No phone added'}
            </Text>
          </View>
          <Text style={[styles.memberSince, { color: colors.muted }]}>
            Member since {new Date(user.created_at || Date.now()).toLocaleDateString()}
          </Text>
        </View>

        {/* ===== Quick Actions ===== */}
        <Text style={[styles.sectionHeader, { color: colors.muted }]}>QUICK ACTIONS</Text>

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.('Orders')}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>My Orders</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.('Notifications')}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="notifications" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Push alerts</Text>
          </View>
          <View style={styles.switchContainer}>
            <Switch
              value={profile.notifications}
              onValueChange={(value) => setProfile((prev) => ({ ...prev, notifications: value }))}
              trackColor={{ false: '#b0b0b0', true: colors.primary }}
            />
          </View>
        </View>

        <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>AI assistant button</Text>
          </View>
          <View style={styles.switchContainer}>
            <Switch
              value={!chatHidden}
              onValueChange={(value) => setChatHidden(!value)}
              trackColor={{ false: '#b0b0b0', true: colors.primary }}
            />
          </View>
        </View>

        {/* ===== Settings ===== */}
        <Text style={[styles.sectionHeader, { color: colors.muted }]}>SETTINGS</Text>

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} activeOpacity={0.7} onPress={() => void openNotificationSettings()}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Notification settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.('Checkout')}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Address book</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        {/* ===== Contact Support ===== */}
        <Text style={[styles.sectionHeader, { color: colors.muted }]}>CONTACT SUPPORT</Text>

        {settings.contact_whatsapp ? (
          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() =>
            Linking.openURL(
              /https?:\/\//i.test(settings.contact_whatsapp || '')
                ? settings.contact_whatsapp!
                : `https://wa.me/${settings.contact_whatsapp!.replace(/[^0-9]/g, '')}`,
            )
          }>
            <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.support}20` }]}>
              <Ionicons name="logo-whatsapp" size={18} color={ICON_COLORS.support} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>WhatsApp</Text>
              <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{settings.contact_whatsapp}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}

        {settings.contact_email ? (
          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => Linking.openURL(`mailto:${settings.contact_email}`)}>
            <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.support}20` }]}>
              <Ionicons name="mail-outline" size={18} color={ICON_COLORS.support} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>Email</Text>
              <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{settings.contact_email}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}

        {settings.contact_phone ? (
          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => Linking.openURL(`tel:${settings.contact_phone!.replace(/[^0-9+]/g, '')}`)}>
            <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.support}20` }]}>
              <Ionicons name="call-outline" size={18} color={ICON_COLORS.support} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>Phone</Text>
              <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{settings.contact_phone}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}

        {settings.contact_link ? (
          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => Linking.openURL(settings.contact_link!)}>
            <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.support}20` }]}>
              <Ionicons name="link-outline" size={18} color={ICON_COLORS.support} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>
                {settings.contact_link_label || 'Website'}
              </Text>
              <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{settings.contact_link}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>
        ) : null}

        {settings.social_links ? (
          (settings.social_links as { label: string; url: string }[]).map((s) => (
            <TouchableOpacity key={s.label} style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => Linking.openURL(s.url)}>
              <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.support}20` }]}>
                <Ionicons name="logo-social" size={18} color={ICON_COLORS.support} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>{s.label}</Text>
                <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{s.url as string}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </TouchableOpacity>
          ))
        ) : null}

        {/* ===== Account actions ===== */}
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => { setDeleteEmail(''); setOverlay('delete'); }}>
          <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.delete}20` }]}>
            <Ionicons name="trash-outline" size={18} color={ICON_COLORS.delete} />
          </View>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.logoutRow, { backgroundColor: colors.surface }]} onPress={handleSignOut} disabled={signingOut}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${ICON_COLORS.logout}20` }]}>
              <Ionicons name="log-out" size={18} color={ICON_COLORS.logout} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Logout</Text>
          </View>
          {signingOut ? <ActivityIndicator size="small" color={colors.muted} /> : <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
        </TouchableOpacity>

        {/* ===== Footer ===== */}
        <View style={styles.footerRow}>
          <Pressable onPress={() => navigateTo?.('PrivacyPolicy')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.muted }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.footerDivider, { color: colors.muted }]}>•</Text>
          <Pressable onPress={() => navigateTo?.('Terms')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.muted }]}>Terms & Conditions</Text>
          </Pressable>
        </View>
        <Pressable style={styles.versionButton} onPress={() => setShowAppLoading(true)} hitSlop={10}>
          <Text style={[styles.versionText, { color: colors.muted }]}>Auto Help GH v{APP_VERSION}</Text>
        </Pressable>
      </ScrollView>

      {/* ===== Edit profile overlay ===== */}
      {overlay === 'edit' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { borderColor: colors.surface, backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setOverlay('none')} hitSlop={8} style={styles.overlayClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>Edit profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Full name</Text>
            <TextInput value={profile.fullName} onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))} placeholder="Full name" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.surface, color: colors.text }]} />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone number</Text>
            <TextInput value={profile.phone} onChangeText={(value) => setProfile((prev) => ({ ...prev, phone: value }))} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={[styles.input, { borderColor: colors.surface, color: colors.text }]} />
            <View style={[styles.overlayToggleRow, { borderColor: colors.surface }]}>
              <View>
                <Text style={[styles.overlayToggleTitle, { color: colors.text }]}>Push alerts</Text>
                <Text style={[styles.overlayToggleSub, { color: colors.muted }]}>Order updates and alerts</Text>
              </View>
              <View style={styles.switchContainer}>
                <Switch value={profile.notifications} onValueChange={(value) => setProfile((prev) => ({ ...prev, notifications: value }))} trackColor={{ false: '#b0b0b0', true: colors.primary }} />
              </View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: savingProfile ? 0.7 : 1, marginTop: 16 }]} onPress={() => void saveProfile()} disabled={savingProfile}>
              {savingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save changes</Text>}
            </TouchableOpacity>
            <Image source={require('../../assets/icon.png')} style={styles.overlayImage} />
          </ScrollView>
        </View>
      )}

      {/* ===== Delete account overlay ===== */}
      {overlay === 'delete' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { borderColor: colors.surface, backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setOverlay('none')} hitSlop={8} style={styles.overlayClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>Delete account</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.deleteWarningBox}>
              <Ionicons name="warning-outline" size={28} color={colors.danger || '#FF3B30'} />
              <Text style={[styles.deleteWarningTitle, { color: colors.text }]}>This action is permanent</Text>
              <Text style={[styles.deleteWarningBody, { color: colors.muted }]}>Deleting your account removes your profile, orders and saved data. This cannot be undone.</Text>
            </View>
            <Text style={[styles.confirmEmailHint, { color: colors.muted }]}>Type your email to confirm:</Text>
            <TextInput value={deleteEmail} onChangeText={setDeleteEmail} placeholder={user.email || 'your@email.com'} placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.input, { borderColor: colors.surface, color: colors.text }]} />
            <TouchableOpacity style={[styles.deleteConfirmBtn, { backgroundColor: colors.danger || '#FF3B30', opacity: deleting ? 0.6 : 1 }]} onPress={() => void performDelete()} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteConfirmText}>Delete my account</Text>}
            </TouchableOpacity>
            {showAppLoading && <LoadingScreen message="Deleting your account…" />}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  primaryBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Profile card
  profileCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '600' },
  profileEmail: { fontSize: 13, marginTop: 3 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#5856D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  profileMetaText: { fontSize: 13, fontWeight: '500' },
  memberSince: { fontSize: 12, marginTop: 8, fontWeight: '500' },

  // Section header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    marginHorizontal: 22,
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 1.2,
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  switchContainer: { flexShrink: 0, marginLeft: 8 },
  contactInfo: { flex: 1, marginLeft: 12 },
  contactSub: { fontSize: 12, marginTop: 2 },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 24,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  footerLink: { fontSize: 12, fontWeight: '600' },
  footerDivider: { fontSize: 10 },
  versionButton: { alignItems: 'center', marginTop: 6, paddingBottom: 24 },
  versionText: { fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Overlay
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  overlayClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  overlayTitle: { fontSize: 17, fontWeight: '900' },
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
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  overlayImage: { width: 90, height: 90, borderRadius: 45, marginTop: 20, alignSelf: 'center' },

  // Delete overlay
  deleteWarningBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteWarningTitle: { fontSize: 16, fontWeight: '900', marginTop: 8, marginBottom: 6, textAlign: 'center' },
  deleteWarningBody: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 19 },
  confirmEmailHint: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  deleteConfirmBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  deleteConfirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
