import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 환경변수가 없으면 null — 이 경우 메일 전송으로 대체됩니다. */
export const supabase = (url && key) ? createClient(url, key) : null;
export const hasSupabase = !!supabase;
