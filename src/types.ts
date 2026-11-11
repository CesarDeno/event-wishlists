export type ListThemePreset = 'classic' | 'warm' | 'festive' | 'editorial';

export interface Wishlist {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  budget: number | null;
  currency: string;
  description?: string | null;
  event_date?: string | null;
  host_name?: string | null;
  avatar_url?: string | null;
  theme_preset?: ListThemePreset | string | null;
  cover_url?: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  list_id: string;
  user_id: string;
  title: string;
  url: string;
  price: number | null;
  note: string | null;
  image_url: string | null;
  is_favorite?: boolean;
  sort_order?: number;
  created_at: string;
}
