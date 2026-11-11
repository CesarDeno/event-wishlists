import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthGate } from '../components/AuthGate';
import { ItemSection } from '../components/ItemSection';
import {
  formatMoney,
  isValidSlug,
  parseOptionalAmount,
  slugify,
} from '../lib/format';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Wishlist, WishlistItem } from '../types';

interface ListDraft {
  title: string;
  slug: string;
  budget: string;
  currency: string;
}

const EMPTY_LIST_DRAFT: ListDraft = {
  title: '',
  slug: '',
  budget: '',
  currency: 'MXN',
};

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

    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at', { ascending: true })
      .returns<WishlistItem[]>();

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

    if (editingListId) {
      const { error } = await supabase
        .from('lists')
        .update({ title, slug, budget, currency })
        .eq('id', editingListId)
        .eq('user_id', userId);

      setSavingList(false);
      if (error) {
        setListError(
          error.code === '23505'
            ? 'Ese slug ya está en uso. Elige otro distinto.'
            : error.message,
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
      .insert({ title, slug, budget, currency, user_id: userId })
      .select('id')
      .single<{ id: string }>();

    setSavingList(false);
    if (error) {
      setListError(
        error.code === '23505'
          ? 'Ese slug ya está en uso. Elige otro distinto.'
          : error.message,
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
                  <span>Slug público *</span>
                  <input
                    type="text"
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

                <div className="form-grid">
                  <label className="field">
                    <span>Presupuesto tope</span>
                    <input
                      type="number"
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
                      maxLength={5}
                      list="currency-options"
                      value={listDraft.currency}
                      onChange={(e) =>
                        setListDraft({ ...listDraft, currency: e.target.value })
                      }
                    />
                    <datalist id="currency-options">
                      <option value="MXN" />
                      <option value="USD" />
                      <option value="EUR" />
                    </datalist>
                  </label>
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
                        <strong>{list.title}</strong>
                        <span className="muted small-text">/l/{list.slug}</span>
                        {budgetText && (
                          <span className="muted small-text">
                            Tope: {budgetText}
                          </span>
                        )}
                      </button>

                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => handleCopyLink(list)}
                        >
                          {copiedId === list.id ? 'Copiado ✓' : 'Copiar enlace'}
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
  );
}

