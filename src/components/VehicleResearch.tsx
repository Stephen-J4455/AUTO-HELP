import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from './Markdown';
import { supabase } from '../supabase/supabase';
import { useTheme } from '../theme';

type Research = { reply: string; images?: string[]; sources: { url: string; title: string }[] };

export default function VehicleResearch({ vehicleId, onImages }: {
  vehicleId: string;
  onImages: (result: { vehicleId: string; images: string[] }) => void;
}) {
  const { colors } = useTheme();
  const [attempt, setAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState(true);
  const [result, setResult] = React.useState<Research>();
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const request = new AbortController();
    setBusy(true);
    setError('');
    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<Research>('chatbot', {
          body: { canvas: true, vehicleResearch: true, vehicleId, webSearch: true },
          signal: request.signal,
        });
        if (request.signal.aborted) return;
        if (error || !data?.reply) {
          setError('Web research is unavailable right now.');
        } else {
          setResult(data);
          onImages({ vehicleId, images: data.images ?? [] });
        }
      } catch {
        if (!request.signal.aborted) setError('The vehicle information couldn’t load.');
      } finally {
        if (!request.signal.aborted) setBusy(false);
      }
    })();
    return () => request.abort();
  }, [vehicleId, attempt, onImages]);

  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <View style={styles.heading}>
        <Ionicons name="construct-outline" size={20} color={colors.accentText} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Autobot vehicle overview</Text>
      </View>
      {result && <Markdown content={result.reply} />}
      {!!result?.sources?.length && (
        <View style={styles.sources}>
          <Text style={[styles.sourceTitle, { color: colors.text }]}>Sources</Text>
          {result.sources.map(({ url, title }) => /^https?:\/\//i.test(url) && (
            <Pressable key={url} accessibilityRole="link" onPress={() => void Linking.openURL(url).catch(() => {})}>
              <Text style={[styles.sourceLink, { color: colors.accentText }]}>{title}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {busy && <View style={styles.heading}>
        <ActivityIndicator size="small" color={colors.accentText} />
        <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
          Searching the web…
        </Text>
      </View>}
      {!!error && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{error}</Text>}
      {!busy && <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(previous => previous + 1)}>
          <Ionicons name="globe-outline" size={18} color={colors.accentText} />
          <Text style={[styles.sourceTitle, { color: colors.accentText }]}>{error ? 'Retry web search' : 'Refresh research'}</Text>
        </Pressable>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 16, borderRadius: 18, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 17, fontWeight: '800', flex: 1 },
  sources: { gap: 6 },
  sourceTitle: { fontWeight: '700' },
  sourceLink: { paddingVertical: 4, textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 },
});
