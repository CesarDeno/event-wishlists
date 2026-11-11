import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WishlistItem } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function fetchListItems(listId: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase no configurado') };
  }

  const ordered = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<WishlistItem[]>();

  // Respaldo si aún no se ha ejecutado el ALTER TABLE con sort_order
  if (ordered.error?.code === '42703') {
    return supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
      .returns<WishlistItem[]>();
  }

  return ordered;
}
