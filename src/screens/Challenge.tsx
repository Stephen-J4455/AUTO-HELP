import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/Auth';
import { MISSIONS } from '../features/challenge/progress';
import { ChallengeVisibilityContext } from '../features/challenge/visibility';
import { supabase } from '../supabase/supabase';
import { useTheme } from '../theme';
import { useReduceMotion } from '../utils/useReduceMotion';

type WheelName = 'daily' | 'weekly';
type Slice = { label: string; kind: 'points' | 'cash' | 'data'; weight: number };
type Prize = Slice & { index: number };
type Award = { id: number; prize: Prize; fulfilled: boolean; points_spent: number; phone_number: string | null; network: Network | null };
type PrizeContactTarget = { id: number; prize: Prize };
const NETWORKS = { mtn: 'MTN', airteltigo: 'AirtelTigo', telecel: 'Telecel' } as const;
type Network = keyof typeof NETWORKS;
type State = {
  campaign: { enabled?: boolean; days: number; weekly_enabled: boolean; daily_wheel: Slice[]; weekly_wheel: Slice[] };
  day: number;
  started: boolean;
  points: number;
  nextWeekly: string | null;
  weeklyReady: boolean;
  reports: Record<string, { report: string; prize: Prize | null }>;
  prizes: Award[];
  won: Prize | null;
};

const DAY_TILE_WIDTH = 68;
const DAY_SPACING = 6;

function ChallengeDays({ days, today, reports }: { days: number[]; today: number; reports: State['reports'] }) {
  const firstVisible = Math.max(0, Math.min(today, days.length - 1) - 1);
  return (
    <FlatList
      key={firstVisible}
      horizontal
      accessibilityLabel="Challenge days"
      data={days}
      keyExtractor={(index) => String(index)}
      initialScrollIndex={firstVisible || undefined}
      getItemLayout={(_, index) => ({ length: DAY_TILE_WIDTH + DAY_SPACING, offset: index * (DAY_TILE_WIDTH + DAY_SPACING), index })}
      ItemSeparatorComponent={DaySeparator}
      renderItem={({ item: index }) => {
        const complete = !!reports[index];
        const current = index === today;
        const status = complete ? 'Complete' : current ? 'Today' : index < today ? 'Missed' : 'Upcoming';
        return (
          <View accessible accessibilityLabel={`Day ${index + 1}, ${status}`} style={[styles.dayTile, current && styles.currentDayTile]}>
            <View style={styles.dayHeading}>
              <Text style={styles.dayLabel}>Day {index + 1}</Text>
              {complete && <Ionicons accessible={false} name="checkmark-circle" size={12} color="#ffdc9d" />}
            </View>
            <Text style={styles.dayStatus}>{status}</Text>
          </View>
        );
      }}
    />
  );
}

function DaySeparator() {
  return <View style={styles.daySeparator} />;
}

function prizeResult(prize: Prize) {
  return prize.kind === 'points' ? 'Daily spin complete.' : `You won ${prize.label}.`;
}

function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, { backgroundColor: colors.primary, opacity: disabled ? 0.5 : 1 }]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

function PrizeContact({ target, onClose, onSaved }: {
  target: PrizeContactTarget;
  onClose: () => void;
  onSaved: (phone: string, network: Network) => void;
}) {
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<Network | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  async function save() {
    if (inFlight.current || !network) return;
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!/^\+?[0-9]{9,15}$/.test(normalizedPhone)) {
      setError('Enter a phone number with 9 to 15 digits.');
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      const { error: failure } = await supabase.rpc('save_challenge_prize_contact', {
        prize_id: target.id, phone: normalizedPhone, mobile_network: network, test_spin: false,
      });
      if (failure) throw failure;
      onSaved(normalizedPhone, network);
    } catch (failure) {
      setError((failure as Error).message || 'Could not save your delivery details.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const close = () => { if (!inFlight.current) onClose(); };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.contactOverlay, { backgroundColor: colors.overlay }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.contactLayout}>
          <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Prize delivery details</Text>
            <Text style={[styles.copy, { color: colors.text }]}>{target.prize.label}</Text>
            <Text style={[styles.copy, { color: colors.text }]}>Phone number</Text>
            <TextInput accessibilityLabel="Phone number" value={phone} onChangeText={setPhone} editable={!saving}
              keyboardType="phone-pad" maxLength={24} placeholder="024 123 4567" placeholderTextColor={colors.muted}
              style={[styles.contactInput, { color: colors.text, borderColor: colors.border }]} />
            <Text style={[styles.copy, { color: colors.text }]}>Network</Text>
            <View style={styles.networks}>
              {(Object.keys(NETWORKS) as Network[]).map((option) => (
                <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: network === option, disabled: saving }}
                  disabled={saving} onPress={() => setNetwork(option)} style={[styles.network, {
                    borderColor: network === option ? colors.primary : colors.border,
                    backgroundColor: network === option ? colors.primary : colors.surface,
                  }]}>
                  <Text style={{ color: network === option ? '#fff' : colors.text }}>{NETWORKS[option]}</Text>
                </Pressable>
              ))}
            </View>
            {!!error && <Text accessibilityLiveRegion="assertive" style={[styles.copy, { color: colors.danger }]}>{error}</Text>}
            <Action label={saving ? 'Saving…' : 'Save delivery details'} onPress={() => void save()} disabled={saving || !phone.trim() || !network} />
            <Pressable accessibilityRole="button" disabled={saving} onPress={close} style={styles.later}>
              <Text style={{ color: colors.muted }}>Later</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Wheel({ slices, rotation }: { slices: Slice[]; rotation: Animated.Value }) {
  const labels = slices.map((slice) => slice.label);
  const step = 360 / labels.length;
  const dense = labels.length > 16;
  const labelWidth = dense ? 62 : 78;
  const labelRadius = dense ? 74 : 67;
  return (
    <View style={styles.wheelFrame} accessible accessibilityLabel={`Prize wheel. ${[...new Set(labels)].join(', ')}`}>
      <Animated.View style={[styles.wheel, { transform: [{ rotate: rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) }] }]}>
        {labels.length > 1 && labels.map((_, index) => {
          const degrees = (index - 0.5) * step;
          const angle = degrees * Math.PI / 180;
          return <View key={`divider-${index}`} testID="wheel-divider" style={[styles.wheelDivider, {
            left: 107.5 + Math.sin(angle) * 63,
            top: 63 - Math.cos(angle) * 63,
            transform: [{ rotate: `${degrees}deg` }],
          }]} />;
        })}
        {labels.map((label, index) => {
          const degrees = index * step;
          const angle = degrees * Math.PI / 180;
          const tilt = labels.length <= 4 ? 0 : (degrees % 180) - 90;
          return (
            <View key={index} style={[styles.wheelLabel, {
              width: labelWidth,
              left: 108 + Math.sin(angle) * labelRadius - labelWidth / 2,
              top: 102 - Math.cos(angle) * labelRadius,
              transform: [{ rotate: `${tilt}deg` }],
            }]}>
              <Text numberOfLines={1} style={styles.wheelLabelText}>{label}</Text>
            </View>
          );
        })}
      </Animated.View>
      <Ionicons name="flash" size={32} color="#ffdc9d" style={styles.hub} />
      <Ionicons name="caret-down" size={30} color="#ffdc9d" style={styles.pointer} />
    </View>
  );
}

function Campaign({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { hideChallenge } = useContext(ChallengeVisibilityContext);
  const reduceMotion = useReduceMotion();
  const [state, setState] = useState<State | null>(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyPrize, setWeeklyPrize] = useState<Prize | null>(null);
  const [contactTarget, setContactTarget] = useState<PrizeContactTarget | null>(null);
  const daily = useRef(new Animated.Value(0)).current;
  const weekly = useRef(new Animated.Value(0)).current;
  const running = useRef(false);
  const backgroundRefresh = useRef<AbortController | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      animation.current?.stop();
    };
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (running.current) return;
    if (backgroundRefresh.current && !manual) return;
    backgroundRefresh.current?.abort();
    const request = new AbortController();
    backgroundRefresh.current = request;
    if (manual) setRefreshing(true);
    try {
      const { data, error: failure } = await supabase.rpc('play_challenge', { action: 'status' })
        .abortSignal(request.signal);
      if (failure) throw failure;
      if (mounted.current && !request.signal.aborted) {
        if (data.campaign.enabled === false) {
          hideChallenge();
          return;
        }
        setState(data);
        setError('');
      }
    } catch (failure) {
      if (mounted.current && !request.signal.aborted) {
        setError((failure as Error).message || 'Could not load the challenge.');
      }
    } finally {
      if (backgroundRefresh.current === request) {
        backgroundRefresh.current = null;
        if (mounted.current) setRefreshing(false);
      }
    }
  }, [hideChallenge]);

  useFocusEffect(useCallback(() => {
    void refresh();
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refresh(true);
      else backgroundRefresh.current?.abort();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, 10_000);
    return () => {
      clearInterval(timer);
      listener.remove();
      backgroundRefresh.current?.abort();
      backgroundRefresh.current = null;
      setRefreshing(false);
    };
  }, [refresh]));

  async function animateSpin(wheel: WheelName, index: number, length: number) {
    const rotation = wheel === 'daily' ? daily : weekly;
    const angle = 360 - index * 360 / length;
    rotation.setValue(0);
    if (reduceMotion) {
      rotation.setValue(angle);
      return;
    }
    await new Promise<void>((resolve) => {
      animation.current = Animated.timing(rotation, {
        toValue: 1440 + angle, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      });
      animation.current.start(() => resolve());
    });
  }

  async function play(action: 'report' | WheelName) {
    if (!state || state.campaign.enabled === false || running.current) return;
    running.current = true;
    backgroundRefresh.current?.abort();
    setBusy(true);
    setError('');
    try {
      const { data, error: failure } = await supabase.rpc('play_challenge', {
        action, expected_day: state.day, feedback: action === 'report' ? report.trim() : null,
      });
      if (failure) throw failure;
      const next = data as State;
      if (!mounted.current) return;
      setState(next);
      const won = next.won;
      if (won && action !== 'report') {
        if (action === 'weekly') setWeeklyPrize(null);
        const slices = action === 'daily' ? next.campaign.daily_wheel : next.campaign.weekly_wheel;
        await animateSpin(action, won.index, slices.length);
        if (!mounted.current) return;
        if (action === 'weekly') setWeeklyPrize(won);
        if (won.kind !== 'points') {
          const previousIds = new Set(state.prizes.map(({ id }) => id));
          const award = next.prizes.find(({ id, fulfilled, phone_number, prize, points_spent }) =>
            !previousIds.has(id) && !fulfilled && !phone_number && prize.kind === won.kind &&
            prize.label === won.label && prize.index === won.index && (points_spent === 0) === (action === 'daily'),
          );
          if (award) setContactTarget(award);
        }
      }
      if (action === 'report') setReport('');
    } catch (failure) {
      const message = (failure as Error).message;
      if (!mounted.current) return;
      if (message === 'The challenge is currently paused.') {
        hideChallenge();
      } else {
        setError(message === 'You need more points' ? 'The weekly spin is still locked.' : message || 'Unable to save. Please try again.');
      }
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function contactSaved(target: PrizeContactTarget, phone: string, network: Network) {
    backgroundRefresh.current?.abort();
    setState((previous) => previous && ({
      ...previous,
      prizes: previous.prizes.map((award) => award.id === target.id ? { ...award, phone_number: phone, network } : award),
    }));
    setContactTarget(null);
  }

  const card = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const copy = [styles.copy, { color: colors.text }];
  const title = [styles.title, { color: colors.text }];
  if (!state) return <View style={styles.content}><Text style={copy}>{error || 'Loading campaign…'}</Text>{!!error && <Action label="Try again" onPress={() => void refresh()} />}</View>;
  const { campaign, day } = state;
  const active = day >= 0 && day < campaign.days;
  const weeklyAvailable = campaign.weekly_enabled && day >= 0 && day <= campaign.days;
  const days = Array.from({ length: campaign.days }, (_, index) => index);
  const completed = days.filter((index) => !!state.reports[index]).length;
  const mission = active ? MISSIONS[day % MISSIONS.length] : null;
  const entry = state.reports[day];
  const nextSpin = state.nextWeekly ? new Date(state.nextWeekly) : null;
  const nextDate = nextSpin && nextSpin.getTime() > Date.now() ? nextSpin.toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) : null;
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} colors={[colors.primary]} tintColor={colors.primary} />}>
      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <Text style={[styles.heroTitle, { flex: 1 }]}>{campaign.days}-day challenge</Text>
          <View accessible accessibilityLabel={`${state.points} points`} accessibilityLiveRegion="polite" style={styles.pointsBadge}>
            <Ionicons accessible={false} name="flash" size={16} color="#ffdc9d" />
            <Text style={styles.pointsText}>{state.points.toLocaleString('en-GH')} pts</Text>
          </View>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.wheelText}>{completed} of {campaign.days} days complete</Text>
        <ChallengeDays days={days} today={day} reports={state.reports} />
      </View>
      {!!error && <Text accessibilityLiveRegion="assertive" style={[styles.copy, { color: colors.danger }]}>{error}</Text>}
      {mission ? (
        <View style={card}>
          <Text style={copy}>Day {day + 1}</Text>
          <Text style={title}>{mission.title}</Text>
          <Text style={copy}>{mission.task}</Text>
          {entry ? <Text style={copy}>Today’s report is saved.</Text> : (
            <>
              <Action label="Open task page" onPress={() => {
                const target = mission.destination;
                if ('tab' in target) navigation.popTo('Main', { tab: target.tab });
                else navigation.navigate(target.screen);
              }} />
              <Text style={copy}>{mission.prompt}</Text>
              <TextInput accessibilityLabel={mission.prompt} value={report} onChangeText={setReport} multiline maxLength={450}
                placeholder="Tell us what happened" placeholderTextColor={colors.muted}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
              <Action label="Save report" onPress={() => void play('report')} disabled={busy || report.trim().length < 10} />
            </>
          )}
        </View>
      ) : <View style={card}><Text style={title}>{completed === campaign.days ? 'Challenge complete' : 'Challenge ended'}</Text></View>}
      {active && (
        <View style={styles.spin}>
          <Text style={styles.heroTitle}>Daily prize wheel</Text>
          <Text style={styles.wheelText}>Save today’s report to unlock one spin.</Text>
          <Wheel slices={campaign.daily_wheel} rotation={daily} />
          <Text accessibilityLiveRegion="polite" style={styles.wheelText}>
            {entry?.prize && !busy ? prizeResult(entry.prize) : ''}
          </Text>
          <Action label="Spin daily wheel" onPress={() => void play('daily')} disabled={busy || !entry || !!entry.prize} />
        </View>
      )}
      <View style={styles.spin}>
        <Text style={styles.heroTitle}>Weekly cash & data wheel</Text>
        <Text style={styles.wheelText}>Unlocks every seven days.</Text>
        {weeklyAvailable ? (
          <>
            <Wheel slices={campaign.weekly_wheel} rotation={weekly} />
            <Text style={styles.wheelText}>{!state.started ? 'Save your first report to start the clock.' : state.weeklyReady ? 'Ready to spin' : nextDate ? `Next spin window opens ${nextDate} Ghana time.` : 'Keep completing daily challenges to unlock a spin.'}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.wheelText}>{weeklyPrize ? prizeResult(weeklyPrize) : ''}</Text>
            <Action label="Spin weekly wheel" onPress={() => void play('weekly')} disabled={busy || !state.weeklyReady} />
          </>
        ) : <Text style={styles.wheelText}>{active ? 'The weekly prize wheel is currently paused.' : 'This challenge has ended.'}</Text>}
      </View>
      {!!state.prizes.length && <View style={card}>
        <Text style={title}>Your prizes</Text>
        {state.prizes.map((award) => (
          <View key={award.id} style={styles.prizeDetails}>
            <Text style={copy}>#{award.id} · {award.prize.label} · {award.fulfilled ? 'Delivered' : award.phone_number ? 'Awaiting delivery' : 'Add delivery details'}</Text>
            {!award.fulfilled && !award.phone_number && <Action label="Add delivery details" onPress={() => setContactTarget(award)} disabled={busy} />}
          </View>
        ))}
      </View>}
      {contactTarget && <PrizeContact target={contactTarget} onClose={() => setContactTarget(null)}
        onSaved={(phone, network) => contactSaved(contactTarget, phone, network)} />}
    </ScrollView>
  );
}

export default function Challenge({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader title="Daily challenge" onBack={() => navigation.goBack()} />
      {user ? <Campaign key={user.id} navigation={navigation} /> : (
        <View style={styles.content}><Action label="Sign in to join the challenge" onPress={() => navigation.navigate('Auth', { initialMode: 'login' })} /></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 580, alignSelf: 'center', padding: 16, gap: 14 },
  card: { padding: 16, gap: 10, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  hero: { backgroundColor: '#541229', borderRadius: 22, padding: 18, gap: 8 },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { color: '#fff7f8', fontSize: 23, fontWeight: '900' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 9, backgroundColor: '#6d2844', borderRadius: 14 },
  pointsText: { color: '#ffdc9d', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  title: { fontSize: 20, fontWeight: '800' },
  copy: { fontSize: 14, lineHeight: 21 },
  contactOverlay: { flex: 1 },
  contactLayout: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'center', padding: 18 },
  contactInput: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 16 },
  networks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  network: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 11 },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  prizeDetails: { gap: 6 },
  dayTile: { width: DAY_TILE_WIDTH, minHeight: 48, paddingHorizontal: 4, paddingVertical: 5, gap: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 9, borderColor: '#9a5870', backgroundColor: '#6d2844' },
  currentDayTile: { borderColor: '#ffdc9d' },
  daySeparator: { width: DAY_SPACING },
  dayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', columnGap: 3 },
  dayLabel: { color: '#fff7f8', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  dayStatus: { color: '#f1cad8', fontSize: 11, textAlign: 'center' },
  spin: { backgroundColor: '#291321', padding: 18, borderRadius: 22, gap: 7 },
  wheelText: { color: '#f1cad8', fontSize: 14, lineHeight: 19 },
  button: { padding: 13, borderRadius: 13, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
  input: { minHeight: 85, borderWidth: 1, borderRadius: 12, padding: 10, textAlignVertical: 'top' },
  wheelFrame: { width: 220, height: 220, alignSelf: 'center', marginVertical: 12, justifyContent: 'center', alignItems: 'center' },
  wheel: { width: 220, height: 220, backgroundColor: '#752744', borderColor: '#e292a8', borderWidth: 2, borderRadius: 110 },
  wheelDivider: { position: 'absolute', width: 1, height: 90, backgroundColor: '#e292a8' },
  wheelLabel: { position: 'absolute', height: 12, justifyContent: 'center' },
  wheelLabelText: { fontSize: 10, lineHeight: 12, fontWeight: '800', color: '#fff7f8', textAlign: 'center' },
  pointer: { position: 'absolute', top: -12 },
  hub: { position: 'absolute' },
});
