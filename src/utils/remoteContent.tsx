import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, Platform, ScrollView, Dimensions } from "react-native";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { supabase } from "../supabase/supabase";

function isLive(now: number, start?: string | null, end?: string | null): boolean {
  if (start && new Date(start).getTime() > now) return false;
  if (end && new Date(end).getTime() < now) return false;
  return true;
}

export type AppUpdateItem = {
  id: string;
  version: string;
  platform: string;
  title: string;
  message: string;
  release_notes: string | null;
  min_version: string | null;
  force_update: boolean;
  maintenance: boolean;
  active: boolean;
};

export type CampaignItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_target: string | null;
  placement: string;
  start_at: string | null;
  end_at: string | null;
};

export type AdItem = {
  id: string;
  title: string;
  image_url: string | null;
  target_url: string | null;
  description: string | null;
  cta_text: string | null;
  cta_target: string | null;
  placement: string;
  weight: number;
  active: boolean;
  start_at: string | null;
  end_at: string | null;
  style: string;
  cta_platform: string | null;
  background_color: string;
  text_color: string;
  accent_color: string;
  discount_color: string;
  discount_badge: string | null;
  border_radius: number;
  use_image_as_bg: boolean;
  show_on_web: boolean;
  show_on_mobile: boolean;
  views: number;
  interactions: number;
};

// Admin-managed store configuration (single row in `store_settings`).
// Drives the call-to-order banner on Home and the contact support details
// on the Account screen.
export type StoreSettings = {
  call_to_order_enabled: boolean;
  call_to_order_title: string;
  call_to_order_message: string;
  call_to_order_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_link: string | null;
  contact_link_label: string | null;
  // Social media links shown on the Contact support section
  social_facebook: string | null;
  social_x: string | null;
  social_tiktok: string | null;
  social_instagram: string | null;
  social_discord: string | null;
  social_threads: string | null;
  social_twitch: string | null;
  social_telegram: string | null;
  // Chatbot (OpenRouter) configuration
  chatbot_enabled: boolean;
  chatbot_enabled_admin: boolean;
  chatbot_model: string | null;
  chatbot_system_prompt: string | null;
};

// Increment a promotion's view/interaction counter from the public client.
// Uses the `record_ad_stat` SECURITY DEFINER RPC so anonymous users can
// update the counter without full UPDATE rights.
export function recordAdStat(id: string, kind: "view" | "interaction") {
  Promise.resolve(supabase.rpc("record_ad_stat", { p_ad: id, p_kind: kind }))
    .then(() => {})
    .catch((e) => {
      // Surface failures during development; the counter is best-effort so we
      // intentionally do not throw — a failed stat must never break the UI.
      console.warn("recordAdStat failed", id, kind, e);
    });
}

function openTarget(target?: string | null) {
  if (!target) return;
  const isUrl = target.startsWith("http://") || target.startsWith("https://");
  if (isUrl) {
    Linking.openURL(target).catch(() => {});
  } else {
    Alert.alert("Open", target);
  }
}

function versionCompare(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Reads admin-controlled content from the database. Called once per component;
// multiple calls are cheap because the dataset is tiny.
export function useRemoteContent() {
  const [update, setUpdate] = React.useState<AppUpdateItem | null>(null);
  const [campaigns, setCampaigns] = React.useState<CampaignItem[]>([]);
  const [ads, setAds] = React.useState<AdItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const platform = Platform.OS;
      const [upd, adRes] = await Promise.all([
        supabase.from("app_updates").select("*").eq("platform", "all").or(`platform.eq.${platform}`),
        // Ads and marketing campaigns have been merged into a single `ads`
        // table. Banners use the home_banner / splash placements; the sticky
        // footer uses sticky_footer. We fetch everything and split by placement.
        supabase.from("ads").select("*"),
      ]);
      if (mounted) {
        const now = Date.now();
        const updates = (upd.data as AppUpdateItem[]) || [];
        const chosen =
          updates
            .filter((u) => u.active)
            .sort((a, b) => Number(b.force_update) - Number(a.force_update))[0] || null;
        setUpdate(chosen);
        const allAds = ((adRes.data as AdItem[]) || []).filter((a) =>
          isLive(now, a.start_at, a.end_at),
        );
        const bannerPlacements = ["home_banner", "splash"];
        const campaignsRaw = allAds
          .filter((a) => bannerPlacements.some((p) => hasPlacement(a, p)))
          .map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            image_url: a.image_url,
            cta_text: a.cta_text,
            cta_target: a.cta_target ?? a.target_url,
            placement: a.placement,
            start_at: a.start_at,
            end_at: a.end_at,
          }));
        setCampaigns(campaignsRaw);
        setAds(allAds);
      }
      if (mounted) setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [tick]);

  function refetch() {
    setTick((t) => t + 1);
  }

  return { update, campaigns, ads, loading, refetch };
}

export function AppUpdateBanner({ appVersion }: { appVersion?: string }) {
  const { colors } = useTheme();
  const { update, refetch } = useRemoteContent();
  const [dismissed, setDismissed] = React.useState(false);

  if (!update || dismissed) return null;

  // Force-update: only show when the user is below the minimum version.
  if (appVersion && update.min_version && update.force_update) {
    if (versionCompare(appVersion, update.min_version) >= 0) return null;
  }

  const tone = update.maintenance ? "#B45309" : update.force_update ? "#B91C1C" : colors.primary;

  return (
    <View style={[styles.updateBanner, { backgroundColor: tone }]}>
      <Ionicons
        name={update.maintenance ? "construct" : update.force_update ? "warning" : "cloud-download"}
        size={20}
        color="#fff"
      />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.updateTitle}>{update.title}</Text>
        <Text style={styles.updateMsg} numberOfLines={2}>{update.message}</Text>
      </View>
      <TouchableOpacity
        style={styles.updateDismiss}
        onPress={() => {
          setDismissed(true);
          refetch();
        }}
      >
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export function MarketingBanner() {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const bannerPlacements = ["home_banner", "splash"];
  // Only `banner` style promotions belong in the top marketing banner. This
  // prevents a `sticky_footer` (or other style) ad from ever appearing here.
  const c = ads.find(
    (a) => a.active && a.style === "banner" && bannerPlacements.some((p) => hasPlacement(a, p)),
  );
  // Count an impression whenever a banner ad is shown (the banner previously
  // only recorded an `interaction` on tap, so its `views` never incremented).
  React.useEffect(() => {
    if (c) recordAdStat(c.id, 'view');
  }, [c?.id]);
  if (!c) return null;
  const bg = c.background_color || colors.primary;
  const txt = c.text_color || "#FFFFFF";
  const accent = c.accent_color || "#FFFFFF";
  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: bg,
          borderRadius: Math.min(Math.max(c.border_radius || 16, 0), 40),
        },
      ]}
      activeOpacity={0.9}
      onPress={() => {
        recordAdStat(c.id, 'interaction');
        openTarget(c.cta_target || c.target_url);
      }}
    >
      {c.image_url && !c.use_image_as_bg ? (
        <Image source={{ uri: c.image_url }} style={styles.bannerImage} />
      ) : null}
      <View style={styles.bannerBody}>
        <Text style={[styles.bannerTitle, { color: txt }]}>{c.title}</Text>
        {c.description ? (
          <Text style={[styles.bannerDesc, { color: txt, opacity: 0.85 }]} numberOfLines={2}>
            {c.description}
          </Text>
        ) : null}
        {c.discount_badge ? (
          <View style={[styles.bannerBadge, { backgroundColor: c.discount_color || "#EF4444" }]}>
            <Text style={styles.bannerBadgeText}>{c.discount_badge}</Text>
          </View>
        ) : null}
      </View>
      {c.cta_text ? (
        <View style={[styles.bannerCta, { backgroundColor: accent }]}>
          <Text style={[styles.bannerCtaText, { color: txt }]}>{c.cta_text}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// Reads the single-row admin-managed store configuration. Falls back to
// sensible defaults if the row is missing or the table isn't available yet.
export function useStoreSettings() {
  const [settings, setSettings] = React.useState<StoreSettings>({
    call_to_order_enabled: false,
    call_to_order_title: 'Call to order',
    call_to_order_message: '',
    call_to_order_phone: null,
    contact_whatsapp: null,
    contact_email: null,
    contact_phone: null,
    contact_link: null,
    contact_link_label: null,
    social_facebook: null,
    social_x: null,
    social_tiktok: null,
    social_instagram: null,
    social_discord: null,
    social_threads: null,
    social_twitch: null,
    social_telegram: null,
    chatbot_enabled: false,
    chatbot_enabled_admin: false,
    chatbot_model: null,
    chatbot_system_prompt: null,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (mounted && data && !error) {
        const row = data as StoreSettings;
        setSettings({
          call_to_order_enabled: Boolean(row.call_to_order_enabled),
          call_to_order_title: row.call_to_order_title || 'Call to order',
          call_to_order_message: row.call_to_order_message || '',
          call_to_order_phone: row.call_to_order_phone || null,
          contact_whatsapp: row.contact_whatsapp || null,
          contact_email: row.contact_email || null,
          contact_phone: row.contact_phone || null,
          contact_link: row.contact_link || null,
          contact_link_label: row.contact_link_label || null,
          social_facebook: row.social_facebook || null,
          social_x: row.social_x || null,
          social_tiktok: row.social_tiktok || null,
          social_instagram: row.social_instagram || null,
          social_discord: row.social_discord || null,
          social_threads: row.social_threads || null,
          social_twitch: row.social_twitch || null,
          social_telegram: row.social_telegram || null,
          chatbot_enabled: Boolean(row.chatbot_enabled),
          chatbot_enabled_admin: Boolean(row.chatbot_enabled_admin),
          chatbot_model: row.chatbot_model || null,
          chatbot_system_prompt: row.chatbot_system_prompt || null,
        });
      }
      if (mounted) setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading };
}

// Banner shown at the top of the Home screen inviting users to call to place
// an order. Controlled entirely by the admin Settings page.
export function CallToOrderBanner() {
  const { colors } = useTheme();
  const { settings } = useStoreSettings();
  const [dismissed, setDismissed] = React.useState(false);

  if (!settings.call_to_order_enabled || dismissed) return null;
  const phone = (settings.call_to_order_phone || '').replace(/[^0-9+]/g, '');
  if (!phone) return null;

  const dial = () => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View style={[styles.callToOrder, { backgroundColor: colors.primary }]}>
      <Ionicons name="call-outline" size={20} color="#fff" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.callToOrderTitle}>{settings.call_to_order_title || 'Call to order'}</Text>
        {settings.call_to_order_message ? (
          <Text style={styles.callToOrderMsg} numberOfLines={2}>{settings.call_to_order_message}</Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.callToOrderBtn} activeOpacity={0.85} onPress={dial}>
        <Ionicons name="call" size={16} color={colors.primary} />
        <Text style={[styles.callToOrderBtnText, { color: colors.primary }]}>Call</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.callToOrderClose} onPress={() => setDismissed(true)}>
        <Ionicons name="close" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function hasPlacement(a: AdItem, p: string): boolean {
  if (Array.isArray(a.placement)) return a.placement.includes(p);
  return a.placement === p;
}

function pickAd(ads: AdItem[]): AdItem | null {
  const active = ads.filter(
    (a) => a.active && hasPlacement(a, "sticky_footer") && a.show_on_mobile !== false,
  );
  if (!active.length) return null;
  const total = active.reduce((s, a) => s + (a.weight || 1),0);
  let r = Math.random() * total;
  for (const a of active) {
    r -= a.weight || 1;
    if (r <= 0) return a;
  }
  return active[0];
}

export function StickyAdFooter() {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const [closed, setClosed] = React.useState(false);
  const ad = React.useMemo(() => pickAd(ads), [ads]);
  // Count an impression each time a new sticky-footer ad is shown (mirrors the
  // other ad surfaces — ScreenAds, AdCarousel, etc. — which all record a view).
  React.useEffect(() => {
    if (ad) recordAdStat(ad.id, 'view');
  }, [ad?.id]);
  if (!ad || closed) return null;
  const bg = ad.background_color || colors.surface;
  const txt = ad.text_color || colors.text;
  const accent = ad.accent_color || colors.primary;
  const useImgBg = ad.use_image_as_bg && !!ad.image_url;
  return (
    <View
      style={[
        styles.sticky,
        {
          backgroundColor: useImgBg ? "transparent" : bg,
          borderTopColor: colors.background,
          borderTopLeftRadius: Math.min(Math.max(ad.border_radius || 0, 0), 40),
          borderTopRightRadius: Math.min(Math.max(ad.border_radius || 0, 0), 40),
        },
      ]}
    >
      {useImgBg && (
        <Image source={{ uri: ad.image_url! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
      {useImgBg && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]} />
      )}
      <TouchableOpacity
        style={[styles.adClose, { top: 6, right: 6, backgroundColor: useImgBg ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.08)" }]}
        activeOpacity={0.8}
        onPress={() => setClosed(true)}
      >
        <Ionicons name="close" size={16} color={useImgBg ? "#fff" : colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.stickyTouch}
        activeOpacity={0.9}
        onPress={() => {
          recordAdStat(ad.id, 'interaction');
          openTarget(ad.cta_target || ad.target_url);
        }}
      >
        {!useImgBg && ad.image_url ? (
          <Image source={{ uri: ad.image_url }} style={styles.stickyImage} />
        ) : !useImgBg ? (
          <View style={[styles.stickyIcon, { backgroundColor: `${accent}1A` }]}>
            <Ionicons name="pricetag" size={18} color={accent} />
          </View>
        ) : null}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.stickyTitle, { color: useImgBg ? "#fff" : txt }]} numberOfLines={1}>
            {ad.title}
          </Text>
          <Text style={[styles.stickySub, { color: useImgBg ? "#fff" : colors.muted }]} numberOfLines={1}>
            Sponsored
          </Text>
        </View>
        {ad.discount_badge ? (
          <View style={[styles.stickyBadge, { backgroundColor: ad.discount_color || "#EF4444" }]}>
            <Text style={styles.stickyBadgeText}>{ad.discount_badge}</Text>
          </View>
        ) : null}
        <View style={[styles.stickyCta, { backgroundColor: accent }]}>
          <Text style={[styles.stickyCtaText, { color: useImgBg ? "#fff" : txt }]}>
            {ad.cta_text || "View"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={useImgBg ? "#fff" : colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

// Pick one live ad for a given screen + optional style, weighted by `weight`.
function pickScreenAd(ads: AdItem[], screen: string, style?: string): AdItem | null {
  const pool = ads.filter((a) => {
    if (!a.active) return false;
    if (a.show_on_mobile === false) return false;
    if (!hasPlacement(a, screen) && !hasPlacement(a, '*')) return false;
    if (style && a.style !== style) return false;
    return true;
  });
  if (!pool.length) return null;
  const total = pool.reduce((s, a) => s + (a.weight || 1), 0);
  let r = Math.random() * total;
  for (const a of pool) {
    r -= a.weight || 1;
    if (r <= 0) return a;
  }
  return pool[0];
}

// Shared presentational card. Layout varies by `style` but always uses the
// ad's own colors, image-as-background option, discount badge and CTA.
function AdCard({ ad, colors, onClose }: { ad: AdItem; colors: any; onClose?: () => void }) {
  const textOnImg = ad.use_image_as_bg && !!ad.image_url;
  const txt = textOnImg ? '#fff' : ad.text_color || colors.text;
  const accent = ad.accent_color || colors.primary;
  const radius = Math.min(Math.max(ad.border_radius || 0, 0), 40);
  const bg = textOnImg ? 'transparent' : ad.background_color || colors.surface;

  // The whole card is tappable: tapping anywhere on the ad counts as an
  // interaction (tap) and opens the destination. The CTA is now a visual
  // element only so we don't double-count when the card itself is pressed.
  const Cta = (
    <View style={[styles.adCta, { backgroundColor: accent }]}>
      <Text style={[styles.adCtaText, { color: textOnImg ? '#fff' : txt }]}>
        {ad.cta_text || 'View'}
      </Text>
    </View>
  );
  const Badge = ad.discount_badge ? (
    <View style={[styles.adBadge, { backgroundColor: ad.discount_color || '#EF4444' }]}>
      <Text style={styles.adBadgeText}>{ad.discount_badge}</Text>
    </View>
  ) : null;

  const imgBg = textOnImg ? (
    <>
      <Image source={{ uri: ad.image_url! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
    </>
  ) : null;

  const horizontal = ad.style === 'banner' || ad.style === 'sidebar' || ad.style === 'sticky_footer';
  const centered = ad.style === 'popup';

  return (
    <View style={[styles.adCard, { backgroundColor: bg, borderRadius: radius }]}>
      {imgBg}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          recordAdStat(ad.id, 'interaction');
          openTarget(ad.cta_target || ad.target_url);
        }}
      >
        <View
          style={[
            styles.adInner,
            horizontal && { flexDirection: 'row' },
            centered && { alignItems: 'center' },
            (ad.style === 'story' || ad.style === 'fullscreen') && { minHeight: 200, justifyContent: 'flex-end' },
          ]}
        >
          {!textOnImg && ad.image_url ? (
            <Image
              source={{ uri: ad.image_url }}
              style={
                ad.style === 'card' || ad.style === 'story' || ad.style === 'fullscreen'
                  ? styles.adImageWide
                  : styles.adImage
              }
              resizeMode="cover"
            />
          ) : null}
          <View style={[styles.adBody, centered && { alignItems: 'center' }]}>
            {Badge}
            <Text style={[styles.adTitle, { color: txt }]} numberOfLines={2}>
              {ad.title}
            </Text>
            {ad.description ? (
              <Text style={[styles.adDesc, { color: txt, opacity: 0.85 }]} numberOfLines={3}>
                {ad.description}
              </Text>
            ) : null}
            {Cta}
          </View>
        </View>
      </TouchableOpacity>
      {onClose ? (
        <TouchableOpacity style={styles.adClose} onPress={onClose}>
          <Ionicons name="close" size={18} color={textOnImg ? '#fff' : colors.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Inline closable ad card that can be interleaved among product lists.
export function HomeInlineAd({ ad, colors, onClose }: { ad: AdItem; colors: any; onClose: () => void }) {
  // Count an impression whenever this inline ad is shown.
  React.useEffect(() => {
    recordAdStat(ad.id, 'view');
  }, [ad.id]);
  return <AdCard ad={ad} colors={colors} onClose={onClose} />;
}

// Public closable ad card used inside lists / feeds.
export function AdCardInline({ ad, colors, onClose }: { ad: AdItem; colors: any; onClose: () => void }) {
  return <AdCard ad={ad} colors={colors} onClose={onClose} />;
}

// Maps a screen name to the ad style that should appear on it. This keeps the
// main app compliant with the admin editor: an ad only shows in the style it
// was selected for.
const SCREEN_STYLES: Record<string, string> = {
  home: 'banner',
  search: 'banner',
  account: 'banner',
  vehicle: 'card',
  category: 'story',
  app_open: 'fullscreen',
};

// Returns ad items meant to be spliced into product feeds. Only `card` style
// ads (the style chosen in the admin for in-feed promotion) are eligible.
export function useFeedAds(colors: any): AdItem[] {
  const { ads } = useRemoteContent();
  const items = React.useMemo(
    () =>
      ads.filter(
        (a) =>
          a.active &&
          a.show_on_mobile !== false &&
          a.style === 'card',
      ),
    [ads],
  );
  React.useEffect(() => {
    items.forEach((a) => recordAdStat(a.id, 'view'));
  }, [items]);
  return items;
}

// Inline ad for a specific screen (home, search, account, vehicle, category).
// Closable by default so every ad surface offers a dismiss control. Only shows
// the ad style mapped to that screen.
export function ScreenAds({ screen, style }: { screen: string; style?: string }) {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const [closed, setClosed] = React.useState(false);
  const wanted = style ?? SCREEN_STYLES[screen] ?? null;
  const ad = React.useMemo(() => pickScreenAd(ads, screen, wanted ?? undefined), [ads, screen, wanted]);
  React.useEffect(() => {
    if (ad) recordAdStat(ad.id, 'view');
  }, [ad?.id]);
  if (!ad || closed) return null;
  return <AdCard ad={ad} colors={colors} onClose={() => setClosed(true)} />;
}

// Horizontal auto-advancing carousel of ads. Only `carousel` style ads are
// eligible so the Home carousel only shows promotions created as carousels.
export function AdCarousel({ placement = 'home_carousel' }: { placement?: string }) {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const items = React.useMemo(
    () =>
      ads.filter(
        (a) =>
          a.active &&
          a.show_on_mobile !== false &&
          a.style === 'carousel',
      ),
    [ads, placement],
  );
  const scrollRef = React.useRef<any>(null);
  const [active, setActive] = React.useState(0);
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  const visible = React.useMemo(() => items.filter((a) => !dismissed.includes(a.id)), [items, dismissed]);

  React.useEffect(() => {
    if (!items.length) return;
    items.forEach((a) => recordAdStat(a.id, 'view'));
    if (items.length < 2) return;
    const t = setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [items]);

  if (!visible.length) return null;

  return (
    <View style={[styles.carouselWrap, { marginHorizontal: 16, marginTop: 14 }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActive(idx);
        }}
      >
        {visible.map((ad) => (
          <View key={ad.id} style={{ width: SCREEN_WIDTH - 32 }}>
            <AdCard ad={ad} colors={colors} onClose={() => setDismissed((prev) => [...prev, ad.id])} />
          </View>
        ))}
      </ScrollView>
      {items.length > 1 ? (
        <View style={styles.carouselDots}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[
                styles.carouselDot,
                { backgroundColor: i === active ? colors.primary : colors.muted + '66' },
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Popup ad rendered as a small floating icon (FAB). Tapping the icon expands a
// closable ad card. Always dismissible via the close button.
export function PopupAd() {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const [ad, setAd] = React.useState<AdItem | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const next = pickScreenAd(ads, '*', 'popup') ?? pickScreenAd(ads, 'popup', 'popup');
    setAd(next);
    if (next) recordAdStat(next.id, 'view');
  }, [ads]);

  if (!ad) return null;

  if (!open) {
    return (
      <TouchableOpacity
        style={[styles.adFab, { backgroundColor: colors.primary, shadowColor: '#000' }]}
        activeOpacity={0.85}
        onPress={() => setOpen(true)}
      >
        <Ionicons name="megaphone" size={20} color="#fff" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.adFabWrap}>
      <TouchableOpacity style={styles.adFabBackdrop} activeOpacity={1} onPress={() => setOpen(false)} />
      <View style={styles.adFabCard}>
        <AdCard ad={ad} colors={colors} onClose={() => setOpen(false)} />
      </View>
    </View>
  );
}

// Full-screen takeover shown when the app opens (style = 'fullscreen').
export function FullscreenAd() {
  const { colors } = useTheme();
  const { ads } = useRemoteContent();
  const [ad, setAd] = React.useState<AdItem | null>(null);
  React.useEffect(() => {
    const next = pickScreenAd(ads, 'app_open', 'fullscreen');
    setAd(next);
    if (next) recordAdStat(next.id, 'view');
  }, [ads]);
  if (!ad) return null;
  return (
    <View style={styles.adFullscreen}>
      <AdCard ad={ad} colors={colors} onClose={() => setAd(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  updateBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  updateTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  updateMsg: { color: "#fff", fontSize: 12, marginTop: 2, lineHeight: 16 },
  updateDismiss: { marginLeft: 8, padding: 2 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
    overflow: "hidden",
  },
  bannerImage: { width: 56, height: 56, borderRadius: 12 },
  bannerBody: { flex: 1, marginLeft: 12 },
  bannerTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  bannerDesc: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  bannerCta: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  bannerCtaText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  bannerBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 6,
  },
  bannerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  callToOrder: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 20,
  },
  callToOrderTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  callToOrderMsg: { color: "#fff", fontSize: 12, marginTop: 2, lineHeight: 16, opacity: 0.9 },
  callToOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
  },
  callToOrderBtnText: { fontSize: 12, fontWeight: "800", marginLeft: 4 },
  callToOrderClose: { marginLeft: 8, padding: 2 },
  sticky: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  stickyTouch: { flexDirection: "row", alignItems: "center" },
  stickyImage: { width: 40, height: 40, borderRadius: 10 },
  stickyIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stickyTitle: { fontSize: 13, fontWeight: "800" },
  stickySub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  stickyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  stickyBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  stickyCta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginLeft: 8,
  },
  stickyCtaText: { fontSize: 11, fontWeight: '800' },
  adCard: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  adInner: { padding: 14, gap: 10 },
  adImage: { width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  adImageWide: { width: '100%', height: 140, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  adBody: { flex: 1, gap: 6 },
  adTitle: { fontSize: 15, fontWeight: '800' },
  adDesc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  adCta: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, marginTop: 8 },
  adCtaText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  adBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  adBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  adClose: { position: 'absolute', top: 8, right: 8, padding: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 14 },
  adOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 50 },
  adOverlayBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  adPopupWrap: { width: '86%', maxWidth: 420 },
  adFullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 100, padding: 16 },
  carouselWrap: { position: 'relative' },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 6 },
  carouselDot: { width: 7, height: 7, borderRadius: 4 },
  adFab: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 60,
  },
  adFabWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70 },
  adFabBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  adFabCard: { width: '86%', maxWidth: 420, alignSelf: 'center', marginTop: '45%' },
});
