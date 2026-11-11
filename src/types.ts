export interface Wishlist {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  budget: number | null;
  currency: string;
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
  created_at: string;
}

