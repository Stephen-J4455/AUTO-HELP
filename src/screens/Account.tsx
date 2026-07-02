import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, TextInput, Switch, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/supabase';

type Profile = {
  fullName: string;
  phone: string;
  notifications: boolean;
};

export default function Account({ navigateTo }: { navigateTo?: (name: string, params?: any) => void }) {
  const { colors } = useTheme();
  const { user, session, signOut, loading } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile>({ fullName: '', phone: '', notifications: true });

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
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Sign Out',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out');
          } finally {
            setSigningOut(false);
          }
        },
        style: 'destructive',
      },
    ]);
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
      Alert.alert('Saved', 'Your profile settings were updated.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save profile.');
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.text }]}>Login or Create Account</Text>
        <Pressable
          style={[styles.loginbutton, { backgroundColor: colors.primary }]}
          onPress={() => {}}
        >
          <Text style={{ color: colors.surface }}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile details</Text>
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
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
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
  text: {
    fontSize: 18,
    marginBottom: 20,
  },
  loginbutton: { marginTop: 20, padding: 12, borderRadius: 30 },
  name: { fontSize: 16, fontWeight: '900', marginBottom: 2 },
  email: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
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
});
