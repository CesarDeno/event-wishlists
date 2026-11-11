import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatMoney, isSafeHttpUrl } from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Wishlist, WishlistItem } from '../types';

export function PublicListPage() {
  const { slug } = useParams<{ slug: string }>();
  const [list, setList] = useState<Wishlist | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        setError('Falta configurar las variables de Supabase.');
        return;
      }

      if (!slug) {
        setLoading(false);
        setList(null);
        return;
      }

      setLoading(true);
      setError(null);
      setBrokenImages({});

      const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('slug', slug)
        .maybeSingle<Wishlist>();

      if (!active) return;

      if (listError) {
        setError('No se pudo cargar la lista en este momento.');
        setLoading(false);
        return;
      }

      if (!listData) {
        setList(null);
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listData.id)
        .order('created_at', { ascending: true })
        .returns<WishlistItem[]>();

      if (!active) return;

      if (itemsError) {
        setError('Se encontró la lista, pero no fue posible cargar sus productos.');
        setList(listData);
        setLoading(false);
        return;
      }

      setList(listData);
      setItems(itemsData ?? []);
      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    const prevTitle = document.title;
    if (list) {
      document.title = `${list.title} — Wishlist`;
    }
    return () => {
      document.title = prevTitle;
    };
  }, [list]);

  if (loading) {
    return (
      <main className="page-center">
        <p className="muted">Cargando wishlist...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-center">
        <section className="card status-card">
          <h1>Error</h1>
          <p className="muted">{error}</p>
        </section>
      </main>
    );
  }

  if (!list) {
    return (
      <main className="page-center">
        <section className="card status-card">
          <h1>Lista no encontrada</h1>
          <p className="muted">
            No existe una wishlist activa para <code>/l/{slug}</code>. Verifica
            el enlace con quien la compartió.
          </p>
        </section>
      </main>
    );
  }

  const budgetText = formatMoney(list.budget, list.currency);

  return (
    <main className="container public-page">
      <header className="public-header">
        <p className="eyebrow">Lista de regalos</p>
        <h1>{list.title}</h1>
        <div className="public-badges">
          {budgetText && (
            <span className="badge badge-accent">
              Presupuesto tope: {budgetText}
            </span>
          )}
          <span className="badge">
            {items.length} {items.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <section className="card empty-state">
          <p className="muted">Esta lista aún no tiene productos agregados.</p>
        </section>
      ) : (
        <section className="items-grid" aria-label="Productos de la lista">
          {items.map((item) => {
            const priceText = formatMoney(item.price, list.currency);
            const showImage =
              Boolean(item.image_url) &&
              isSafeHttpUrl(item.image_url!) &&
              !brokenImages[item.id];
            const safeUrl = isSafeHttpUrl(item.url) ? item.url : null;

            return (
              <article key={item.id} className="card item-card">
                {showImage && (
                  <div className="item-image-wrap">
                    <img
                      src={item.image_url!}
                      alt={item.title}
                      loading="lazy"
                      onError={() =>
                        setBrokenImages((prev) => ({ ...prev, [item.id]: true }))
                      }
                    />
                  </div>
                )}

                <div className="item-card-body">
                  <div className="item-card-top">
                    <h2>{item.title}</h2>
                    {priceText && <p className="item-price">~ {priceText}</p>}
                    {item.note && <p className="item-note">{item.note}</p>}
                  </div>

                  {safeUrl && (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary item-cta"
                    >
                      Ver producto
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

