import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/Auth';
import { supabase } from '../supabase/supabase';

type NotificationEntry = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

function timeAgo(dateIso: string): string {
  const created = new Date(dateIso).getTime();
  const now = Date.now();
  const minutes = Math.max(1, Math.floor((now - created) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Notifications({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadNotifications() {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('inbox_entries')
      .select('id, title, body, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setEntries(
      (data || []).map((item: any) => ({
        id: String(item.id),
        title: String(item.title || 'Notification'),
        body: String(item.body || ''),
        is_read: Boolean(item.is_read),
        created_at: String(item.created_at || new Date().toISOString()),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    void loadNotifications().then(() => {
      if (!mounted) return;
    });
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const unreadCount = entries.filter((e) => !e.is_read).length;

  async function markAsRead(id: string) {
    // Optimistically update local state.
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)));
    const { error: updateError } = await supabase
      .from('inbox_entries')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user?.id || '');
    if (updateError) {
      // Roll back on failure.
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: false } : e)));
    }
  }

  async function markAllRead() {
    if (!unreadCount) return;
    setSaving(true);
    const ids = entries.filter((e) => !e.is_read).map((e) => e.id);
    setEntries((prev) => prev.map((e) => ({ ...e, is_read: true })));
    const { error: updateError } = await supabase
      .from('inbox_entries')
      .update({ is_read: true })
      .in('id', ids)
      .eq('user_id', user?.id || '');
    if (updateError) {
      // Reload to recover correct state.
      void loadNotifications();
    }
    setSaving(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.surface }]} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            style={[styles.markAllBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
            disabled={saving}
            onPress={markAllRead}
          >
            <Text style={styles.markAllText}>{saving ? 'Working…' : 'Mark all read'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => markAsRead(item.id)}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: item.is_read ? 'transparent' : colors.primary,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={{ color: colors.muted, lineHeight: 18 }}>{item.body || 'No details provided.'}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900' },
  markAllBtn: { marginLeft: 'auto', paddingHorizontal: 12, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markAllText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 120, gap: 10 },
  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '800', flex: 1 },
});
