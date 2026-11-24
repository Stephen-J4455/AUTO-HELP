import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChallengeLink from '../components/ChallengeLink';
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
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';
import { useAppAlert } from '../components/AppAlert';
import { APP_VERSION } from '../utils/appVersion';
import { useStoreSettings } from '../utils/remoteContent';
import { openNotificationSettings } from '../utils/pushNotifications';

// Overlay being shown: none, the edit-profile page, or the delete-account flow.
type Overlay = 'none' | 'edit' | 'delete';

export default function Account({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const { user, signOut, deleteAccount, loading } = useAuth();
  const { show: showAlert } = useAppAlert();
  const { settings } = useStoreSettings();

  // --- State ---
  const [signingOut, setSigningOut] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profile, setProfile] = React.useState({ fullName: '', phone: '', notifications: true, lightMode: false });
  const [overlay, setOverlay] = React.useState<Overlay>('none');

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
        showAlert({ title: 'Error', message: error || 'Failed to delete account' });
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

  const initials = (profile.fullName || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (loading) {
    return <ActivityIndicator accessibilityLabel="Loading your account" style={{ flex: 1 }} color={colors.primary} />;
  }

  if (!user) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.signedOutContent, { paddingTop: top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.signedOutHero, { backgroundColor: colors.surface }]}>
          <View style={[styles.signedOutIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Image source={require('../../assets/icon.png')} style={styles.signedOutLogo} resizeMode="contain" />
          </View>
          <Text style={[styles.signedOutTitle, { color: colors.text }]}>Your account</Text>
          <Text style={[styles.signedOutBody, { color: colors.muted }]}>Sign in to track orders and manage your account.</Text>
          <Pressable style={[styles.primaryBtn, styles.signedOutPrimary, { backgroundColor: colors.primary }]} onPress={() => navigateTo?.('Auth', { initialMode: 'login' })}>
            <Ionicons name="log-in-outline" size={19} color="#fff" />
            <Text style={styles.primaryBtnText}>Sign in</Text>
          </Pressable>
          <Pressable style={[styles.secondaryBtn, { borderColor: `${colors.primary}55` }]} onPress={() => navigateTo?.('Auth', { initialMode: 'signup' })}>
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Create an account</Text>
          </Pressable>
        </View>

        <ChallengeLink onPress={() => navigateTo?.('Challenge')} />

        <Text style={[styles.sectionHeader, { color: colors.muted }]}>What you can do</Text>
        <View style={[styles.benefitList, { backgroundColor: colors.surface }]}>
          {[
            ['receipt-outline', 'Track every order', 'See order status and history in one place.'],
            ['car-outline', 'Save your vehicles', 'Find compatible parts faster next time.'],
            ['shield-checkmark-outline', 'Secure checkout', 'Keep your details ready for a smoother purchase.'],
          ].map(([icon, title, body]) => (
            <View key={title} style={styles.benefitRow}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}18` }]}>
                <Ionicons name={icon as any} size={18} color={colors.primary} />
              </View>
              <View style={styles.benefitCopy}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.benefitBody, { color: colors.muted }]}>{body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionHeader, { color: colors.muted }]}>Legal</Text>
        <Pressable style={[styles.legalRow, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.('PrivacyPolicy')}>
          <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
          <Text style={[styles.legalLabel, { color: colors.text }]}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </Pressable>
        <Pressable style={[styles.legalRow, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.('Terms')}>
          <Ionicons name="document-text-outline" size={19} color={colors.primary} />
          <Text style={[styles.legalLabel, { color: colors.text }]}>Terms & Conditions</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </Pressable>

        <Text style={[styles.versionText, { color: colors.muted }]}>Auto Help GH v{APP_VERSION}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.accountContent, { paddingTop: top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Account</Text>
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
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit profile" style={[styles.editBtn, { backgroundColor: colors.background }]} onPress={() => setOverlay('edit')}>
              <Ionicons name="create-outline" size={19} color={colors.accentText} />
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

        <View style={styles.shortcuts}>
          {([
            ['Orders', 'receipt-outline', 'Orders'],
            ['Notifications', 'notifications-outline', 'Notifications'],
          ] as const).map(([label, icon, route]) => (
            <TouchableOpacity key={route} accessibilityRole="button"
              style={[styles.shortcut, { backgroundColor: colors.surface }]} onPress={() => navigateTo?.(route)}>
              <Ionicons name={icon} size={24} color={colors.accentText} />
              <Text style={[styles.shortcutLabel, { color: colors.text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ChallengeLink onPress={() => navigateTo?.('Challenge')} />

        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.text }]}>Preferences</Text>
        <View style={[styles.rowGroup, { backgroundColor: colors.border }]}>
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

        </View>
        {!!(settings.contact_whatsapp || settings.contact_email || settings.contact_phone || settings.contact_link ||
          settings.social_facebook || settings.social_x || settings.social_tiktok || settings.social_instagram ||
          settings.social_discord || settings.social_threads || settings.social_twitch || settings.social_telegram) && <>
        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.text }]}>Help and contact</Text>
        <View style={[styles.rowGroup, { backgroundColor: colors.border }]}>

          {settings.contact_whatsapp ? (
            <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() =>
              Linking.openURL(
                /https?:\/\//i.test(settings.contact_whatsapp || '')
                  ? settings.contact_whatsapp!
                  : `https://wa.me/${settings.contact_whatsapp!.replace(/[^0-9]/g, '')}`,
              )
            }>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.accentText} />
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
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                <Ionicons name="mail-outline" size={18} color={colors.accentText} />
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
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                <Ionicons name="call-outline" size={18} color={colors.accentText} />
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
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                <Ionicons name="link-outline" size={18} color={colors.accentText} />
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

          {[
            ['Facebook', settings.social_facebook],
            ['X', settings.social_x],
            ['TikTok', settings.social_tiktok],
            ['Instagram', settings.social_instagram],
            ['Discord', settings.social_discord],
            ['Threads', settings.social_threads],
            ['Twitch', settings.social_twitch],
            ['Telegram', settings.social_telegram],
          ].filter((social): social is [string, string] => Boolean(social[1])).map(([label, url]) => (
              <TouchableOpacity key={label} style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => Linking.openURL(url)}>
                <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                  <Ionicons name="share-social-outline" size={18} color={colors.accentText} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text, marginBottom: 2 }]}>{label}</Text>
                  <Text style={[styles.contactSub, { color: colors.muted }]} numberOfLines={1}>{url}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </TouchableOpacity>
            ))}

        </View>
        </>}

        <Text accessibilityRole="header" style={[styles.sectionHeader, { color: colors.text }]}>Account management</Text>
        <View style={[styles.rowGroup, { backgroundColor: colors.border }]}>
          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => { setDeleteEmail(''); setOverlay('delete'); }}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.danger}20` }]}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Delete account</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={handleSignOut} disabled={signingOut}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconCircle, { backgroundColor: `${colors.accentText}20` }]}>
                <Ionicons name="log-out" size={18} color={colors.accentText} />
              </View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Sign out</Text>
            </View>
            {signingOut ? <ActivityIndicator size="small" color={colors.muted} /> : <Ionicons name="chevron-forward" size={20} color={colors.muted} />}
          </TouchableOpacity>

        </View>
        <View style={styles.footerRow}>
          <Pressable onPress={() => navigateTo?.('PrivacyPolicy')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.muted }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.footerDivider, { color: colors.muted }]}>•</Text>
          <Pressable onPress={() => navigateTo?.('Terms')} hitSlop={8}>
            <Text style={[styles.footerLink, { color: colors.muted }]}>Terms & Conditions</Text>
          </Pressable>
        </View>
        <View style={styles.versionButton}>
          <Text style={[styles.versionText, { color: colors.muted }]}>Auto Help GH v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* ===== Edit profile overlay ===== */}
      {overlay === 'edit' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { paddingTop: top + 12, borderColor: colors.border, backgroundColor: colors.background }]}>
            <TouchableOpacity onPress={() => setOverlay('none')} hitSlop={8} style={styles.overlayClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.overlayTitle, { color: colors.text }]}>Edit profile</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Full name</Text>
            <TextInput value={profile.fullName} onChangeText={(value) => setProfile((prev) => ({ ...prev, fullName: value }))} placeholder="Full name" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} />
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Phone number</Text>
            <TextInput value={profile.phone} onChangeText={(value) => setProfile((prev) => ({ ...prev, phone: value }))} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} />
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
          </ScrollView>
        </View>
      )}

      {/* ===== Delete account overlay ===== */}
      {overlay === 'delete' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, zIndex: 1000 }]}>
          <View style={[styles.overlayHeader, { paddingTop: top + 12, borderColor: colors.border, backgroundColor: colors.background }]}>
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
            <TextInput value={deleteEmail} onChangeText={setDeleteEmail} placeholder={user.email || 'your@email.com'} placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} />
            <TouchableOpacity style={[styles.deleteConfirmBtn, { backgroundColor: colors.danger || '#FF3B30', opacity: deleting ? 0.6 : 1 }]} onPress={() => void performDelete()} disabled={deleting}>
              {deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteConfirmText}>Delete my account</Text>}
            </TouchableOpacity>
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
  signedOutContent: { paddingBottom: 28 },
  signedOutHero: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 22, alignItems: 'center' },
  signedOutIcon: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  signedOutLogo: { width: 62, height: 62, borderRadius: 18 },
  signedOutTitle: { fontSize: 25, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  signedOutBody: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 310 },
  signedOutPrimary: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 20 },
  secondaryBtn: { width: '100%', borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { fontSize: 15, fontWeight: '800' },
  benefitList: { marginHorizontal: 16, borderRadius: 16, paddingVertical: 5 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  benefitCopy: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '800' },
  benefitBody: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  legalRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 15, gap: 12 },
  legalLabel: { flex: 1, fontSize: 15, fontWeight: '700' },

  accountContent: { paddingBottom: 24 },
  pageTitle: { marginHorizontal: 16, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginBottom: 14 },
  profileCard: { marginHorizontal: 16, borderRadius: 24, padding: 18, gap: 12 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 19, fontWeight: '800' },
  profileEmail: { fontSize: 13, marginTop: 3 },
  editBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  profileMetaText: { fontSize: 14, fontWeight: '600' },
  memberSince: { fontSize: 12 },
  shortcuts: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14 },
  shortcut: { flex: 1, minHeight: 82, padding: 14, gap: 9, borderRadius: 18, justifyContent: 'center' },
  shortcutLabel: { fontSize: 15, fontWeight: '800' },
  sectionHeader: { fontSize: 17, fontWeight: '800', marginHorizontal: 18, marginTop: 23, marginBottom: 8 },
  rowGroup: { marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', gap: StyleSheet.hairlineWidth },
  settingRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, paddingVertical: 9, paddingHorizontal: 14 },
  iconCircle: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  switchContainer: { flexShrink: 0, marginLeft: 8 },
  contactInfo: { flex: 1, minWidth: 0, paddingRight: 6 },
  contactSub: { fontSize: 12, marginTop: 2, marginLeft: 12 },

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
