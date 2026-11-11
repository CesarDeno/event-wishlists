import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import {
  formatCountdown,
  formatEventDate,
  formatMoney,
  getHostnameLabel,
  getInitials,
  isSafeHttpUrl,
  normalizeThemePreset,
} from '../lib/format';
import { fetchListItems, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Wishlist, WishlistItem } from '../types';

type SortMode = 'default' | 'price-asc' | 'price-desc';

const STAGGER_DELAYS_MS = [35, 70, 98, 120, 138, 152];

export function PublicListPage() {
  const { slug } = useParams<{ slug: string }>();
  const [list, setList] = useState<Wishlist | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [onlyWithinBudget, setOnlyWithinBudget] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [shareCopied, setShareCopied] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [previewItem, setPreviewItem] = useState<WishlistItem | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);

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
      setAvatarBroken(false);
      setCoverBroken(false);
      setSortMode('default');
      setOnlyWithinBudget(false);
      setHasInteracted(false);
      setPreviewItem(null);

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

      const { data: itemsData, error: itemsError } = await fetchListItems(
        listData.id,
      );

      if (!active) return;

      if (itemsError) {
        setError(
          'Se encontró la lista, pero no fue posible cargar sus productos.',
        );
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

  useEffect(() => {
    const avatarUrl = list?.avatar_url?.trim();
    if (!avatarUrl || !isSafeHttpUrl(avatarUrl)) return;

    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!iconLink) return;

    const prevHref = iconLink.getAttribute('href') ?? '/favicon.svg';
    const prevType = iconLink.getAttribute('type');
    let cancelled = false;

    const applyDirectFallback = () => {
      const probe = new Image();
      probe.onload = () => {
        if (cancelled) return;
        iconLink.removeAttribute('type');
        iconLink.href = avatarUrl;
      };
      probe.src = avatarUrl;
    };

    const corsImg = new Image();
    corsImg.crossOrigin = 'anonymous';
    corsImg.onload = () => {
      if (cancelled) return;
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          applyDirectFallback();
          return;
        }
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const scale = Math.max(size / corsImg.width, size / corsImg.height);
        const w = corsImg.width * scale;
        const h = corsImg.height * scale;
        ctx.drawImage(corsImg, (size - w) / 2, (size - h) / 2, w, h);

        iconLink.type = 'image/png';
        iconLink.href = canvas.toDataURL('image/png');
      } catch {
        applyDirectFallback();
      }
    };
    corsImg.onerror = () => {
      if (!cancelled) applyDirectFallback();
    };
    corsImg.src = avatarUrl;

    return () => {
      cancelled = true;
      iconLink.href = prevHref;
      if (prevType) {
        iconLink.type = prevType;
      } else {
        iconLink.removeAttribute('type');
      }
    };
  }, [list?.avatar_url]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header || !list) {
      setShowStickyBar(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [list]);

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewItem(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewItem]);

  const hasAnyPrice = useMemo(
    () => items.some((item) => item.price !== null),
    [items],
  );

  const canFilterByBudget = useMemo(() => {
    if (!list || list.budget === null) return false;
    const budget = list.budget;
    const hasUnder = items.some((i) => i.price !== null && i.price <= budget);
    const hasOver = items.some((i) => i.price !== null && i.price > budget);
    return hasUnder && hasOver;
  }, [items, list]);

  const visibleItems = useMemo(() => {
    const filtered =
      onlyWithinBudget && list && list.budget !== null
        ? items.filter((i) => i.price !== null && i.price <= list.budget!)
        : items;

    if (sortMode === 'default') return filtered;

    return [...filtered].sort((a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return sortMode === 'price-asc' ? a.price - b.price : b.price - a.price;
    });
  }, [items, list, onlyWithinBudget, sortMode]);

  async function handleShare() {
    if (!list) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: list.title, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  }

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
  const eventDateText = formatEventDate(list.event_date);
  const countdownText = formatCountdown(list.event_date);
  const themePreset = normalizeThemePreset(list.theme_preset);
  const showCover =
    Boolean(list.cover_url) && isSafeHttpUrl(list.cover_url!) && !coverBroken;
  const showAvatar =
    Boolean(list.avatar_url) && isSafeHttpUrl(list.avatar_url!) && !avatarBroken;
  const showHost = Boolean(list.host_name?.trim()) || showAvatar;
  const previewPrice = previewItem
    ? formatMoney(previewItem.price, list.currency)
    : null;

  return (
    <div className="public-page-shell" data-list-theme={themePreset}>
      <div
        className={`public-sticky-bar ${showStickyBar ? 'is-visible' : ''}`}
        aria-hidden={!showStickyBar}
      >
        <div className="public-sticky-inner">
          <div className="sticky-title-wrap">
            <strong>{list.title}</strong>
            {budgetText && (
              <span className="muted small-text">Tope: {budgetText}</span>
            )}
          </div>
          <button
            type="button"
            className={`btn btn-secondary btn-xs ${shareCopied ? 'is-copied' : ''}`}
            onClick={handleShare}
            tabIndex={showStickyBar ? 0 : -1}
          >
            {shareCopied ? 'Copiado ✓' : 'Compartir'}
          </button>
        </div>
      </div>

      <main className="container public-page">
        <header
          ref={headerRef}
          className="public-header public-hero"
        >
          {showCover && (
            <div className="hero-cover">
              <img
                src={list.cover_url!}
                alt={list.title}
                onError={() => setCoverBroken(true)}
              />
            </div>
          )}

          <div className="hero-top-row">
            {showHost ? (
              <div className="hero-host">
                {showAvatar ? (
                  <img
                    src={list.avatar_url!}
                    alt={list.host_name ?? 'Anfitrión'}
                    className="host-avatar"
                    onError={() => setAvatarBroken(true)}
                  />
                ) : (
                  <span className="host-initials" aria-hidden="true">
                    {getInitials(list.host_name)}
                  </span>
                )}
                <span className="host-label">
                  {list.host_name?.trim()
                    ? `Lista de ${list.host_name.trim()}`
                    : 'Lista de regalos'}
                </span>
              </div>
            ) : (
              <p className="eyebrow">Lista de regalos</p>
            )}
            <button
              type="button"
              className={`btn btn-secondary btn-xs ${shareCopied ? 'is-copied' : ''}`}
              onClick={handleShare}
            >
              {shareCopied ? 'Enlace copiado ✓' : 'Compartir lista'}
            </button>
          </div>

          <div className="hero-lead">
            <h1 className="display-title">{list.title}</h1>
            {list.description && (
              <p className="hero-description">{list.description}</p>
            )}
          </div>

          <div className="public-badges hero-decoration">
            {budgetText && (
              <span className="badge badge-accent">
                Presupuesto tope: {budgetText}
              </span>
            )}
            {eventDateText && (
              <span className="badge">
                {eventDateText}
                {countdownText ? ` · ${countdownText}` : ''}
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
          <>
            {(hasAnyPrice && items.length > 1) || canFilterByBudget ? (
              <div className="public-controls">
                {hasAnyPrice && items.length > 1 && (
                  <div
                    className="segmented-control"
                    role="group"
                    aria-label="Ordenar productos"
                  >
                    <button
                      type="button"
                      className={`segment-btn ${sortMode === 'default' ? 'is-active' : ''}`}
                      onClick={() => {
                        setHasInteracted(true);
                        setSortMode('default');
                      }}
                    >
                      Orden original
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${sortMode === 'price-asc' ? 'is-active' : ''}`}
                      onClick={() => {
                        setHasInteracted(true);
                        setSortMode('price-asc');
                      }}
                    >
                      Menor precio
                    </button>
                    <button
                      type="button"
                      className={`segment-btn ${sortMode === 'price-desc' ? 'is-active' : ''}`}
                      onClick={() => {
                        setHasInteracted(true);
                        setSortMode('price-desc');
                      }}
                    >
                      Mayor precio
                    </button>
                  </div>
                )}

                {canFilterByBudget && (
                  <button
                    type="button"
                    className={`btn btn-xs ${onlyWithinBudget ? 'btn-primary' : 'btn-secondary'}`}
                    aria-pressed={onlyWithinBudget}
                    onClick={() => {
                      setHasInteracted(true);
                      setOnlyWithinBudget((prev) => !prev);
                    }}
                  >
                    Dentro del tope
                  </button>
                )}
              </div>
            ) : null}

            <section className="items-grid" aria-label="Productos de la lista">
              {visibleItems.map((item, index) => {
                const priceText = formatMoney(item.price, list.currency);
                const storeLabel = getHostnameLabel(item.url);
                const showImage =
                  Boolean(item.image_url) &&
                  isSafeHttpUrl(item.image_url!) &&
                  !brokenImages[item.id];
                const safeUrl = isSafeHttpUrl(item.url) ? item.url : null;
                const delayMs = hasInteracted
                  ? 0
                  : STAGGER_DELAYS_MS[
                      Math.min(index, STAGGER_DELAYS_MS.length - 1)
                    ];

                return (
                  <article
                    key={item.id}
                    className={`card item-card ${item.is_favorite ? 'is-favorite' : ''} ${hasInteracted ? '' : 'card-stagger'}`}
                    style={
                      hasInteracted
                        ? undefined
                        : { animationDelay: `${delayMs}ms` }
                    }
                  >
                    {showImage ? (
                      <button
                        type="button"
                        className="item-image-wrap item-image-trigger"
                        onClick={() => setPreviewItem(item)}
                        aria-label={`Ampliar imagen de ${item.title}`}
                      >
                        <img
                          src={item.image_url!}
                          alt={item.title}
                          loading="lazy"
                          onError={() =>
                            setBrokenImages((prev) => ({
                              ...prev,
                              [item.id]: true,
                            }))
                          }
                        />
                      </button>
                    ) : (
                      <div className="item-cover-fallback" aria-hidden="true">
                        <span>{storeLabel ?? 'wishlist'}</span>
                      </div>
                    )}

                    <div className="item-card-body">
                      <div className="item-card-top">
                        {item.is_favorite && (
                          <span className="badge-favorite">
                            Lo que más quiero
                          </span>
                        )}
                        <div className="item-title-row">
                          <h2>{item.title}</h2>
                          {storeLabel && (
                            <span className="store-pill">{storeLabel}</span>
                          )}
                        </div>
                        {priceText && (
                          <p className="item-price">~ {priceText}</p>
                        )}
                        {item.note && <p className="item-note">{item.note}</p>}
                      </div>

                      {safeUrl && (
                        <a
                          href={safeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary item-cta"
                        >
                          <span>Ver producto</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>

      {previewItem && previewItem.image_url && (
        <div
          className="quicklook-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={previewItem.title}
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="quicklook-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quicklook-header">
              <div className="quicklook-meta">
                <strong>{previewItem.title}</strong>
                {previewPrice && (
                  <span className="muted small-text">~ {previewPrice}</span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={() => setPreviewItem(null)}
                aria-label="Cerrar vista previa"
              >
                Cerrar
              </button>
            </div>
            <img
              src={previewItem.image_url}
              alt={previewItem.title}
              className="quicklook-image"
            />
          </div>
        </div>
      )}
    </div>
  );
}
