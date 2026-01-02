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
    duration_minutes: number | null;
    telephone: string | null;
    time_sent: string | null;
    session_day: string | null;
    session_date: string | null; // date as string 'YYYY-MM-DD'
    message_text: string | null;
    ai_explanation: string | null;
    day_sent: string | null;
}

export interface TelName {
    id: number;
    created_at: string;
    tel: string | null;
    name: string | null;
}
