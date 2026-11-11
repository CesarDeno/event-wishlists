import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  formatCompactUrl,
  formatMoney,
  isSafeHttpUrl,
  parseOptionalAmount,
} from '../lib/format';
import { formatSupabaseError, supabase } from '../lib/supabase';
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

interface DragSession {
  pointerId: number;
  startIndex: number;
  targetIndex: number;
  startY: number;
  minDy: number;
  maxDy: number;
  shiftDistance: number;
  rects: DOMRect[];
}

export function ItemSection({
  list,
  userId,
  items,
  loading,
  onRefresh,
}: ItemSectionProps) {
  const [localItems, setLocalItems] = useState<WishlistItem[]>(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const dragRef = useRef<DragSession | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

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
      localItems.reduce(
        (max, item, idx) => Math.max(max, item.sort_order ?? idx),
        -1,
      ) + 1;

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
      setError(formatSupabaseError(result.error));
      return;
    }

    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    await onRefresh();
  }

  async function commitReorder(fromIndex: number, toIndex: number) {
    if (!supabase || fromIndex === toIndex) return;
    if (toIndex < 0 || toIndex >= localItems.length) return;

    const previous = localItems;
    const reordered = [...localItems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const withOrder = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx,
    }));

    setLocalItems(withOrder);
    setError(null);

    const updates = withOrder
      .filter((item, idx) => {
        const oldIndex = previous.findIndex((p) => p.id === item.id);
        return oldIndex !== idx || (previous[oldIndex]?.sort_order ?? oldIndex) !== idx;
      })
      .map((item) =>
        supabase!
          .from('items')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('user_id', userId),
      );

    const results = await Promise.all(updates);
    const failed = results.find((res) => res.error);
    if (failed?.error) {
      setLocalItems(previous);
      setError(formatSupabaseError(failed.error));
      return;
    }

    await onRefresh();
  }

  function clearRowTransforms() {
    for (const row of rowRefs.current.values()) {
      row.style.transform = '';
      row.style.transition = '';
    }
  }

  function handleDragStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (localItems.length < 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rects = localItems.map((item) => {
      const el = rowRefs.current.get(item.id);
      return el ? el.getBoundingClientRect() : new DOMRect();
    });
    const startRect = rects[index];
    const firstRect = rects[0];
    const lastRect = rects[rects.length - 1];
    if (!startRect || !firstRect || !lastRect) return;

    const gap =
      rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 12;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startIndex: index,
      targetIndex: index,
      startY: event.clientY,
      minDy: firstRect.top - startRect.top,
      maxDy: lastRect.bottom - startRect.bottom,
      shiftDistance: startRect.height + gap,
      rects,
    };

    const draggedEl = rowRefs.current.get(localItems[index].id);
    if (draggedEl) {
      draggedEl.style.transition = 'none';
    }
    setDraggingId(localItems[index].id);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dy = Math.min(drag.maxDy, Math.max(drag.minDy, event.clientY - drag.startY));
    const draggedItem = localItems[drag.startIndex];
    const draggedEl = draggedItem ? rowRefs.current.get(draggedItem.id) : null;
    if (draggedEl) {
      draggedEl.style.transform = `translate3d(0, ${dy}px, 0)`;
    }

    const startRect = drag.rects[drag.startIndex];
    const centerY = startRect.top + startRect.height / 2 + dy;

    let nextTarget = drag.startIndex;
    for (let i = 0; i < drag.rects.length; i += 1) {
      const r = drag.rects[i];
      const mid = r.top + r.height / 2;
      if (i < drag.startIndex && centerY < mid) {
        nextTarget = i;
        break;
      }
      if (i > drag.startIndex && centerY > mid) {
        nextTarget = i;
      }
    }

    if (nextTarget !== drag.targetIndex) {
      drag.targetIndex = nextTarget;
      localItems.forEach((item, idx) => {
        if (idx === drag.startIndex) return;
        const rowEl = rowRefs.current.get(item.id);
        if (!rowEl) return;

        let offset = 0;
        if (drag.startIndex < nextTarget && idx > drag.startIndex && idx <= nextTarget) {
          offset = -drag.shiftDistance;
        } else if (
          drag.startIndex > nextTarget &&
          idx >= nextTarget &&
          idx < drag.startIndex
        ) {
          offset = drag.shiftDistance;
        }
        const reduceMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)',
        ).matches;
        rowEl.style.transition = reduceMotion
          ? 'none'
          : 'transform 160ms var(--ease-out)';
        rowEl.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
      });
    }
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const { startIndex, targetIndex } = drag;
    dragRef.current = null;
    setDraggingId(null);
    clearRowTransforms();

    if (targetIndex !== startIndex) {
      void commitReorder(startIndex, targetIndex);
    }
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
          {localItems.length}{' '}
          {localItems.length === 1 ? 'producto' : 'productos'}
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
      ) : localItems.length === 0 ? (
        <p className="muted empty-state">
          Aún no hay productos en esta lista. Agrega el primero arriba.
        </p>
      ) : (
        <ul className="admin-item-list">
          {localItems.map((item, index) => {
            const priceText = formatMoney(item.price, list.currency);
            const compactUrl = formatCompactUrl(item.url);
            const isDragging = draggingId === item.id;
            return (
              <li
                key={item.id}
                ref={(el) => {
                  if (el) {
                    rowRefs.current.set(item.id, el);
                  } else {
                    rowRefs.current.delete(item.id);
                  }
                }}
                className={`admin-item-row ${isDragging ? 'is-dragging' : ''}`}
              >
                <div className="admin-item-lead">
                  {localItems.length > 1 && (
                    <button
                      type="button"
                      className="drag-handle"
                      onPointerDown={(e) => handleDragStart(e, index)}
                      onPointerMove={handleDragMove}
                      onPointerUp={handleDragEnd}
                      onPointerCancel={handleDragEnd}
                      aria-label={`Arrastrar para reordenar ${item.title}`}
                      title="Arrastrar para reordenar"
                    >
                      <svg
                        width="14"
                        height="18"
                        viewBox="0 0 14 18"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="4" cy="3" r="1.5" />
                        <circle cx="10" cy="3" r="1.5" />
                        <circle cx="4" cy="9" r="1.5" />
                        <circle cx="10" cy="9" r="1.5" />
                        <circle cx="4" cy="15" r="1.5" />
                        <circle cx="10" cy="15" r="1.5" />
                      </svg>
                    </button>
                  )}

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
                    {isSafeHttpUrl(item.url) && compactUrl && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-inline link-compact"
                        title={item.url}
                      >
                        <span>{compactUrl}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="row-actions">
                  {localItems.length > 1 && (
                    <div className="reorder-stepper" role="group" aria-label="Mover posición">
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => void commitReorder(index, index - 1)}
                        disabled={index === 0}
                        aria-label={`Subir ${item.title}`}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => void commitReorder(index, index + 1)}
                        disabled={index === localItems.length - 1}
                        aria-label={`Bajar ${item.title}`}
                        title="Bajar"
                      >
                        ↓
                      </button>
                    </div>
                  )}
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
