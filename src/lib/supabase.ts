import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables in AI Studio settings.');
}

const isValidUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const supabase = (supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type DBTrack = {
  id: string;
  name: string;
  url: string;
  type: 'playlist' | 'commercial' | 'vignette';
  is_live: boolean;
  user_id: string;
  position?: number;
  created_at?: string;
};

export type DBRadioSettings = {
  user_id: string;
  radio_name: string;
  default_volume: number;
  auto_dj: boolean;
  updated_at?: string;
};

export type DBChat = {
  id: string;
  user_name: string;
  message: string;
  time: number;
  user_id?: string;
};
