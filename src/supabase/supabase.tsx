import React from "react";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabase_public_key = "sb_publishable_lcduiIC90olr-DSSkKcmNw_yyyGNm8x";
const supabase_url = "https://tetgyhnqikauxjlrseiz.supabase.co";

export const supabase = createClient(supabase_url, supabase_public_key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Returns the deep-link URL that Supabase OAuth providers should redirect back to.
 * Uses the app's custom URL scheme (root) so the OS routes the callback into the
 * app. We use the root scheme (not a sub-path) to match the proven CHAWP flow,
 * which avoids mismatches between the registered redirect URL and the one
 * Supabase actually calls back to.
 */
export const getRedirectUrl = (): string => {
  const scheme = "autohelpgh";
  return `${scheme}://`;
};
