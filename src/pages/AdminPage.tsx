import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../components/AuthGate';
import { ItemSection } from '../components/ItemSection';
import { QrCodeModal } from '../components/QrCodeModal';
import {
  formatEventDate,
  formatMoney,
  isSafeHexColor,
  isValidSlug,
  parseOptionalAmount,
  slugify,
} from '../lib/format';
import {
  fetchListItems,
  formatSupabaseError,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import type { Wishlist, WishlistItem } from '../types';

interface ListDraft {
  title: string;
  slug: string;
  budget: string;
  currency: string;
  emoji: string;
  event_date: string;
  description: string;
  accent_color: string;
}

const EMPTY_LIST_DRAFT: ListDraft = {
  title: '',
  slug: '',
  budget: '',
  currency: 'MXN',
  emoji: '',
  event_date: '',
  description: '',
  accent_color: '',
};

const ACCENT_PRESETS = [
  { label: 'Azul', value: '#007aff' },
  { label: 'Morado', value: '#af52de' },
  { label: 'Rosa', value: '#ff2d55' },
  { label: 'Naranja', value: '#ff9500' },
  { label: 'Verde', value: '#34c759' },
];

export function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [lists, setLists] = useState<Wishlist[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [showListForm, setShowListForm] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listDraft, setListDraft] = useState<ListDraft>(EMPTY_LIST_DRAFT);
  const [slugTouched, setSlugTouched] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrList, setQrList] = useState<Wishlist | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      },
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadLists = useCallback(async (userId: string, preferredId?: string) => {
    if (!supabase) return;
    setListsLoading(true);

    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .returns<Wishlist[]>();

    setListsLoading(false);

    if (error) {
      setListError(error.message);
      return;
    }

    const nextLists = data ?? [];
    setLists(nextLists);
    setSelectedListId((current) => {
      const targetId = preferredId ?? current;
      if (targetId && nextLists.some((l) => l.id === targetId)) {
        return targetId;
      }
      return nextLists[0]?.id ?? null;
    });
  }, []);

  const loadItems = useCallback(async (listId: string) => {
    if (!supabase) return;
    setItemsLoading(true);

    const { data } = await fetchListItems(listId);

    setItems(data ?? []);
    setItemsLoading(false);
  }, []);

  useEffect(() => {
    if (!session) {
      setLists([]);
      setSelectedListId(null);
      setItems([]);
      return;
    }
    loadLists(session.user.id);
  }, [session, loadLists]);

  useEffect(() => {
    if (!selectedListId) {
      setItems([]);
      return;
    }
    loadItems(selectedListId);
  }, [selectedListId, loadItems]);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="page-center">
        <section className="card status-card">
          <h1>Falta configurar Supabase</h1>
          <p className="muted">
            Copia <code>.env.example</code> a <code>.env</code> y agrega{' '}
            <code>VITE_SUPABASE_URL</code> y{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </section>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="page-center">
        <p className="muted">Verificando sesión...</p>
      </main>
    );
  }

  if (!session) {
    return <AuthGate />;
  }

  const userId = session.user.id;
  const selectedList = lists.find((l) => l.id === selectedListId) ?? null;

  function openNewListForm() {
    setEditingListId(null);
    setListDraft(EMPTY_LIST_DRAFT);
    setSlugTouched(false);
    setListError(null);
    setShowListForm(true);
  }

  function openEditListForm(list: Wishlist) {
    setEditingListId(list.id);
    setListDraft({
      title: list.title,
      slug: list.slug,
      budget: list.budget !== null ? String(list.budget) : '',
      currency: list.currency || 'MXN',
      emoji: list.emoji ?? '',
      event_date: list.event_date ?? '',
      description: list.description ?? '',
      accent_color: isSafeHexColor(list.accent_color) ?? '',
    });
    setSlugTouched(true);
    setListError(null);
    setShowListForm(true);
  }

  function closeListForm() {
    setShowListForm(false);
    setEditingListId(null);
    setListDraft(EMPTY_LIST_DRAFT);
    setListError(null);
  }

  function handleTitleChange(nextTitle: string) {
    setListDraft((prev) => ({
      ...prev,
      title: nextTitle,
      slug: !editingListId && !slugTouched ? slugify(nextTitle) : prev.slug,
    }));
  }

  async function handleSaveList(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const title = listDraft.title.trim();
    const slug = listDraft.slug.trim().toLowerCase();
    const budget = parseOptionalAmount(listDraft.budget);
    const currency = listDraft.currency.trim().toUpperCase() || 'MXN';
    const emoji = listDraft.emoji.trim() || null;
    const eventDate = listDraft.event_date.trim() || null;
    const description = listDraft.description.trim() || null;
    const accentColor = isSafeHexColor(listDraft.accent_color);

    if (!title) {
      setListError('El título del evento es obligatorio.');
      return;
    }
    if (!isValidSlug(slug)) {
      setListError(
        'El slug solo puede tener letras minúsculas, números y guiones simples (ej. navidad-2026).',
      );
      return;
    }
    if (Number.isNaN(budget)) {
      setListError('El presupuesto debe ser un número válido mayor o igual a 0.');
      return;
    }

    setSavingList(true);
    setListError(null);

    const payload = {
      title,
      slug,
      budget,
      currency,
      emoji,
      event_date: eventDate,
      description,
      accent_color: accentColor,
    };

    if (editingListId) {
      const { error } = await supabase
        .from('lists')
        .update(payload)
        .eq('id', editingListId)
        .eq('user_id', userId);

      setSavingList(false);
      if (error) {
        setListError(
          formatSupabaseError(
            error,
            'Ese slug ya está en uso. Elige otro distinto.',
          ),
        );
        return;
      }

      const savedId = editingListId;
      closeListForm();
      await loadLists(userId, savedId);
      return;
    }

    const { data, error } = await supabase
      .from('lists')
      .insert({ ...payload, user_id: userId })
      .select('id')
      .single<{ id: string }>();

    setSavingList(false);
    if (error) {
      setListError(
        formatSupabaseError(
          error,
          'Ese slug ya está en uso. Elige otro distinto.',
        ),
      );
      return;
    }

    closeListForm();
    await loadLists(userId, data.id);
  }

  async function handleDeleteList(list: Wishlist) {
    if (!supabase) return;
    if (
      !window.confirm(
        `¿Eliminar la lista "${list.title}" y todos sus productos? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', list.id)
      .eq('user_id', userId);

    if (error) {
      setListError(error.message);
      return;
    }

    if (editingListId === list.id) {
      closeListForm();
    }
    await loadLists(userId);
  }

  async function handleCopyLink(list: Wishlist) {
    const publicUrl = `${window.location.origin}/l/${list.slug}`;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiedId(list.id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === list.id ? null : curr));
      }, 2000);
    } catch {
      window.prompt('Copia este enlace público:', publicUrl);
    }
  }

  return (
    <>
      <main className="container admin-page">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Panel privado</p>
            <h1>Mis wishlists</h1>
          </div>
          <div className="topbar-actions">
            <span className="muted small-text">{session.user.email}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => supabase?.auth.signOut()}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <div className="admin-layout">
          <aside className="stack">
            <section className="card stack">
              <div className="section-header">
                <h2>Eventos</h2>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openNewListForm}
                >
                  + Nueva lista
                </button>
              </div>

              {showListForm && (
                <form onSubmit={handleSaveList} className="subcard stack">
                  <h3>{editingListId ? 'Editar lista' : 'Nueva lista'}</h3>

                  <div className="form-grid">
                    <label className="field">
                      <span>Título del evento *</span>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Intercambio de oficina"
                        value={listDraft.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                      />
                    </label>

                    <label className="field">
                      <span>Emoji (opcional)</span>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="🎁"
                        value={listDraft.emoji}
                        onChange={(e) =>
                          setListDraft({ ...listDraft, emoji: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Slug público *</span>
                    <input
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      placeholder="intercambio-oficina"
                      value={listDraft.slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setListDraft({ ...listDraft, slug: e.target.value });
                      }}
                    />
                    <small className="muted">
                      URL: /l/{listDraft.slug || 'tu-slug'}
                    </small>
                  </label>

                  <label className="field">
                    <span>Nota de bienvenida (opcional)</span>
                    <textarea
                      rows={2}
                      maxLength={240}
                      placeholder="Ej. Cualquier talla M o color neutro me encanta."
                      value={listDraft.description}
                      onChange={(e) =>
                        setListDraft({
                          ...listDraft,
                          description: e.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="form-grid">
                    <label className="field">
                      <span>Presupuesto tope</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        placeholder="Ej. 500"
                        value={listDraft.budget}
                        onChange={(e) =>
                          setListDraft({ ...listDraft, budget: e.target.value })
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Moneda</span>
                      <input
                        type="text"
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={5}
                        list="currency-options"
                        value={listDraft.currency}
                        onChange={(e) =>
                          setListDraft({
                            ...listDraft,
                            currency: e.target.value,
                          })
                        }
                      />
                      <datalist id="currency-options">
                        <option value="MXN" />
                        <option value="USD" />
                        <option value="EUR" />
                      </datalist>
                    </label>
                  </div>

                  <label className="field">
                    <span>Fecha del evento (opcional)</span>
                    <input
                      type="date"
                      value={listDraft.event_date}
                      onChange={(e) =>
                        setListDraft({
                          ...listDraft,
                          event_date: e.target.value,
                        })
                      }
                    />
                  </label>

                  <div className="field">
                    <span>Ambiente de cabecera</span>
                    <div className="color-swatches">
                      {ACCENT_PRESETS.map((preset) => {
                        const active = listDraft.accent_color === preset.value;
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            className={`color-swatch ${active ? 'is-active' : ''}`}
                            style={{ backgroundColor: preset.value }}
                            onClick={() =>
                              setListDraft({
                                ...listDraft,
                                accent_color: active ? '' : preset.value,
                              })
                            }
                            aria-label={preset.label}
                            aria-pressed={active}
                            title={preset.label}
                          />
                        );
                      })}
                      {listDraft.accent_color && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() =>
                            setListDraft({ ...listDraft, accent_color: '' })
                          }
                        >
                          Predeterminado
                        </button>
                      )}
                    </div>
                  </div>

                  {listError && <p className="alert alert-error">{listError}</p>}

                  <div className="row-actions">
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={savingList}
                    >
                      {savingList
                        ? 'Guardando...'
                        : editingListId
                          ? 'Guardar'
                          : 'Crear lista'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={closeListForm}
                      disabled={savingList}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {!showListForm && listError && (
                <p className="alert alert-error">{listError}</p>
              )}

              {listsLoading ? (
                <p className="muted">Cargando listas...</p>
              ) : lists.length === 0 ? (
                <p className="muted empty-state">
                  Todavía no tienes listas. Crea una para empezar.
                </p>
              ) : (
                <ul className="list-nav">
                  {lists.map((list) => {
                    const isSelected = list.id === selectedListId;
                    const budgetText = formatMoney(list.budget, list.currency);
                    const dateText = formatEventDate(list.event_date);
                    return (
                      <li
                        key={list.id}
                        className={`list-nav-item ${isSelected ? 'is-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="list-select-btn"
                          onClick={() => setSelectedListId(list.id)}
                        >
                          <strong>
                            {list.emoji ? `${list.emoji} ` : ''}
                            {list.title}
                          </strong>
                          <span className="muted small-text">
                            /l/{list.slug}
                          </span>
                          {(budgetText || dateText) && (
                            <span className="muted small-text">
                              {[
                                budgetText ? `Tope: ${budgetText}` : null,
                                dateText,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </button>

                        <div className="row-actions">
                          <button
                            type="button"
                            className={`btn btn-secondary btn-xs ${copiedId === list.id ? 'is-copied' : ''}`}
                            onClick={() => handleCopyLink(list)}
                          >
                            {copiedId === list.id
                              ? 'Copiado ✓'
                              : 'Copiar enlace'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => setQrList(list)}
                          >
                            QR
                          </button>
                          <a
                            href={`/l/${list.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-xs"
                          >
                            Ver
                          </a>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => openEditListForm(list)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            onClick={() => handleDeleteList(list)}
                          >
                            Borrar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>

          <div>
            {selectedList ? (
              <ItemSection
                key={selectedList.id}
                list={selectedList}
                userId={userId}
                items={items}
                loading={itemsLoading}
                onRefresh={() => loadItems(selectedList.id)}
              />
            ) : (
              <section className="card empty-state">
                <p className="muted">
                  Selecciona o crea una lista para agregar sus productos.
                </p>
              </section>
            )}
          </div>
        </div>
      </main>

      {qrList && (
        <QrCodeModal
          title={qrList.title}
          slug={qrList.slug}
          url={`${window.location.origin}/l/${qrList.slug}`}
          onClose={() => setQrList(null)}
        />
      )}
    </>
  );
}
