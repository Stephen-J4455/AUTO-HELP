import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../context/Auth';
import { Ionicons } from '@expo/vector-icons';

export default function Account() {
  const { colors } = useTheme();
  const { user, session, signOut, loading } = useAuth();
  const [signingOut, setSigningOut] = React.useState(false);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person-circle" size={80} color={colors.primary} />
        </View>

        <Text style={[styles.email, { color: colors.text }]}>{user.email}</Text>

        <View style={styles.infoSection}>
          <Text style={[styles.label, { color: colors.muted }]}>
            Account ID
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {user.id.slice(0, 12)}...
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={[styles.label, { color: colors.muted }]}>
            Member Since
          </Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {new Date(user.created_at!).toLocaleDateString()}
          </Text>
        </View>
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
            <Text style={[styles.signoutText, { color: colors.surface }]}>
              Sign Out
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center'
  },
  card: {
    borderRadius: 30,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
  },
  loginbutton: {
    marginTop: 20,
    padding: 12,
    borderRadius: 30,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 25,
  },
  infoSection: {
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  signoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    gap: 10,
  },
  signoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
