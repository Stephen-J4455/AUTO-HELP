import { Platform } from "react-native";
import { supabase } from "../supabase/supabase";
import { APP_VERSION } from "./appVersion";

export type AppUpdate = {
  id: string;
  version: string;
  platform: string;
  title: string;
  message: string;
  release_notes: string | null;
  min_version: string | null;
  force_update: boolean;
  maintenance: boolean;
  update_url: string | null;
  active: boolean;
};

export type UpdateDecision =
  | { kind: "none" }
  | { kind: "maintenance"; update: AppUpdate }
  | { kind: "force"; update: AppUpdate }
  | { kind: "optional"; update: AppUpdate };

/**
 * Compares two dot-separated version strings.
 * Returns a negative number if `a < b`, positive if `a > b`, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Reads the admin-controlled `app_updates` table and decides what (if anything)
 * the current build should show the user:
 *   - maintenance: a maintenance-mode entry is active → block the app.
 *   - force:       an active entry requires a version >= min_version we don't meet.
 *   - optional:    an active entry advertises a newer version than we have.
 *   - none:        nothing to show.
 *
 * Only `active = true` rows are readable by the public (RLS), and we filter
 * by platform (`all` or the current OS).
 */
export async function fetchUpdateDecision(): Promise<UpdateDecision> {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const { data, error } = await supabase
    .from("app_updates")
    .select("*")
    .eq("active", true)
    .or(`platform.eq.all,platform.eq.${platform}`)
    .order("created_at", { ascending: false });

  if (error || !data) return { kind: "none" };

  const rows = (data as AppUpdate[]) || [];

  // 1) Maintenance mode takes precedence — block the app entirely.
  const maintenance = rows.find((r) => r.maintenance);
  if (maintenance) return { kind: "maintenance", update: maintenance };

  // 2) Force update if any active entry requires a minimum version we're below.
  const force = rows.find(
    (r) => r.force_update && r.min_version && compareVersions(APP_VERSION, r.min_version) < 0
  );
  if (force) return { kind: "force", update: force };

  // 3) Otherwise, advertise the newest available version (if newer than ours).
  const newer = rows
    .filter((r) => compareVersions(r.version, APP_VERSION) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))[0];
  if (newer) return { kind: "optional", update: newer };

  return { kind: "none" };
}