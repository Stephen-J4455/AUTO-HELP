import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { supabase } from "../supabase/supabase";

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
};

export type AdItem = {
  id: string;
  title: string;
  image_url: string | null;
  target_url: string | null;
  placement: string;
  weight: number;
  active: boolean;
};

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
      const [upd, camp, adRes] = await Promise.all([
        supabase.from("app_updates").select("*").eq("platform", "all").or(`platform.eq.${platform}`),
        supabase.from("marketing_campaigns").select("*").eq("placement", "home_banner"),
        supabase.from("ads").select("*"),
      ]);
      if (mounted) {
        const updates = (upd.data as AppUpdateItem[]) || [];
        const chosen =
          updates
            .filter((u) => u.active)
            .sort((a, b) => Number(b.force_update) - Number(a.force_update))[0] || null;
        setUpdate(chosen);
        setCampaigns((camp.data as CampaignItem[]) || []);
        setAds((adRes.data as AdItem[]) || []);
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
  const { campaigns } = useRemoteContent();
  if (!campaigns.length) return null;
  const c = campaigns[0];
  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: colors.primary }]}
      activeOpacity={0.9}
      onPress={() => openTarget(c.cta_target)}
    >
      {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.bannerImage} /> : null}
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{c.title}</Text>
        {c.description ? <Text style={styles.bannerDesc} numberOfLines={2}>{c.description}</Text> : null}
      </View>
      {c.cta_text ? (
        <View style={styles.bannerCta}>
          <Text style={styles.bannerCtaText}>{c.cta_text}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function pickAd(ads: AdItem[]): AdItem | null {
  const active = ads.filter((a) => a.active && a.placement === "sticky_footer");
  if (!active.length) return null;
  const total = active.reduce((s, a) => s + (a.weight || 1), 0);
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
  const ad = React.useMemo(() => pickAd(ads), [ads]);
  if (!ad) return null;
  return (
    <View style={[styles.sticky, { backgroundColor: colors.surface, borderTopColor: colors.background }]}>
      <TouchableOpacity style={styles.stickyTouch} activeOpacity={0.9} onPress={() => openTarget(ad.target_url)}>
        {ad.image_url ? (
          <Image source={{ uri: ad.image_url }} style={styles.stickyImage} />
        ) : (
          <View style={[styles.stickyIcon, { backgroundColor: `${colors.primary}1A` }]}>
            <Ionicons name="pricetag" size={18} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.stickyTitle, { color: colors.text }]} numberOfLines={1}>{ad.title}</Text>
          <Text style={[styles.stickySub, { color: colors.muted }]} numberOfLines={1}>Sponsored</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>
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
  sticky: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  stickyTouch: { flexDirection: "row", alignItems: "center" },
  stickyImage: { width: 40, height: 40, borderRadius: 10 },
  stickyIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stickyTitle: { fontSize: 13, fontWeight: "800" },
  stickySub: { fontSize: 10, fontWeight: "600", marginTop: 1 },
});