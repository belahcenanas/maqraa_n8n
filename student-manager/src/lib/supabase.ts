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
    whatsapp_id_student: string | null;
    time_sent: string | null; // time without time zone as string 'HH:mm:ss'
    session_day: string | null;
    session_date: string | null; // date as string 'YYYY-MM-DD'
    message_text: string | null;
    ai_explanation: string | null;
    day_sent: string | null;
    uid_whatsapp: string | null;
    type_message: string | null;
}

export interface Student {
    id: number;
    created_at: string;
    whatsapp_id_student: string | null;
    name: string | null;
    group_id: number | null;
    color: string | null;
}

export interface Group {
    id: number;
    created_at: string;
    name: string;
    description: string | null;
}

// Alias for backward compatibility
export type TelName = Student;
