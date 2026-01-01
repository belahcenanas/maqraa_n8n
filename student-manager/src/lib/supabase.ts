import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface MyRecord {
    id: number;
    created_at: string;
    name: string | null;
    duration: string | null; // "minutes"
    tel: string | null;
    time: string | null; // ISO string 2025-12-31T00:39:42.911Z
    day: string | null;
}

export interface TelName {
    id: number;
    created_at: string;
    tel: string | null;
    name: string | null;
}
