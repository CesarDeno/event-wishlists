import { useState, type FormEvent } from 'react';
import { formatMoney, isSafeHttpUrl, parseOptionalAmount } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { Wishlist, WishlistItem } from '../types';

interface ItemSectionProps {
  list: Wishlist;
  userId: string;
  items: WishlistItem[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

interface ItemDraft {
  title: string;
  url: string;
  price: string;
  note: string;
  image_url: string;
  is_favorite: boolean;
}

const EMPTY_DRAFT: ItemDraft = {
  title: '',
  url: '',
  price: '',
  note: '',
  image_url: '',
  is_favorite: false,
};

export function ItemSection({
  list,
  userId,
  items,
  loading,
  onRefresh,
}: ItemSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(item: WishlistItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      url: item.url,
      price: item.price !== null ? String(item.price) : '',
      note: item.note ?? '',
      image_url: item.image_url ?? '',
      is_favorite: Boolean(item.is_favorite),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const title = draft.title.trim();
    const url = draft.url.trim();
    const note = draft.note.trim() || null;
    const imageUrl = draft.image_url.trim() || null;
    const price = parseOptionalAmount(draft.price);

    if (!title) {
      setError('El nombre del producto es obligatorio.');
      return;
    }
    if (!isSafeHttpUrl(url)) {
      setError('La URL del producto debe iniciar con http:// o https://.');
      return;
    }
    if (Number.isNaN(price)) {
      setError('El precio debe ser un número válido mayor o igual a 0.');
      return;
    }
    if (imageUrl && !isSafeHttpUrl(imageUrl)) {
      setError('La URL de imagen debe iniciar con http:// o https://.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title,
      url,
      price,
      note,
      image_url: imageUrl,
      is_favorite: draft.is_favorite,
    };

    const nextOrder =
      items.reduce((max, item, idx) => Math.max(max, item.sort_order ?? idx), -1) + 1;

    const result = editingId
      ? await supabase
          .from('items')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', userId)
      : await supabase.from('items').insert({
          ...payload,
          sort_order: nextOrder,
          list_id: list.id,
          user_id: userId,
        });

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    await onRefresh();
  }

  async function handleMove(index: number, delta: -1 | 1) {
    if (!supabase || reordering) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    setReordering(true);
    setError(null);

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = reordered.map((item, nextOrder) =>
      supabase!
        .from('items')
        .update({ sort_order: nextOrder })
        .eq('id', item.id)
        .eq('user_id', userId),
    );

    const results = await Promise.all(updates);
    setReordering(false);

    const failed = results.find((res) => res.error);
    if (failed?.error) {
      setError(failed.error.message);
      return;
    }

    await onRefresh();
  }

  async function handleDelete(item: WishlistItem) {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar "${item.title}" de esta lista?`)) return;

    setError(null);
    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .eq('id', item.id)
      .eq('user_id', userId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === item.id) {
      cancelEdit();
    }
    await onRefresh();
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Productos en</p>
          <h2>{list.title}</h2>
        </div>
        <span className="badge">
          {items.length} {items.length === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="subcard stack">
        <h3>{editingId ? 'Editar producto' : 'Agregar producto'}</h3>
        <div className="form-grid">
          <label className="field">
            <span>Nombre *</span>
            <input
              type="text"
              required
              placeholder="Ej. Termo de acero inoxidable"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Precio aproximado ({list.currency})</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Ej. 450"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>URL de tienda *</span>
          <input
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            required
            placeholder="https://tienda.com/producto"
            value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>Nota corta</span>
            <input
              type="text"
              placeholder="Color negro, talla M, etc."
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>

          <label className="field">
            <span>URL de imagen (opcional)</span>
            <input
              type="url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://.../imagen.jpg"
              value={draft.image_url}
              onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
            />
          </label>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.is_favorite}
            onChange={(e) =>
              setDraft({ ...draft, is_favorite: e.target.checked })
            }
          />
          <span>Destacar como favorito (&ldquo;Lo que más quiero&rdquo;)</span>
        </label>

        {error && <p className="alert alert-error">{error}</p>}

        <div className="row-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? 'Guardando...'
              : editingId
                ? 'Guardar cambios'
                : 'Agregar producto'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Cargando productos...</p>
      ) : items.length === 0 ? (
        <p className="muted empty-state">
          Aún no hay productos en esta lista. Agrega el primero arriba.
        </p>
      ) : (
        <ul className="admin-item-list">
          {items.map((item, index) => {
            const priceText = formatMoney(item.price, list.currency);
            return (
              <li key={item.id} className="admin-item-row">
                <div className="admin-item-info">
                  <div className="item-title-row">
                    <strong>{item.title}</strong>
                    {item.is_favorite && (
                      <span className="badge-favorite">Favorito</span>
                    )}
                  </div>
                  <div className="item-meta">
                    {priceText && <span>{priceText}</span>}
                    {item.note && <span>{item.note}</span>}
                  </div>
                  {isSafeHttpUrl(item.url) && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-inline"
                    >
                      {item.url}
                    </a>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleMove(index, -1)}
                    disabled={reordering || index === 0}
                    aria-label={`Subir ${item.title}`}
                    title="Subir"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleMove(index, 1)}
                    disabled={reordering || index === items.length - 1}
                    aria-label={`Bajar ${item.title}`}
                    title="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => startEdit(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item)}
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
  );
}
