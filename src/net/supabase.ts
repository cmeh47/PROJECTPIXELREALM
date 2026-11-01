import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// The Supabase client, or null when the project isn't configured (see .env.example): the game then
// runs offline and nothing is saved. The anon key is public by design; the database only lets a
// player read their own rows and change them through server functions.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

// On phones, keep the session fresh only while the app is in the foreground.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Signs in as a guest the first time; after that the saved session is reused.
export async function ensureSignedIn(client: SupabaseClient) {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user;
  const { data: created, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return created.user;
}
