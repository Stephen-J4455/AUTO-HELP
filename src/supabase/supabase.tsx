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
