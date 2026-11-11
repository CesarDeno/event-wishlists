import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "../components/AuthGate";
import { ConfirmModal } from "../components/ConfirmModal";
import { ItemSection } from "../components/ItemSection";
import { QrCodeModal } from "../components/QrCodeModal";
import {
   LIST_THEME_PRESETS,
   formatEventDate,
   formatMoney,
   isSafeHttpUrl,
   isValidSlug,
   normalizeThemePreset,
   parseOptionalAmount,
   slugify,
   type ValidThemePreset,
} from "../lib/format";
import { fetchListItems, formatSupabaseError, isSupabaseConfigured, supabase } from "../lib/supabase";
import type { Wishlist, WishlistItem } from "../types";

interface ListDraft {
   title: string;
   slug: string;
   budget: string;
   currency: string;
   event_date: string;
   description: string;
   host_name: string;
   avatar_url: string;
   theme_preset: ValidThemePreset;
   cover_url: string;
}

const EMPTY_LIST_DRAFT: ListDraft = {
   title: "",
   slug: "",
   budget: "",
   currency: "MXN",
   event_date: "",
   description: "",
   host_name: "",
   avatar_url: "",
   theme_preset: "classic",
   cover_url: "",
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
   const [qrList, setQrList] = useState<Wishlist | null>(null);
   const [pendingDeleteList, setPendingDeleteList] = useState<Wishlist | null>(null);
   const [deletingList, setDeletingList] = useState(false);

   useEffect(() => {
      if (!isSupabaseConfigured || !supabase) {
         setAuthReady(true);
         return;
      }

      supabase.auth.getSession().then(({ data }) => {
         setSession(data.session);
         setAuthReady(true);
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
         setSession(nextSession);
      });

      return () => {
         subscription.subscription.unsubscribe();
      };
   }, []);

   const loadLists = useCallback(async (userId: string, preferredId?: string) => {
      if (!supabase) return;
      setListsLoading(true);

      const { data, error } = await supabase
         .from("lists")
         .select("*")
         .eq("user_id", userId)
         .order("created_at", { ascending: false })
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
                  Copia <code>.env.example</code> a <code>.env</code> y agrega <code>VITE_SUPABASE_URL</code> y{" "}
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
         budget: list.budget !== null ? String(list.budget) : "",
         currency: list.currency || "MXN",
         event_date: list.event_date ?? "",
         description: list.description ?? "",
         host_name: list.host_name ?? "",
         avatar_url: list.avatar_url ?? "",
         theme_preset: normalizeThemePreset(list.theme_preset),
         cover_url: list.cover_url ?? "",
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
      const currency = listDraft.currency.trim().toUpperCase() || "MXN";
      const eventDate = listDraft.event_date.trim() || null;
      const description = listDraft.description.trim() || null;
      const hostName = listDraft.host_name.trim() || null;
      const avatarUrl = listDraft.avatar_url.trim() || null;
      const themePreset = normalizeThemePreset(listDraft.theme_preset);
      const coverUrl = listDraft.cover_url.trim() || null;

      if (!title) {
         setListError("El título del evento es obligatorio.");
         return;
      }
      if (!isValidSlug(slug)) {
         setListError("El slug solo puede tener letras minúsculas, números y guiones simples (ej. navidad-2026).");
         return;
      }
      if (Number.isNaN(budget)) {
         setListError("El presupuesto debe ser un número válido mayor o igual a 0.");
         return;
      }
      if (avatarUrl && !isSafeHttpUrl(avatarUrl)) {
         setListError("La URL del avatar debe iniciar con http:// o https://.");
         return;
      }
      if (coverUrl && !isSafeHttpUrl(coverUrl)) {
         setListError("La URL de portada debe iniciar con http:// o https://.");
         return;
      }

      setSavingList(true);
      setListError(null);

      const payload = {
         title,
         slug,
         budget,
         currency,
         event_date: eventDate,
         description,
         host_name: hostName,
         avatar_url: avatarUrl,
         theme_preset: themePreset,
         cover_url: coverUrl,
      };

      if (editingListId) {
         const { error } = await supabase.from("lists").update(payload).eq("id", editingListId).eq("user_id", userId);

         setSavingList(false);
         if (error) {
            setListError(formatSupabaseError(error, "Ese slug ya está en uso. Elige otro distinto."));
            return;
         }

         const savedId = editingListId;
         closeListForm();
         await loadLists(userId, savedId);
         return;
      }

      const { data, error } = await supabase
         .from("lists")
         .insert({ ...payload, user_id: userId })
         .select("id")
         .single<{ id: string }>();

      setSavingList(false);
      if (error) {
         setListError(formatSupabaseError(error, "Ese slug ya está en uso. Elige otro distinto."));
         return;
      }

      closeListForm();
      await loadLists(userId, data.id);
   }

   async function confirmDeleteList() {
      if (!supabase || !pendingDeleteList) return;
      const target = pendingDeleteList;

      setDeletingList(true);
      const { error } = await supabase.from("lists").delete().eq("id", target.id).eq("user_id", userId);
      setDeletingList(false);

      if (error) {
         setListError(error.message);
         setPendingDeleteList(null);
         return;
      }

      if (editingListId === target.id) {
         closeListForm();
      }
      setPendingDeleteList(null);
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
         window.prompt("Copia este enlace público:", publicUrl);
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
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => supabase?.auth.signOut()}>
                     Cerrar sesión
                  </button>
               </div>
            </header>

            <div className="admin-layout">
               <aside className="stack">
                  <section className="card stack">
                     <div className="section-header">
                        <h2>Eventos</h2>
                        <button type="button" className="btn btn-primary btn-sm" onClick={openNewListForm}>
                           + Nueva lista
                        </button>
                     </div>

                     {showListForm && (
                        <form onSubmit={handleSaveList} className="subcard stack">
                           <h3>{editingListId ? "Editar lista" : "Nueva lista"}</h3>

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
                              <small className="muted">URL: /l/{listDraft.slug || "tu-slug"}</small>
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
                                    onChange={(e) => setListDraft({ ...listDraft, budget: e.target.value })}
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

                           <div className="form-grid">
                              <label className="field">
                                 <span>Anfitrión / firma (opcional)</span>
                                 <input
                                    type="text"
                                    maxLength={60}
                                    placeholder="Ej. Cesar Denogean"
                                    value={listDraft.host_name}
                                    onChange={(e) =>
                                       setListDraft({
                                          ...listDraft,
                                          host_name: e.target.value,
                                       })
                                    }
                                 />
                              </label>

                              <label className="field">
                                 <span>URL de avatar (opcional)</span>
                                 <input
                                    type="url"
                                    inputMode="url"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    placeholder="https://.../avatar.jpg"
                                    value={listDraft.avatar_url}
                                    onChange={(e) =>
                                       setListDraft({
                                          ...listDraft,
                                          avatar_url: e.target.value,
                                       })
                                    }
                                 />
                              </label>
                           </div>

                           <label className="field">
                              <span>URL de portada del evento (opcional)</span>
                              <input
                                 type="url"
                                 inputMode="url"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 placeholder="https://.../portada.jpg"
                                 value={listDraft.cover_url}
                                 onChange={(e) =>
                                    setListDraft({
                                       ...listDraft,
                                       cover_url: e.target.value,
                                    })
                                 }
                              />
                           </label>

                           <div className="field">
                              <span>Estilo de la lista</span>
                              <div className="theme-preset-grid">
                                 {LIST_THEME_PRESETS.map((preset) => {
                                    const active = listDraft.theme_preset === preset.id;
                                    return (
                                       <button
                                          key={preset.id}
                                          type="button"
                                          className={`theme-preset-btn ${active ? "is-active" : ""}`}
                                          aria-pressed={active}
                                          onClick={() =>
                                             setListDraft({
                                                ...listDraft,
                                                theme_preset: preset.id,
                                             })
                                          }
                                       >
                                          <span
                                             className="theme-preset-dot"
                                             style={{ background: preset.swatch }}
                                             aria-hidden="true"
                                          />
                                          <span>{preset.label}</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>

                           {listError && <p className="alert alert-error">{listError}</p>}

                           <div className="row-actions">
                              <button type="submit" className="btn btn-primary btn-sm" disabled={savingList}>
                                 {savingList ? "Guardando..." : editingListId ? "Guardar" : "Crear lista"}
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

                     {!showListForm && listError && <p className="alert alert-error">{listError}</p>}

                     {listsLoading ? (
                        <p className="muted">Cargando listas...</p>
                     ) : lists.length === 0 ? (
                        <p className="muted empty-state">Todavía no tienes listas. Crea una para empezar.</p>
                     ) : (
                        <ul className="list-nav">
                           {lists.map((list) => {
                              const isSelected = list.id === selectedListId;
                              const budgetText = formatMoney(list.budget, list.currency);
                              const dateText = formatEventDate(list.event_date);
                              return (
                                 <li key={list.id} className={`list-nav-item ${isSelected ? "is-selected" : ""}`}>
                                    <button
                                       type="button"
                                       className="list-select-btn"
                                       onClick={() => setSelectedListId(list.id)}
                                    >
                                       <strong>{list.title}</strong>
                                       <span className="muted small-text">/l/{list.slug}</span>
                                       {(budgetText || dateText) && (
                                          <span className="muted small-text">
                                             {[budgetText ? `Tope: ${budgetText}` : null, dateText]
                                                .filter(Boolean)
                                                .join(" · ")}
                                          </span>
                                       )}
                                    </button>

                                    <div className="row-actions">
                                       <button
                                          type="button"
                                          className={`btn btn-secondary btn-xs ${copiedId === list.id ? "is-copied" : ""}`}
                                          onClick={() => handleCopyLink(list)}
                                       >
                                          {copiedId === list.id ? "Copiado ✓" : "Copiar enlace"}
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
                                          onClick={() => setPendingDeleteList(list)}
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
                        <p className="muted">Selecciona o crea una lista para agregar sus productos.</p>
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

         {pendingDeleteList && (
            <ConfirmModal
               title="¿Eliminar lista?"
               message={`Se eliminará "${pendingDeleteList.title}" y todos sus productos. Esta acción no se puede deshacer.`}
               loading={deletingList}
               onConfirm={confirmDeleteList}
               onCancel={() => setPendingDeleteList(null)}
            />
         )}
      </>
   );
}
